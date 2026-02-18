import { describe, expect, it } from "vitest";
import { computeStyleDrift, computeStyleDriftFromProse } from "../../src/metrics/styleDrift.js";
import type { ProseMetrics } from "../../src/types/index.js";

function makeMetrics(overrides: Partial<ProseMetrics> = {}): ProseMetrics {
  return {
    wordCount: 500,
    sentenceCount: 40,
    avgSentenceLength: 12.5,
    sentenceLengthVariance: 4.2,
    typeTokenRatio: 0.65,
    paragraphCount: 10,
    avgParagraphLength: 4.0,
    ...overrides,
  };
}

describe("computeStyleDrift", () => {
  it("returns zero drift for identical metrics", () => {
    const baseline = makeMetrics();
    const report = computeStyleDrift("s1", "s2", baseline, baseline);
    expect(report.flagged).toBe(false);
    expect(report.flaggedFields).toHaveLength(0);
    expect(report.driftPercent.avgSentenceLength).toBe(0);
  });

  it("flags avgSentenceLength when drift exceeds 10%", () => {
    const baseline = makeMetrics({ avgSentenceLength: 12.0 });
    const current = makeMetrics({ avgSentenceLength: 14.0 }); // ~16.7% drift
    const report = computeStyleDrift("s1", "s2", baseline, current);
    expect(report.flagged).toBe(true);
    expect(report.flaggedFields).toContain("avgSentenceLength");
  });

  it("does not flag when drift is under 10%", () => {
    const baseline = makeMetrics({ avgSentenceLength: 12.0 });
    const current = makeMetrics({ avgSentenceLength: 12.9 }); // 7.5% drift
    const report = computeStyleDrift("s1", "s2", baseline, current);
    expect(report.flaggedFields).not.toContain("avgSentenceLength");
  });

  it("flags typeTokenRatio when drift exceeds 10%", () => {
    const baseline = makeMetrics({ typeTokenRatio: 0.6 });
    const current = makeMetrics({ typeTokenRatio: 0.4 }); // 33% drift
    const report = computeStyleDrift("s1", "s2", baseline, current);
    expect(report.flaggedFields).toContain("typeTokenRatio");
  });

  it("correctly records baseline and current scene IDs", () => {
    const baseline = makeMetrics();
    const current = makeMetrics();
    const report = computeStyleDrift("baseline-scene", "current-scene", baseline, current);
    expect(report.baselineSceneId).toBe("baseline-scene");
    expect(report.currentSceneId).toBe("current-scene");
  });

  it("handles zero baseline gracefully (no division by zero)", () => {
    const baseline = makeMetrics({ avgSentenceLength: 0 });
    const current = makeMetrics({ avgSentenceLength: 12 });
    const report = computeStyleDrift("s1", "s2", baseline, current);
    expect(report.driftPercent.avgSentenceLength).toBe(0); // Zero baseline → 0 drift
  });

  it("flags multiple fields simultaneously", () => {
    const baseline = makeMetrics({ avgSentenceLength: 10, typeTokenRatio: 0.8 });
    const current = makeMetrics({ avgSentenceLength: 15, typeTokenRatio: 0.4 });
    const report = computeStyleDrift("s1", "s2", baseline, current);
    expect(report.flaggedFields).toContain("avgSentenceLength");
    expect(report.flaggedFields).toContain("typeTokenRatio");
    expect(report.flaggedFields.length).toBeGreaterThanOrEqual(2);
  });
});

describe("computeStyleDriftFromProse", () => {
  const BASE_PROSE = `She walked into the room. The door creaked behind her. Nothing moved.
She crossed to the window. Outside, the street was empty. She had expected that.
The coffee cup was still warm. She touched it once, then pulled her hand away.`;

  it("computes drift from two prose samples", () => {
    const report = computeStyleDriftFromProse("s1", BASE_PROSE, "s2", BASE_PROSE);
    expect(report.flagged).toBe(false); // identical prose
    expect(report.driftPercent.avgSentenceLength).toBe(0);
  });

  it("detects drift in a very different prose style", () => {
    const radicallyDifferent = `In the vast, sprawling expanse of the urban landscape, with its multitudinous towers rising like ancient monuments to human ambition and commercial enterprise, she found herself standing at the threshold of a decision that would, in all likelihood, reshape the contours of her existence in ways both foreseeable and utterly beyond imagination.`;
    const report = computeStyleDriftFromProse("s1", BASE_PROSE, "s2", radicallyDifferent);
    expect(report.baselineMetrics.avgSentenceLength).toBeLessThan(10);
    expect(report.currentMetrics.avgSentenceLength).toBeGreaterThan(20);
    expect(report.flagged).toBe(true);
  });
});
