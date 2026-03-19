import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import StyleDriftPanel from "../../src/app/components/StyleDriftPanel.svelte";
import type { ProseMetrics, StyleDriftReport } from "../../src/types/index.js";

function makeMetrics(overrides: Partial<ProseMetrics> = {}): ProseMetrics {
  return {
    wordCount: 500,
    sentenceCount: 40,
    avgSentenceLength: 12.5,
    sentenceLengthStdDev: 4.2,
    typeTokenRatio: 0.65,
    paragraphCount: 10,
    avgParagraphLength: 4.0,
    ...overrides,
  };
}

function makeReport(currentSceneId: string, flagged = false): StyleDriftReport {
  const baseline = makeMetrics();
  const current = flagged ? makeMetrics({ avgSentenceLength: 20, avgParagraphLength: 5.5 }) : baseline;
  return {
    baselineSceneId: "scene-baseline",
    currentSceneId,
    baselineMetrics: baseline,
    currentMetrics: current,
    driftPercent: {
      avgSentenceLength: flagged ? 0.6 : 0,
      sentenceLengthStdDev: 0,
      typeTokenRatio: 0,
      avgParagraphLength: flagged ? 0.375 : 0,
    },
    flagged,
    flaggedFields: flagged ? ["avgSentenceLength", "avgParagraphLength"] : [],
  };
}

const defaultTitles: Record<string, string> = {
  "scene-2": "Pattern Recognition",
  "scene-3": "Echo Location",
};

describe("StyleDriftPanel", () => {
  it("shows empty state when no reports", () => {
    render(StyleDriftPanel, { reports: [], baselineSceneTitle: "Scene 1", sceneTitles: {} });
    expect(screen.getByText(/Complete at least 2 scenes/)).toBeInTheDocument();
  });

  it("renders baseline scene title in header", () => {
    const reports = [makeReport("scene-2")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Opening Scene", sceneTitles: defaultTitles });
    expect(screen.getByText("vs. Opening Scene")).toBeInTheDocument();
  });

  it("shows scene title on card", () => {
    const reports = [makeReport("scene-2")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    expect(screen.getByText("Pattern Recognition")).toBeInTheDocument();
  });

  it("shows Consistent badge for non-flagged report", () => {
    const reports = [makeReport("scene-2", false)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    const badges = screen.getAllByText("Consistent");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Drifting badge for flagged report", () => {
    const reports = [makeReport("scene-2", true)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    expect(screen.getByText("Drifting")).toBeInTheDocument();
  });

  it("shows human-readable metric labels", () => {
    const reports = [makeReport("scene-2", true)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    expect(screen.getByText("Sentence length")).toBeInTheDocument();
    expect(screen.getByText("Sentence rhythm")).toBeInTheDocument();
    expect(screen.getByText("Vocabulary range")).toBeInTheDocument();
    expect(screen.getByText("Paragraph size")).toBeInTheDocument();
  });

  it("shows drift direction for flagged metrics", () => {
    const reports = [makeReport("scene-2", true)];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    expect(screen.getByText(/longer sentences/)).toBeInTheDocument();
    expect(screen.getByText(/longer paragraphs/)).toBeInTheDocument();
  });

  it("renders multiple scene cards", () => {
    const reports = [makeReport("scene-2"), makeReport("scene-3")];
    render(StyleDriftPanel, { reports, baselineSceneTitle: "Scene 1", sceneTitles: defaultTitles });
    expect(screen.getByText("Pattern Recognition")).toBeInTheDocument();
    expect(screen.getByText("Echo Location")).toBeInTheDocument();
  });
});
