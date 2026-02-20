import { generateId } from "../types/index.js";

// ─── Types ───────────────────────────────────────

export type EditCategory = "DELETION" | "SUBSTITUTION" | "ADDITION" | "RESTRUCTURE";

export type EditSubType =
  | "CUT_FILLER"
  | "CUT_PASSAGE"
  | "TONE_SHIFT"
  | "DIALOGUE_VOICE"
  | "SHOW_DONT_TELL"
  | "BEAT_ADDED"
  | "SENSORY_ADDED"
  | "REORDER";

export interface EditPattern {
  id: string;
  chunkId: string;
  sceneId: string;
  projectId: string;
  editType: EditCategory;
  subType: EditSubType;
  originalText: string;
  editedText: string;
  context: string | null;
  createdAt: string;
}

export interface DiffResult {
  type: "match" | "delete" | "insert" | "modify";
  original: string | null;
  edited: string | null;
}

// ─── Sentence Segmentation ───────────────────────

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "ave",
  "blvd",
  "vs",
  "etc",
  "inc",
  "ltd",
  "dept",
  "approx",
  "est",
  "govt",
]);

/**
 * Split prose into sentences, respecting dialogue boundaries.
 * Quoted text is kept together even if it contains sentence-ending punctuation.
 * Paragraph breaks (double newlines) are preserved as empty string delimiters.
 */
export function segmentSentences(text: string): string[] {
  if (!text.trim()) return [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  const sentences: string[] = [];

  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) sentences.push(""); // paragraph delimiter

    const para = paragraphs[p]!.trim();
    if (!para) continue;

    // Process character by character to respect quotes
    let inQuote = false;
    let current = "";

    for (let i = 0; i < para.length; i++) {
      const ch = para[i]!;
      const next = para[i + 1] ?? "";

      // Track quote state (handle both straight and curly quotes)
      if (ch === '"' || ch === "\u201C" || ch === "\u201D") {
        inQuote = !inQuote;
        current += ch;
        continue;
      }

      current += ch;

      // Only split on sentence-ending punctuation outside quotes
      if (!inQuote && (ch === "." || ch === "!" || ch === "?")) {
        // Check for ellipsis
        if (ch === "." && (next === "." || para[i - 1] === ".")) continue;

        // Check for abbreviation (word before period is in abbreviation list)
        if (ch === ".") {
          const wordBefore = current.slice(0, -1).split(/\s/).pop()?.toLowerCase() ?? "";
          if (ABBREVIATIONS.has(wordBefore)) continue;
        }

        // Check if followed by whitespace or end of text (valid sentence boundary)
        if (/\s/.test(next) || next === "" || next === '"' || next === "\u201C") {
          const trimmed = current.trim();
          if (trimmed) sentences.push(trimmed);
          current = "";
        }
      }
    }

    const trimmed = current.trim();
    if (trimmed) sentences.push(trimmed);
  }

  return sentences;
}

// ─── Myers Diff (Simplified) ─────────────────────

/**
 * Compute sentence-level diff between original and edited text.
 * Uses a simplified LCS-based approach for sentence matching.
 */
export function diffSentences(originalSentences: string[], editedSentences: string[]): DiffResult[] {
  const results: DiffResult[] = [];

  // Build LCS table
  const m = originalSentences.length;
  const n = editedSentences.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalSentences[i - 1] === editedSentences[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;
  const ops: DiffResult[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalSentences[i - 1] === editedSentences[j - 1]) {
      ops.push({ type: "match", original: originalSentences[i - 1]!, edited: editedSentences[j - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: "insert", original: null, edited: editedSentences[j - 1]! });
      j--;
    } else {
      ops.push({ type: "delete", original: originalSentences[i - 1]!, edited: null });
      i--;
    }
  }

  ops.reverse();

  // Post-process: merge adjacent delete+insert into "modify" when similar
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]!;
    if (op.type === "delete" && k + 1 < ops.length && ops[k + 1]!.type === "insert") {
      const next = ops[k + 1]!;
      const similarity = computeSimilarity(op.original!, next.edited!);
      if (similarity >= 0.4) {
        results.push({ type: "modify", original: op.original, edited: next.edited });
        k++; // skip next
        continue;
      }
    }
    results.push(op);
  }

  return results;
}

// ─── Edit Classification ─────────────────────────

const SENSORY_WORDS = new Set([
  "smell",
  "scent",
  "aroma",
  "fragrance",
  "stench",
  "odor",
  "taste",
  "flavor",
  "bitter",
  "sweet",
  "sour",
  "salty",
  "touch",
  "texture",
  "rough",
  "smooth",
  "soft",
  "hard",
  "warm",
  "cold",
  "sound",
  "noise",
  "echo",
  "whisper",
  "roar",
  "hum",
  "buzz",
  "light",
  "shadow",
  "glow",
  "shimmer",
  "gleam",
  "dim",
  "bright",
]);

const BEAT_PATTERNS = [
  /\b(shrugged|nodded|sighed|smiled|frowned|winced|shook|leaned|shifted|crossed|uncrossed|folded|rubbed|tapped|drummed|clenched|relaxed)\b/i,
  /\b(hands|fingers|eyes|jaw|shoulders|arms|legs|feet|brow|lips)\b.*\b(moved|tightened|softened|dropped|rose|lifted|fell)\b/i,
];

const ABSTRACT_INDICATORS = [
  /\bfelt (a sense of|an overwhelming|a deep|the weight of)\b/i,
  /\bwas (happy|sad|angry|afraid|nervous|excited|overwhelmed)\b/i,
  /\b(realized|understood|knew) that\b/i,
];

/**
 * Classify a single edit into the taxonomy.
 * For "modify" diffs, examines the nature of the change.
 * For pure "delete" or "insert", classifies by content.
 */
export function classifyEdit(diff: DiffResult): { editType: EditCategory; subType: EditSubType } {
  if (diff.type === "delete" && diff.original) {
    const words = diff.original.split(/\s+/).length;
    if (words <= 5) return { editType: "DELETION", subType: "CUT_FILLER" };
    return { editType: "DELETION", subType: "CUT_PASSAGE" };
  }

  if (diff.type === "insert" && diff.edited) {
    // Check for sensory detail
    const lowerEdited = diff.edited.toLowerCase();
    const hasSensory = [...SENSORY_WORDS].some((w) => lowerEdited.includes(w));
    if (hasSensory) return { editType: "ADDITION", subType: "SENSORY_ADDED" };

    // Check for action beat
    const isBeat = BEAT_PATTERNS.some((p) => p.test(diff.edited!));
    if (isBeat) return { editType: "ADDITION", subType: "BEAT_ADDED" };

    return { editType: "ADDITION", subType: "SENSORY_ADDED" };
  }

  if (diff.type === "modify" && diff.original && diff.edited) {
    // Check for dialogue (either side has quotes)
    const isDialogue = /[""\u201C\u201D]/.test(diff.original) || /[""\u201C\u201D]/.test(diff.edited);
    if (isDialogue) return { editType: "SUBSTITUTION", subType: "DIALOGUE_VOICE" };

    // Check for show-don't-tell (abstract original → concrete edited)
    const originalAbstract = ABSTRACT_INDICATORS.some((p) => p.test(diff.original!));
    if (originalAbstract) return { editType: "SUBSTITUTION", subType: "SHOW_DONT_TELL" };

    // Default substitution: tone shift
    return { editType: "SUBSTITUTION", subType: "TONE_SHIFT" };
  }

  // Fallback
  return { editType: "DELETION", subType: "CUT_PASSAGE" };
}

// ─── Reorder Detection ───────────────────────────

/**
 * Detect if edits are primarily sentence reordering within paragraphs.
 * If the same sentences appear in both but in different order, classify as RESTRUCTURE/REORDER.
 */
export function detectReorder(originalSentences: string[], editedSentences: string[]): boolean {
  if (originalSentences.length !== editedSentences.length) return false;
  const origSet = new Set(originalSentences.map((s) => s.toLowerCase()));
  const editSet = new Set(editedSentences.map((s) => s.toLowerCase()));
  if (origSet.size !== editSet.size) return false;
  for (const s of origSet) {
    if (!editSet.has(s)) return false;
  }
  // Same sentences, different order
  return originalSentences.some((s, i) => s.toLowerCase() !== editedSentences[i]?.toLowerCase());
}

// ─── Main Pipeline ───────────────────────────────

/**
 * Analyze edits between generated and edited text, returning classified patterns.
 */
export function analyzeEdits(
  generatedText: string,
  editedText: string,
  chunkId: string,
  sceneId: string,
  projectId: string,
): EditPattern[] {
  if (!editedText || generatedText === editedText) return [];

  const originalSentences = segmentSentences(generatedText).filter((s) => s !== "");
  const editedSentences = segmentSentences(editedText).filter((s) => s !== "");

  // Check for global reorder first
  if (detectReorder(originalSentences, editedSentences)) {
    return [
      {
        id: generateId(),
        chunkId,
        sceneId,
        projectId,
        editType: "RESTRUCTURE",
        subType: "REORDER",
        originalText: generatedText.slice(0, 200),
        editedText: editedText.slice(0, 200),
        context: null,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const diffs = diffSentences(originalSentences, editedSentences);
  const patterns: EditPattern[] = [];

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i]!;
    if (diff.type === "match") continue;

    const { editType, subType } = classifyEdit(diff);

    // Get surrounding context
    const contextParts: string[] = [];
    if (i > 0 && diffs[i - 1]?.original) contextParts.push(diffs[i - 1]!.original!);
    if (i + 1 < diffs.length && (diffs[i + 1]?.original || diffs[i + 1]?.edited)) {
      contextParts.push(diffs[i + 1]!.original ?? diffs[i + 1]!.edited!);
    }

    patterns.push({
      id: generateId(),
      chunkId,
      sceneId,
      projectId,
      editType,
      subType,
      originalText: diff.original ?? "",
      editedText: diff.edited ?? "",
      context: contextParts.length > 0 ? contextParts.join(" ... ") : null,
      createdAt: new Date().toISOString(),
    });
  }

  return patterns;
}

// ─── Utilities ───────────────────────────────────

/**
 * Compute similarity between two strings (0-1).
 * Uses character-level bigram overlap (Dice coefficient).
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2).toLowerCase();
    bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2).toLowerCase();
    const count = bigramsA.get(bigram) ?? 0;
    if (count > 0) {
      matches++;
      bigramsA.set(bigram, count - 1);
    }
  }

  return (2 * matches) / (a.length - 1 + b.length - 1);
}
