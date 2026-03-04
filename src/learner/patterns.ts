import { ABSTRACT_INDICATORS, BEAT_PATTERNS, type EditPattern, type EditSubType, SENSORY_WORDS } from "./diff.js";

// ─── Types ───────────────────────────────────────

export interface LearnedPattern {
  id: string;
  projectId: string;
  patternType: EditSubType;
  patternData: PatternData;
  occurrences: number;
  confidence: number;
  status: "proposed" | "accepted" | "rejected" | "expired";
  proposedAction: ProposedAction | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatternData {
  /** Normalized text that appears across edits (lowercase) */
  key: string;
  /** Representative example phrases from the edits */
  phrases: string[];
  /** Up to 5 before/after example pairs */
  examples: Array<{ original: string; edited: string; context: string | null }>;
}

export interface ProposedAction {
  target: string;
  value: string;
}

export interface PatternGroup {
  patternType: EditSubType;
  key: string;
  edits: EditPattern[];
  weightedCount: number;
  confidence: number;
  /** True for subType-level advisory groups (softer threshold, coaching proposals) */
  advisory?: boolean;
}

// ─── Constants ───────────────────────────────────

const Z = 1.96; // 95% CI
const PROMOTION_MIN_OCCURRENCES = 5;
const PROMOTION_MIN_CONFIDENCE = 0.6;
const ADVISORY_MIN_WEIGHTED_COUNT = 8;
const ADVISORY_MIN_SCENE_COUNT = 2;

/** Sentinel keys used for subTypes where unique prose text won't repeat.
 *  These must NOT be promoted via Tier 1 (they'd inject garbage into the Bible).
 *  They flow through the advisory tier instead, which produces coaching-style actions. */
const SENTINEL_KEYS = new Set([
  "_tone_shift_",
  "_dialogue_voice_",
  "_cut_passage_",
  "_show_dont_tell_",
  "_sensory_added_",
  "_beat_added_",
]);
const DECAY_WINDOW = 30;
const DECAY_WEIGHT = 0.5;

// ─── Wilson Interval ─────────────────────────────

/**
 * Compute Wilson score interval lower bound.
 * Used to estimate confidence that a pattern is real,
 * accounting for small sample sizes.
 *
 * @param successes Number of times the pattern appeared
 * @param total Total number of opportunities (edits analyzed)
 * @returns Lower bound of 95% Wilson confidence interval
 */
export function wilsonLowerBound(successes: number, total: number): number {
  if (total === 0) return 0;
  const p = successes / total;
  const z2 = Z * Z;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const spread = Z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return Math.max(0, (center - spread) / denominator);
}

// ─── Evidence Decay ──────────────────────────────

/**
 * Apply evidence decay: edits older than `decayWindow` scenes
 * from the most recent scene carry reduced weight.
 */
export function computeWeightedCount(
  edits: EditPattern[],
  sceneOrder: Map<string, number>,
  decayWindow: number = DECAY_WINDOW,
): number {
  if (edits.length === 0) return 0;

  // Find the maximum scene order across all edits
  let maxOrder = 0;
  for (const edit of edits) {
    const order = sceneOrder.get(edit.sceneId) ?? 0;
    if (order > maxOrder) maxOrder = order;
  }

  let weighted = 0;
  for (const edit of edits) {
    const order = sceneOrder.get(edit.sceneId) ?? 0;
    const age = maxOrder - order;
    weighted += age > decayWindow ? DECAY_WEIGHT : 1;
  }

  return weighted;
}

// ─── Key Extraction Helpers ──────────────────────

/** Extract which abstract-indicator pattern matched in the text, if any. */
function extractAbstractIndicator(text: string): string | null {
  for (const pattern of ABSTRACT_INDICATORS) {
    const match = text.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

/** Extract the first matched sensory word from the text. */
function extractSensoryWord(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of SENSORY_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

/** Extract the first matched beat verb from the text. */
function extractBeatVerb(text: string): string | null {
  // Pattern 0: direct verb (group 1). Pattern 1: body-part…verb (group 2).
  for (let i = 0; i < BEAT_PATTERNS.length; i++) {
    const pattern = BEAT_PATTERNS[i];
    if (!pattern) continue;
    const match = text.match(pattern);
    if (!match) continue;
    const verb = i === 0 ? match[1] : (match[2] ?? match[1]);
    if (verb) return verb.toLowerCase();
  }
  return null;
}

// ─── Pattern Grouping ────────────────────────────

/**
 * Normalize an edit into a grouping key based on its subType.
 *
 * SubType-aware strategy:
 * - CUT_FILLER: exact deleted text (filler words genuinely repeat)
 * - SHOW_DONT_TELL: matched abstract-indicator pattern (groups "felt a sense of X" variants)
 * - SENSORY_ADDED: matched sensory word (groups by modality)
 * - BEAT_ADDED: matched beat verb (groups by gesture type)
 * - CUT_PASSAGE / TONE_SHIFT / DIALOGUE_VOICE: sentinel key (unique prose won't repeat)
 * - REORDER: "reorder"
 */
export function normalizePatternKey(edit: EditPattern): string {
  switch (edit.subType) {
    case "CUT_FILLER":
      return edit.originalText.toLowerCase().trim();
    case "CUT_PASSAGE":
      return "_cut_passage_";
    case "SHOW_DONT_TELL":
      return extractAbstractIndicator(edit.originalText) ?? "_show_dont_tell_";
    case "SENSORY_ADDED":
      return extractSensoryWord(edit.editedText) ?? "_sensory_added_";
    case "BEAT_ADDED":
      return extractBeatVerb(edit.editedText) ?? "_beat_added_";
    case "TONE_SHIFT":
      return "_tone_shift_";
    case "DIALOGUE_VOICE":
      return "_dialogue_voice_";
    case "REORDER":
      return "reorder";
  }
}

/**
 * Group edit patterns by (subType, normalizedKey) and compute
 * weighted occurrence counts and Wilson confidence intervals.
 *
 * Confidence is computed per-subType: what fraction of edits of the same
 * subType does this specific pattern represent? This gives meaningful
 * proportions even at small sample sizes.
 */
export function groupPatterns(edits: EditPattern[], sceneOrder: Map<string, number>): PatternGroup[] {
  // Count total edits per subType for Wilson denominator
  const subTypeTotals = new Map<string, number>();
  for (const edit of edits) {
    subTypeTotals.set(edit.subType, (subTypeTotals.get(edit.subType) ?? 0) + 1);
  }

  // Group by composite key
  const groups = new Map<string, EditPattern[]>();
  for (const edit of edits) {
    const key = `${edit.subType}::${normalizePatternKey(edit)}`;
    const group = groups.get(key);
    if (group) {
      group.push(edit);
    } else {
      groups.set(key, [edit]);
    }
  }

  const result: PatternGroup[] = [];
  for (const [compositeKey, groupEdits] of groups) {
    const [patternType, ...keyParts] = compositeKey.split("::");
    const key = keyParts.join("::");
    const weightedCount = computeWeightedCount(groupEdits, sceneOrder);
    // Use raw integer counts for Wilson (statistically valid), weighted counts for ranking
    const subTypeTotal = subTypeTotals.get(patternType!) ?? groupEdits.length;
    const confidence = wilsonLowerBound(groupEdits.length, Math.max(subTypeTotal, groupEdits.length));

    result.push({
      patternType: patternType as EditSubType,
      key,
      edits: groupEdits,
      weightedCount,
      confidence,
    });
  }

  // Sort by confidence descending, then by occurrence count
  result.sort((a, b) => b.confidence - a.confidence || b.weightedCount - a.weightedCount);
  return result;
}

// ─── Advisory Grouping ──────────────────────────

/**
 * Group edit patterns by subType only (no key), creating broader
 * advisory groups for coaching-style proposals.
 */
export function groupPatternsBySubType(edits: EditPattern[], sceneOrder: Map<string, number>): PatternGroup[] {
  const groups = new Map<EditSubType, EditPattern[]>();
  for (const edit of edits) {
    const group = groups.get(edit.subType);
    if (group) {
      group.push(edit);
    } else {
      groups.set(edit.subType, [edit]);
    }
  }

  const result: PatternGroup[] = [];
  for (const [subType, groupEdits] of groups) {
    const weightedCount = computeWeightedCount(groupEdits, sceneOrder);
    // Wilson denominator = total edits (how much of the user's editing is this subType?)
    const confidence = wilsonLowerBound(groupEdits.length, Math.max(edits.length, groupEdits.length));

    result.push({
      patternType: subType,
      key: `_${subType.toLowerCase()}_`,
      edits: groupEdits,
      weightedCount,
      confidence,
      advisory: true,
    });
  }

  return result.sort((a, b) => b.weightedCount - a.weightedCount);
}

// ─── Promotion Check ─────────────────────────────

/**
 * Check if a pattern group meets the promotion threshold.
 * Requires >= 5 weighted occurrences AND Wilson lower bound >= 0.60.
 */
export function meetsPromotionThreshold(group: PatternGroup): boolean {
  return group.weightedCount >= PROMOTION_MIN_OCCURRENCES && group.confidence >= PROMOTION_MIN_CONFIDENCE;
}

/**
 * Check if an advisory (subType-level) group meets the softer advisory threshold.
 * Requires >= 8 weighted occurrences AND edits from >= 2 different scenes.
 */
export function meetsAdvisoryThreshold(group: PatternGroup): boolean {
  const sceneIds = new Set(group.edits.map((e) => e.sceneId));
  return group.weightedCount >= ADVISORY_MIN_WEIGHTED_COUNT && sceneIds.size >= ADVISORY_MIN_SCENE_COUNT;
}

// ─── Action Mapping ──────────────────────────────

/**
 * Map a pattern group to a proposed bible modification action.
 * Advisory groups get coaching-style actions.
 */
export function mapToProposedAction(group: PatternGroup): ProposedAction | null {
  if (group.advisory) {
    return mapAdvisoryAction(group);
  }
  switch (group.patternType) {
    case "CUT_FILLER":
      return { target: "killList", value: group.key };
    case "DIALOGUE_VOICE":
      return { target: "characters.voiceNotes", value: `Tends to edit dialogue: "${group.key}"` };
    case "SHOW_DONT_TELL":
      return { target: "suggestedTone.exemplars", value: group.key };
    case "SENSORY_ADDED":
      return { target: "locations.sensoryPalette", value: group.key };
    case "BEAT_ADDED":
      return { target: "characters.emotionPhysicality", value: group.key };
    case "TONE_SHIFT":
      return { target: "suggestedTone.metaphoricDomains", value: group.key };
    case "CUT_PASSAGE":
      return { target: "compilationNotes", value: `Frequently cuts passages like: "${group.key.slice(0, 80)}"` };
    case "REORDER":
      return { target: "compilationNotes", value: "Frequently reorders sentences within paragraphs" };
    default:
      return null;
  }
}

function mapAdvisoryAction(group: PatternGroup): ProposedAction {
  const n = Math.round(group.weightedCount);
  const scenes = new Set(group.edits.map((e) => e.sceneId)).size;
  const evidence = `(${n} edits across ${scenes} scene${scenes > 1 ? "s" : ""})`;

  switch (group.patternType) {
    case "CUT_FILLER":
      return {
        target: "compilationNotes",
        value: `You frequently cut filler words — consider adding specific fillers to your kill list ${evidence}`,
      };
    case "CUT_PASSAGE":
      return {
        target: "compilationNotes",
        value: `You frequently cut entire passages — consider tightening prose generation ${evidence}`,
      };
    case "SHOW_DONT_TELL":
      return {
        target: "suggestedTone.exemplars",
        value: `Avoid abstract emotional telling (e.g. "felt a sense of…") — prefer concrete physical detail ${evidence}`,
      };
    case "SENSORY_ADDED":
      return {
        target: "compilationNotes",
        value: `You frequently add sensory details — consider requesting richer environmental descriptions ${evidence}`,
      };
    case "BEAT_ADDED":
      return {
        target: "compilationNotes",
        value: `You frequently add action beats — consider requesting more physical grounding ${evidence}`,
      };
    case "TONE_SHIFT":
      return {
        target: "compilationNotes",
        value: `You frequently adjust tone — consider refining voice guidance in your bible ${evidence}`,
      };
    case "DIALOGUE_VOICE":
      return {
        target: "compilationNotes",
        value: `Dialogue frequently revised — consider strengthening character voice definitions ${evidence}`,
      };
    case "REORDER":
      return {
        target: "compilationNotes",
        value: `You frequently reorder sentences — consider adjusting paragraph flow guidance ${evidence}`,
      };
  }
}

// ─── Main Accumulation Pipeline ──────────────────

/**
 * Given all edit patterns for a project, accumulate into learned patterns.
 *
 * Two-tier approach:
 * - **Tier 1 (keyed):** Groups by (subType, smartKey) with strict thresholds (≥5 occurrences, ≥60% Wilson).
 *   Produces specific, actionable proposals (e.g. add "well" to kill list).
 * - **Tier 2 (advisory):** Groups by subType only with softer thresholds (≥8 weighted, ≥2 scenes).
 *   Produces coaching-style proposals for subTypes not already covered by Tier 1.
 */
export function accumulatePatterns(edits: EditPattern[], sceneOrder: Map<string, number>): PatternGroup[] {
  // Tier 1: keyed groups with strict thresholds (exclude sentinel keys — they'd inject garbage)
  const keyedGroups = groupPatterns(edits, sceneOrder);
  const promoted = keyedGroups.filter((g) => meetsPromotionThreshold(g) && !SENTINEL_KEYS.has(g.key));

  // Tier 2: subType-level advisory groups — only for subTypes not already promoted
  const promotedSubTypes = new Set(promoted.map((g) => g.patternType));
  const advisory = groupPatternsBySubType(edits, sceneOrder).filter(
    (g) => !promotedSubTypes.has(g.patternType) && meetsAdvisoryThreshold(g),
  );

  return [...promoted, ...advisory];
}
