import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import VoiceSeparabilityView from "../../src/app/components/VoiceSeparabilityView.svelte";
import type { VoiceSeparabilityReport } from "../../src/types/index.js";

function makeReport(overrides: Partial<VoiceSeparabilityReport> = {}): VoiceSeparabilityReport {
  return {
    separable: true,
    interCharacterVariance: 3.5,
    detail: "Voices are distinguishable.",
    characterStats: [
      {
        characterId: "char-1",
        characterName: "Alice",
        dialogueCount: 12,
        avgSentenceLength: 8.5,
        sentenceLengthStdDev: 2.1,
        typeTokenRatio: 0.72,
      },
      {
        characterId: "char-2",
        characterName: "Bob",
        dialogueCount: 8,
        avgSentenceLength: 14.2,
        sentenceLengthStdDev: 3.8,
        typeTokenRatio: 0.61,
      },
    ],
    ...overrides,
  };
}

describe("VoiceSeparabilityView", () => {
  it("shows empty state when no report", () => {
    render(VoiceSeparabilityView, { report: null });
    expect(screen.getByText(/No voice separability data/)).toBeInTheDocument();
  });

  it("shows 'Voices distinguishable' for separable report", () => {
    render(VoiceSeparabilityView, { report: makeReport({ separable: true }) });
    expect(screen.getByText("Voices distinguishable")).toBeInTheDocument();
  });

  it("shows 'Voices may be indistinguishable' for non-separable report", () => {
    render(VoiceSeparabilityView, { report: makeReport({ separable: false }) });
    expect(screen.getByText("Voices may be indistinguishable")).toBeInTheDocument();
  });

  it("renders character stats table", () => {
    render(VoiceSeparabilityView, { report: makeReport() });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows inter-character variance", () => {
    render(VoiceSeparabilityView, { report: makeReport({ interCharacterVariance: 3.5 }) });
    expect(screen.getByText(/3\.50/)).toBeInTheDocument();
  });

  it("shows detail message", () => {
    render(VoiceSeparabilityView, { report: makeReport({ detail: "Custom detail message" }) });
    expect(screen.getByText("Custom detail message")).toBeInTheDocument();
  });
});
