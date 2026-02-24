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

/** Check if a character is a quote character (straight or curly). */
function isQuoteChar(ch: string): boolean {
  return ch === '"' || ch === "\u201C" || ch === "\u201D";
}

/** Detect whether the current period is part of an ellipsis. */
function isEllipsis(ch: string, next: string, prev: string | undefined): boolean {
  return ch === "." && (next === "." || prev === ".");
}

/** Detect whether the current period follows a known abbreviation. */
function isAbbreviationPeriod(ch: string, current: string): boolean {
  if (ch !== ".") return false;
  const wordBefore = current.slice(0, -1).split(/\s/).pop()?.toLowerCase() ?? "";
  return ABBREVIATIONS.has(wordBefore);
}

/** Check if the character after punctuation indicates a valid sentence boundary. */
function isBoundaryFollower(next: string): boolean {
  return /\s/.test(next) || next === "" || next === '"' || next === "\u201C";
}

/** Check if a character is sentence-ending punctuation. */
function isSentenceEndPunctuation(ch: string): boolean {
  return ch === "." || ch === "!" || ch === "?";
}

/** Determine if the punctuation at position i marks a real sentence boundary. */
function isSentenceBoundary(ch: string, next: string, prev: string | undefined, current: string): boolean {
  if (!isSentenceEndPunctuation(ch)) return false;
  if (isEllipsis(ch, next, prev)) return false;
  if (isAbbreviationPeriod(ch, current)) return false;
  return isBoundaryFollower(next);
}

/** Push trimmed text to the sentences array if non-empty. */
function pushIfNonEmpty(sentences: string[], text: string): void {
  const trimmed = text.trim();
  if (trimmed) sentences.push(trimmed);
}

/** Segment a single paragraph into sentences, respecting quote boundaries. */
function segmentParagraph(para: string): string[] {
  const sentences: string[] = [];
  let inQuote = false;
  let current = "";

  for (let i = 0; i < para.length; i++) {
    const ch = para[i]!;

    if (isQuoteChar(ch)) {
      inQuote = !inQuote;
      current += ch;
      continue;
    }

    current += ch;

    if (inQuote) continue;

    if (isSentenceBoundary(ch, para[i + 1] ?? "", para[i - 1], current)) {
      pushIfNonEmpty(sentences, current);
      current = "";
    }
  }

  pushIfNonEmpty(sentences, current);
  return sentences;
}

/**
 * Split prose into sentences, respecting dialogue boundaries.
 * Quoted text is kept together even if it contains sentence-ending punctuation.
 * Paragraph breaks (double newlines) are preserved as empty string delimiters.
 */
export function segmentSentences(text: string): string[] {
  if (!text.trim()) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const sentences: string[] = [];

  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) sentences.push(""); // paragraph delimiter

    const para = paragraphs[p]!.trim();
    if (!para) continue;

    for (const s of segmentParagraph(para)) {
      sentences.push(s);
    }
  }

  return sentences;
}

// ─── Myers Diff (Simplified) ─────────────────────

/** Build the LCS dynamic-programming table for two sentence arrays. */
function buildLCSTable(original: string[], edited: string[]): number[][] {
  const m = original.length;
  const n = edited.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === edited[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp;
}

/** Backtrack through the LCS table to produce raw diff operations (in reverse). */
function backtrackLCS(dp: number[][], original: string[], edited: string[]): DiffResult[] {
  let i = original.length;
  let j = edited.length;
  const ops: DiffResult[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === edited[j - 1]) {
      ops.push({ type: "match", original: original[i - 1]!, edited: edited[j - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ type: "insert", original: null, edited: edited[j - 1]! });
      j--;
    } else {
      ops.push({ type: "delete", original: original[i - 1]!, edited: null });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

/** Merge adjacent delete+insert pairs into "modify" when the sentences are similar. */
function mergeAdjacentOps(ops: DiffResult[]): DiffResult[] {
  const results: DiffResult[] = [];

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

/**
 * Compute sentence-level diff between original and edited text.
 * Uses a simplified LCS-based approach for sentence matching.
 */
export function diffSentences(originalSentences: string[], editedSentences: string[]): DiffResult[] {
  const dp = buildLCSTable(originalSentences, editedSentences);
  const ops = backtrackLCS(dp, originalSentences, editedSentences);
  return mergeAdjacentOps(ops);
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

/** Classify an insert diff by content (sensory detail or action beat). */
function classifyInsert(edited: string): { editType: EditCategory; subType: EditSubType } {
  const lowerEdited = edited.toLowerCase();
  const hasSensory = [...SENSORY_WORDS].some((w) => lowerEdited.includes(w));
  if (hasSensory) return { editType: "ADDITION", subType: "SENSORY_ADDED" };

  const isBeat = BEAT_PATTERNS.some((p) => p.test(edited));
  if (isBeat) return { editType: "ADDITION", subType: "BEAT_ADDED" };

  return { editType: "ADDITION", subType: "SENSORY_ADDED" };
}

/** Classify a modify diff by examining dialogue, show-don't-tell, or tone shift. */
function classifyModify(original: string, edited: string): { editType: EditCategory; subType: EditSubType } {
  const isDialogue = /[""\u201C\u201D]/.test(original) || /[""\u201C\u201D]/.test(edited);
  if (isDialogue) return { editType: "SUBSTITUTION", subType: "DIALOGUE_VOICE" };

  const originalAbstract = ABSTRACT_INDICATORS.some((p) => p.test(original));
  if (originalAbstract) return { editType: "SUBSTITUTION", subType: "SHOW_DONT_TELL" };

  return { editType: "SUBSTITUTION", subType: "TONE_SHIFT" };
}

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
    return classifyInsert(diff.edited);
  }

  if (diff.type === "modify" && diff.original && diff.edited) {
    return classifyModify(diff.original, diff.edited);
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

/** Build surrounding context string for a diff at the given index. */
function buildEditContext(diffs: DiffResult[], index: number): string | null {
  const contextParts: string[] = [];
  if (index > 0 && diffs[index - 1]?.original) {
    contextParts.push(diffs[index - 1]!.original!);
  }
  if (index + 1 < diffs.length && (diffs[index + 1]?.original || diffs[index + 1]?.edited)) {
    contextParts.push(diffs[index + 1]!.original ?? diffs[index + 1]!.edited!);
  }
  return contextParts.length > 0 ? contextParts.join(" ... ") : null;
}

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

    patterns.push({
      id: generateId(),
      chunkId,
      sceneId,
      projectId,
      editType,
      subType,
      originalText: diff.original ?? "",
      editedText: diff.edited ?? "",
      context: buildEditContext(diffs, i),
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
