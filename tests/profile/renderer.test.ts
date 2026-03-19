import { describe, expect, it } from "vitest";
import {
  extractCoreSensibility,
  renderChangelog,
  renderEditingFragment,
  renderGenerationFragment,
  renderVoiceGuideMd,
} from "@/profile/renderer.js";
import { createEmptyVoiceGuide } from "@/profile/types.js";

describe("renderGenerationFragment", () => {
  it("includes generation instructions and framing", () => {
    const guide = createEmptyVoiceGuide();
    guide.generationInstructions = "Write warmly and directly.";
    guide.narrativeSummary = "A warm, direct writer.";
    const fragment = renderGenerationFragment(guide);
    expect(fragment).toContain("Write in the voice described below");
    expect(fragment).toContain("Write warmly and directly.");
    expect(fragment).toContain("WHAT THIS WRITER DOESN'T DO");
    expect(fragment).toContain("FULL VOICE GUIDE");
  });

  it("lists avoidance patterns", () => {
    const guide = createEmptyVoiceGuide();
    guide.avoidancePatterns = [
      {
        featureName: "no hedging",
        description: "never hedges",
        documentCount: 2,
        totalDocuments: 2,
        evidenceExamples: [],
        confidence: "high",
        transferability: "transferable",
        transferabilityRationale: "",
        isAvoidancePattern: true,
        domainFilterDecision: "keep",
        filterRationale: "",
        needsNewObject: false,
        newObjectNote: null,
      },
    ];
    const fragment = renderGenerationFragment(guide);
    expect(fragment).toContain("no hedging: never hedges");
  });

  it("lists features needing new expression", () => {
    const guide = createEmptyVoiceGuide();
    guide.coreFeatures = [
      {
        featureName: "metaphor density",
        description: "uses dense metaphors",
        documentCount: 3,
        totalDocuments: 3,
        evidenceExamples: [],
        confidence: "high",
        transferability: "transferable",
        transferabilityRationale: "",
        isAvoidancePattern: false,
        domainFilterDecision: "keep",
        filterRationale: "",
        needsNewObject: true,
        newObjectNote: "journalism metaphors won't work in fiction",
      },
    ];
    const fragment = renderGenerationFragment(guide);
    expect(fragment).toContain("FEATURES NEEDING NEW EXPRESSION");
    expect(fragment).toContain("metaphor density");
    expect(fragment).toContain("journalism metaphors won't work in fiction");
  });
});

describe("renderEditingFragment", () => {
  it("includes core sensibility and editing instructions", () => {
    const guide = createEmptyVoiceGuide();
    guide.editingInstructions = "Check for cold passages.";
    guide.narrativeSummary = "1. THE CORE SENSIBILITY\nA warm, direct writer.\n\n2. WHAT THEY DO";
    const fragment = renderEditingFragment(guide);
    expect(fragment).toContain("CORE SENSIBILITY");
    expect(fragment).toContain("A warm, direct writer.");
    expect(fragment).toContain("Check for cold passages.");
    expect(fragment).toContain("EDITING CHECKLIST");
  });
});

describe("extractCoreSensibility", () => {
  it("extracts section 1 content", () => {
    const text = "1. THE CORE SENSIBILITY\nA warm writer who values precision.\n\n2. WHAT THEY DO\nDetails...";
    expect(extractCoreSensibility(text)).toContain("A warm writer");
    expect(extractCoreSensibility(text)).not.toContain("WHAT THEY DO");
  });
  it("falls back to first paragraph", () => {
    expect(extractCoreSensibility("Just a paragraph.\n\nSecond one.")).toBe("Just a paragraph.");
  });
});

describe("renderVoiceGuideMd", () => {
  it("returns the narrative summary", () => {
    const guide = createEmptyVoiceGuide();
    guide.narrativeSummary = "Full guide text here.";
    expect(renderVoiceGuideMd(guide)).toBe("Full guide text here.");
  });
});

describe("renderChangelog", () => {
  it("renders version history", () => {
    const guide = createEmptyVoiceGuide();
    guide.versionHistory = [
      {
        version: "1.0.0",
        updatedAt: "2024-01-01",
        changeReason: "initial",
        changeSummary: "First run",
        confirmedFeatures: ["warmth"],
        contradictedFeatures: [],
        newFeatures: ["warmth"],
      },
    ];
    const md = renderChangelog(guide);
    expect(md).toContain("# Voice Guide Changelog");
    expect(md).toContain("1.0.0");
    expect(md).toContain("initial");
    expect(md).toContain("warmth");
  });

  it("renders multiple versions", () => {
    const guide = createEmptyVoiceGuide();
    guide.versionHistory = [
      {
        version: "1.0.0",
        updatedAt: "2024-01-01",
        changeReason: "initial",
        changeSummary: "First run",
        confirmedFeatures: ["warmth"],
        contradictedFeatures: [],
        newFeatures: ["warmth"],
      },
      {
        version: "1.1.0",
        updatedAt: "2024-02-01",
        changeReason: "new samples",
        changeSummary: "Added humor",
        confirmedFeatures: ["warmth"],
        contradictedFeatures: ["formality"],
        newFeatures: ["humor"],
      },
    ];
    const md = renderChangelog(guide);
    expect(md).toContain("1.0.0");
    expect(md).toContain("1.1.0");
    expect(md).toContain("Contradicted: formality");
  });
});
