import type { Chunk, CompilationConfig } from "../types/index.js";
import { generateId } from "../types/index.js";

// ─── Types ───────────────────────────────────────

export interface TuningProposal {
  id: string;
  projectId: string;
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  rationale: string;
  confidence: number;
  evidence: TuningEvidence;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface TuningEvidence {
  editedChunkCount: number;
  sceneCount: number;
  avgEditRatio: number;
}

// ─── Levenshtein Distance ────────────────────────

/**
 * Standard DP implementation of Levenshtein edit distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two-row optimization to reduce memory from O(n*m) to O(min(n,m))
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] = 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}

// ─── Edit Ratio ─────────────────────────────────

/**
 * Compute the edit ratio for a chunk: levenshtein(generated, edited) / max(len(generated), len(edited), 1).
 * Returns a normalized 0..1 value. Returns 0 for chunks without edits.
 */
export function computeEditRatio(chunk: Chunk): number {
  if (chunk.editedText === null) return 0;
  if (chunk.generatedText === chunk.editedText) return 0;
  const dist = levenshteinDistance(chunk.generatedText, chunk.editedText);
  return dist / Math.max(chunk.generatedText.length, chunk.editedText.length, 1);
}

// ─── Constants ──────────────────────────────────

const MIN_EDITED_CHUNKS = 10;
const MIN_SCENES = 3;
const HIGH_EDIT_RATIO_THRESHOLD = 0.4;

// ─── Proposal Generation ────────────────────────

/**
 * Generate tuning proposals based on analysis of edited chunks.
 *
 * Gate: requires >= 10 edited chunks across >= 3 scenes.
 *
 * Checks:
 * - High edit ratio (> 40%) → suggest lower temperature
 * - Low edit ratio (< 10%) → positive signal (no change needed)
 * - Consistently short final vs target → suggest shorter chunk target
 */
export function generateTuningProposals(
  chunks: Chunk[],
  config: CompilationConfig,
  projectId: string,
): TuningProposal[] {
  // Gather edited chunks
  const editedChunks = chunks.filter((c) => c.editedText !== null && c.editedText !== c.generatedText);

  // Gate check
  const sceneIds = new Set(editedChunks.map((c) => c.sceneId));
  if (editedChunks.length < MIN_EDITED_CHUNKS || sceneIds.size < MIN_SCENES) {
    return [];
  }

  const ratios = editedChunks.map(computeEditRatio);
  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;

  const evidence: TuningEvidence = {
    editedChunkCount: editedChunks.length,
    sceneCount: sceneIds.size,
    avgEditRatio: avgRatio,
  };

  const proposals: TuningProposal[] = [];
  const now = new Date().toISOString();

  // High edit ratio → suggest lower temperature
  if (avgRatio > HIGH_EDIT_RATIO_THRESHOLD) {
    const currentTemp = config.defaultTemperature;
    const suggestedTemp = Math.max(0.3, currentTemp - 0.2);

    if (suggestedTemp < currentTemp) {
      proposals.push({
        id: generateId(),
        projectId,
        parameter: "defaultTemperature",
        currentValue: currentTemp,
        suggestedValue: Math.round(suggestedTemp * 100) / 100,
        rationale:
          `Average edit ratio is ${Math.round(avgRatio * 100)}% across ${editedChunks.length} chunks. ` +
          `Lowering temperature from ${currentTemp} to ${suggestedTemp.toFixed(2)} should produce prose closer to your preferred style.`,
        confidence: Math.min(0.9, 0.5 + avgRatio),
        evidence,
        status: "pending",
        createdAt: now,
      });
    }
  }

  // Check if chunks are consistently shorter than expected
  const chunksWithScenePlans = editedChunks.filter((c) => c.editedText);
  if (chunksWithScenePlans.length >= MIN_EDITED_CHUNKS) {
    const avgEditedLength =
      chunksWithScenePlans.reduce((sum, c) => sum + (c.editedText?.split(/\s+/).filter(Boolean).length ?? 0), 0) /
      chunksWithScenePlans.length;

    const avgGeneratedLength =
      chunksWithScenePlans.reduce((sum, c) => sum + c.generatedText.split(/\s+/).filter(Boolean).length, 0) /
      chunksWithScenePlans.length;

    // If edited text is consistently >20% shorter than generated
    if (avgGeneratedLength > 0 && avgEditedLength / avgGeneratedLength < 0.8) {
      proposals.push({
        id: generateId(),
        projectId,
        parameter: "reservedForOutput",
        currentValue: config.reservedForOutput,
        suggestedValue: Math.round(config.reservedForOutput * 0.85),
        rationale:
          `Edited chunks are on average ${Math.round((1 - avgEditedLength / avgGeneratedLength) * 100)}% shorter than generated text. ` +
          `Reducing output reservation may produce more concise chunks.`,
        confidence: 0.6,
        evidence,
        status: "pending",
        createdAt: now,
      });
    }
  }

  return proposals;
}
