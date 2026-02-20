import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import StyleDriftPanel from "../../src/app/components/StyleDriftPanel.svelte";
import type { ProseMetrics, StyleDriftReport } from "../../src/types/index.js";

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

function makeReport(currentSceneId: string, flagged = false): StyleDriftReport {
  const baseline = makeMetrics();
  const current = flagged ? makeMetrics({ avgSentenceLength: 20 }) : baseline;
  return {
    baselineSceneId: "scene-baseline",
    currentSceneId,
    baselineMetrics: baseline,
    currentMetrics: current,
    driftPercent: {
      avgSentenceLength: flagged ? 0.6 : 0,
      sentenceLengthVariance: 0,
      typeTokenRatio: 0,
      avgParagraphLength: 0,
    },
    flagged,
    flaggedFields: flagged ? ["avgSentenceLength"] : [],
  };
}

describe("StyleDriftPanel", () => {
  it("shows empty state when no reports", () => {
    render(StyleDriftPanel, { reports: [], baselineSceneTitle: "Scene 1" });
    expect(screen.getByText(/No drift data/)).toBeInTheDocument();
  });

  it("renders baseline scene title", () => {
    const reports = [makeReport("scene-2")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Opening Scene" });
    expect(screen.getByText(/Opening Scene/)).toBeInTheDocument();
  });

  it("shows OK status for non-flagged report", () => {
    const reports = [makeReport("scene-2", false)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1" });
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("shows Flagged status for flagged report", () => {
    const reports = [makeReport("scene-2", true)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1" });
    expect(screen.getByText("Flagged")).toBeInTheDocument();
  });

  it("renders multiple reports as table rows", () => {
    const reports = [makeReport("scene-2"), makeReport("scene-3")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1" });
    const okCells = screen.getAllByText("OK");
    expect(okCells).toHaveLength(2);
  });

  it("renders threshold note", () => {
    const reports = [makeReport("scene-2")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1" });
    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });
});
