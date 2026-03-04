// ─── Refinement Chips ──────────────────────────

export const REFINEMENT_CHIPS = [
  "word_choice",
  "rhythm",
  "pacing",
  "voice_drift",
  "too_expository",
  "cliche",
  "overwritten",
  "underwritten",
  "tone_mismatch",
  "cut_this",
] as const;

export type RefinementChip = (typeof REFINEMENT_CHIPS)[number];

export const REFINEMENT_CHIP_LABELS: Record<RefinementChip, string> = {
  word_choice: "Word Choice",
  rhythm: "Rhythm",
  pacing: "Pacing",
  voice_drift: "Voice Drift",
  too_expository: "Too Expository",
  cliche: "Clich\u00e9",
  overwritten: "Overwritten",
  underwritten: "Underwritten",
  tone_mismatch: "Tone Mismatch",
  cut_this: "Cut This",
};

// ─── State Machine ─────────────────────────────

export type RefinementState = "idle" | "selecting" | "loading" | "reviewing" | "cutting";

// ─── Request / Response ─────────────────────────

export interface RefinementRequest {
  sceneId: string;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  instruction: string;
  chips: RefinementChip[];
}

export interface RefinementVariant {
  text: string;
  rationale: string;
  adjustedBefore?: string;
  adjustedAfter?: string;
  killListClean: boolean;
  killListViolations: string[];
}

export interface RefinementResult {
  variants: RefinementVariant[];
  requestedAt: string;
  completedAt: string;
}

// ─── Continuous Text ────────────────────────────

export interface ChunkBoundary {
  chunkIndex: number;
  chunkId: string;
  startOffset: number;
  endOffset: number;
}

export interface ContinuousText {
  text: string;
  boundaries: ChunkBoundary[];
}

// ─── Factory ────────────────────────────────────

export function createRefinementRequest(
  sceneId: string,
  selectedText: string,
  selectionStart: number,
  selectionEnd: number,
  instruction: string,
  chips: RefinementChip[],
): RefinementRequest {
  if (selectionStart < 0) throw new RangeError(`selectionStart must be >= 0, got ${selectionStart}`);
  if (selectionEnd <= selectionStart) throw new RangeError("selectionEnd must be > selectionStart");
  return { sceneId, selectedText, selectionStart, selectionEnd, instruction, chips };
}
