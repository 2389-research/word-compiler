import type { Bible, NarrativeIR, ScenePlan } from "../types/index.js";

export interface ReaderState {
  knownFacts: Set<string>;
  suspicions: Set<string>;
  unresolvedTensions: Set<string>;
  wrongBeliefs: Set<string>;
}

export interface SceneReaderState {
  sceneId: string;
  sceneOrder: number;
  state: ReaderState;
  /** Facts newly revealed in this scene */
  newFacts: string[];
  /** Tensions newly introduced in this scene */
  newTensions: string[];
  /** Tensions resolved by this scene */
  resolvedTensions: string[];
  /** Setups planted in this scene */
  setupsPlanted: string[];
  /** Payoffs executed in this scene */
  payoffsExecuted: string[];
}

export interface EpistemicWarning {
  sceneId: string;
  type: "knowledge_ahead" | "premature_setup_ref";
  message: string;
}

export interface SceneInput {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

function emptyState(): ReaderState {
  return {
    knownFacts: new Set(),
    suspicions: new Set(),
    unresolvedTensions: new Set(),
    wrongBeliefs: new Set(),
  };
}

/** Accumulate facts revealed to reader and track withheld facts as wrong beliefs. */
function accumulateFactsFromIR(ir: NarrativeIR, current: ReaderState): string[] {
  const newFacts: string[] = [];

  for (const fact of ir.factsRevealedToReader) {
    if (!current.knownFacts.has(fact)) {
      newFacts.push(fact);
      current.knownFacts.add(fact);
    }
  }

  // Track withheld facts as potential wrong beliefs
  for (const withheld of ir.factsWithheld) {
    current.wrongBeliefs.add(withheld);
  }

  // Remove wrong beliefs when facts are revealed
  for (const fact of ir.factsRevealedToReader) {
    current.wrongBeliefs.delete(fact);
  }

  return newFacts;
}

/** Accumulate suspicions from character deltas. */
function accumulateSuspicionsFromIR(ir: NarrativeIR, current: ReaderState): void {
  for (const delta of ir.characterDeltas) {
    if (delta.suspicionGained) {
      current.suspicions.add(delta.suspicionGained);
    }
  }
}

/** Track new tensions and detect resolved ones. */
function accumulateTensionsFromIR(
  ir: NarrativeIR,
  current: ReaderState,
): { newTensions: string[]; resolvedTensions: string[] } {
  const newTensions: string[] = [];
  const resolvedTensions: string[] = [];

  // Track tensions
  for (const tension of ir.unresolvedTensions) {
    if (!current.unresolvedTensions.has(tension)) {
      newTensions.push(tension);
      current.unresolvedTensions.add(tension);
    }
  }

  // Detect resolved tensions (were in cumulative set but not in current scene's list)
  const currentSceneTensions = new Set(ir.unresolvedTensions);
  for (const existing of current.unresolvedTensions) {
    if (!currentSceneTensions.has(existing) && !newTensions.includes(existing)) {
      // This tension was in the cumulative set but the scene's IR no longer lists it
      // Only count as resolved if it was in the previous cumulative state
      resolvedTensions.push(existing);
    }
  }
  for (const resolved of resolvedTensions) {
    current.unresolvedTensions.delete(resolved);
  }

  return { newTensions, resolvedTensions };
}

/**
 * Accumulate reader epistemic state across a sequence of scenes.
 * Only verified IRs contribute to state changes.
 */
export function accumulateReaderState(scenes: SceneInput[]): SceneReaderState[] {
  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);
  const results: SceneReaderState[] = [];
  const current = emptyState();

  for (const scene of sorted) {
    const ir = scene.ir;
    let newFacts: string[] = [];
    let newTensions: string[] = [];
    let resolvedTensions: string[] = [];
    let setupsPlanted: string[] = [];
    let payoffsExecuted: string[] = [];

    if (ir?.verified) {
      newFacts = accumulateFactsFromIR(ir, current);
      accumulateSuspicionsFromIR(ir, current);
      ({ newTensions, resolvedTensions } = accumulateTensionsFromIR(ir, current));

      // Track setups and payoffs
      setupsPlanted = [...ir.setupsPlanted];
      payoffsExecuted = [...ir.payoffsExecuted];
    }

    // Snapshot the current state (deep copy the Sets)
    results.push({
      sceneId: scene.plan.id,
      sceneOrder: scene.sceneOrder,
      state: {
        knownFacts: new Set(current.knownFacts),
        suspicions: new Set(current.suspicions),
        unresolvedTensions: new Set(current.unresolvedTensions),
        wrongBeliefs: new Set(current.wrongBeliefs),
      },
      newFacts,
      newTensions,
      resolvedTensions,
      setupsPlanted,
      payoffsExecuted,
    });
  }

  return results;
}

/** Resolve a character ID to a human-readable name via the bible. */
function resolveCharacterName(characterId: string, bible?: Bible): string {
  if (!bible) return `[${characterId}]`;
  const char = bible.characters.find((c) => c.id === characterId);
  return char ? char.name : `[unknown: ${characterId}]`;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "was",
  "are",
  "for",
  "not",
  "but",
  "has",
  "had",
  "his",
  "her",
  "its",
  "can",
  "did",
  "will",
  "from",
  "that",
  "this",
  "with",
  "they",
  "been",
  "have",
  "each",
  "which",
  "were",
  "then",
  "than",
  "into",
  "also",
  "some",
  "what",
  "when",
  "who",
  "how",
  "all",
  "out",
  "about",
  "would",
  "could",
  "should",
  "their",
  "there",
  "where",
  "being",
  "does",
  "more",
  "most",
  "very",
  "just",
  "only",
  "over",
]);

/** Extract meaningful keywords from a string (3+ chars, no stop words). */
function extractKeywords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/** Check if string `a` shares meaningful keywords with string `b`. */
function hasOverlap(a: string, b: string): boolean {
  const wordsA = extractKeywords(a);
  const wordsB = new Set(extractKeywords(b));

  // If either side has no meaningful keywords, fall back to substring check
  if (wordsA.length === 0 || wordsB.size === 0) {
    const normA = a.toLowerCase().trim();
    const normB = b.toLowerCase().trim();
    return normA.length > 0 && normB.length > 0 && (normA.includes(normB) || normB.includes(normA));
  }

  return wordsA.some((w) => wordsB.has(w));
}

/** Check if any character acts on knowledge explicitly withheld from the reader. */
function checkKnowledgeAhead(
  ir: NarrativeIR,
  withheldFacts: Set<string>,
  sceneId: string,
  bible?: Bible,
): EpistemicWarning[] {
  const warnings: EpistemicWarning[] = [];

  for (const delta of ir.characterDeltas) {
    if (delta.learned) {
      for (const withheld of withheldFacts) {
        if (hasOverlap(delta.learned, withheld)) {
          const name = resolveCharacterName(delta.characterId, bible);
          warnings.push({
            sceneId,
            type: "knowledge_ahead",
            message: `${name} acts on "${delta.learned}" — overlaps with withheld fact: "${withheld}"`,
          });
          break;
        }
      }
    }
  }

  return warnings;
}

/** Check if any payoff lacks a matching prior setup. */
function checkPrematurePayoff(ir: NarrativeIR, allSetups: Set<string>, sceneId: string): EpistemicWarning[] {
  const warnings: EpistemicWarning[] = [];

  for (const payoff of ir.payoffsExecuted) {
    const matchesSetup = [...allSetups].some((setup) => hasOverlap(payoff, setup));
    if (!matchesSetup) {
      warnings.push({
        sceneId,
        type: "premature_setup_ref",
        message: `Payoff "${payoff}" has no matching prior setup`,
      });
    }
  }

  return warnings;
}

/**
 * Detect epistemic inconsistencies across accumulated reader states.
 * Checks for: characters acting on explicitly withheld knowledge, unmatched payoffs.
 */
export function detectEpistemicIssues(
  scenes: SceneInput[],
  readerStates: SceneReaderState[],
  bible?: Bible,
): EpistemicWarning[] {
  const warnings: EpistemicWarning[] = [];
  const allSetups = new Set<string>();
  const readerStateIds = new Set(readerStates.map((rs) => rs.sceneId));
  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);

  // Cumulative withheld facts across all prior scenes
  const withheldFacts = new Set<string>();

  for (const scene of sorted) {
    const ir = scene.ir;
    if (!ir || !ir.verified || !readerStateIds.has(scene.plan.id)) continue;

    // Update withheld set before checking deltas:
    // add new withheld facts, then remove any revealed in this scene
    for (const fact of ir.factsWithheld) {
      withheldFacts.add(fact);
    }
    for (const fact of ir.factsRevealedToReader) {
      withheldFacts.delete(fact);
    }

    warnings.push(...checkKnowledgeAhead(ir, withheldFacts, scene.plan.id, bible));
    warnings.push(...checkPrematurePayoff(ir, allSetups, scene.plan.id));

    // Accumulate setups for future payoff checks
    for (const setup of ir.setupsPlanted) {
      allSetups.add(setup);
    }
  }

  return warnings;
}
