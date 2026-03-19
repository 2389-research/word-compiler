import { computeMetrics } from "../auditor/index.js";
import type { ProseMetrics, StyleDriftReport } from "../types/index.js";

// ─── Style Drift ─────────────────────────────────────────
//
// Measures how far the current scene's prose metrics have drifted
// from the chapter 1 baseline. Flags any metric drifting > 10%.

const DRIFT_THRESHOLD = 0.1; // 10% per SPEC.md §9

function pctDrift(baseline: number, current: number): number {
  if (baseline === 0) return 0;
  return Math.abs((current - baseline) / baseline);
}

export function computeStyleDrift(
  baselineSceneId: string,
  currentSceneId: string,
  baselineMetrics: ProseMetrics,
  currentMetrics: ProseMetrics,
): StyleDriftReport {
  const driftPercent = {
    avgSentenceLength: pctDrift(baselineMetrics.avgSentenceLength, currentMetrics.avgSentenceLength),
    sentenceLengthStdDev: pctDrift(baselineMetrics.sentenceLengthStdDev, currentMetrics.sentenceLengthStdDev),
    typeTokenRatio: pctDrift(baselineMetrics.typeTokenRatio, currentMetrics.typeTokenRatio),
    avgParagraphLength: pctDrift(baselineMetrics.avgParagraphLength, currentMetrics.avgParagraphLength),
  };

  const flaggedFields: string[] = [];
  for (const [field, drift] of Object.entries(driftPercent) as Array<[keyof typeof driftPercent, number]>) {
    if (drift > DRIFT_THRESHOLD) {
      flaggedFields.push(field);
    }
  }

  return {
    baselineSceneId,
    currentSceneId,
    baselineMetrics,
    currentMetrics,
    driftPercent,
    flagged: flaggedFields.length > 0,
    flaggedFields,
  };
}

export function computeStyleDriftFromProse(
  baselineSceneId: string,
  baselineProse: string,
  currentSceneId: string,
  currentProse: string,
): StyleDriftReport {
  const baselineMetrics = computeMetrics(baselineProse);
  const currentMetrics = computeMetrics(currentProse);
  return computeStyleDrift(baselineSceneId, currentSceneId, baselineMetrics, currentMetrics);
}
