import { describe, expect, it } from "vitest";
import { lintPayload } from "../../src/linter/index.js";
import type { Bible, CompilationConfig, Ring1Result, Ring3Result, ScenePlan } from "../../src/types/index.js";
import {
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
} from "../../src/types/index.js";

function makeR1(tokenCount: number): Ring1Result {
  return { text: "", sections: [], tokenCount, wasTruncated: false };
}

function makeR3(tokenCount: number): Ring3Result {
  return { text: "", sections: [], tokenCount };
}

function makeBible(overrides: Partial<Bible> = {}): Bible {
  return { ...createEmptyBible("test"), ...overrides };
}

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    title: "Test",
    povCharacterId: "marcus",
    failureModeToAvoid: "stated emotions",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<CompilationConfig> = {}): CompilationConfig {
  return { ...createDefaultCompilationConfig(), ...overrides };
}

describe("lintPayload", () => {
  it("clean payload returns no errors or warnings", () => {
    const marcus = {
      ...createEmptyCharacterDossier("Marcus"),
      id: "marcus",
      voice: {
        ...createEmptyCharacterDossier("Marcus").voice,
        dialogueSamples: ["Test line"],
      },
    };
    const bible = makeBible({
      characters: [marcus],
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [{ pattern: "test", type: "exact" as const }],
      },
    });
    const plan = makePlan({
      anchorLines: [{ text: "test", placement: "start", verbatim: true }],
    });

    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());

    const errors = result.issues.filter((i) => i.severity === "error");
    const warnings = result.issues.filter((i) => i.severity === "warning");
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("R1_OVER_CAP when ring1 exceeds hard cap", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const result = lintPayload(makeR1(3000), makeR3(100), makePlan(), bible, makeConfig({ ring1HardCap: 2000 }));
    expect(result.issues.some((i) => i.code === "R1_OVER_CAP")).toBe(true);
  });

  it("R3_STARVED when ring3 < 40% of used tokens", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    // R1=800, R3=100 → R3 fraction = 100/900 ≈ 11% — well under 40%
    const result = lintPayload(makeR1(800), makeR3(100), makePlan(), bible, makeConfig());
    expect(result.issues.some((i) => i.code === "R3_STARVED")).toBe(true);
  });

  it("NEG_EXEMPLAR_LONG when exemplar exceeds token cap", () => {
    const longText = Array(200).fill("word").join(" ");
    const bible = makeBible({
      characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }],
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        negativeExemplars: [{ text: longText, annotation: "too long" }],
      },
    });
    const result = lintPayload(makeR1(100), makeR3(100000), makePlan(), bible, makeConfig());
    expect(result.issues.some((i) => i.code === "NEG_EXEMPLAR_LONG")).toBe(true);
  });

  it("MISSING_VOICE_SAMPLES when speaking character has no samples", () => {
    const elena = { ...createEmptyCharacterDossier("Elena"), id: "elena" };
    const marcus = { ...createEmptyCharacterDossier("Marcus"), id: "marcus" };
    const bible = makeBible({ characters: [marcus, elena] });
    const plan = makePlan({ dialogueConstraints: { elena: ["Guarded"] } });
    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());
    expect(result.issues.some((i) => i.code === "MISSING_VOICE_SAMPLES")).toBe(true);
  });

  it("MISSING_SUBTEXT when 2+ speakers and no subtext", () => {
    const bible = makeBible({
      characters: [
        { ...createEmptyCharacterDossier("M"), id: "marcus" },
        { ...createEmptyCharacterDossier("E"), id: "elena" },
      ],
    });
    const plan = makePlan({
      dialogueConstraints: { marcus: [], elena: [] },
      subtext: null,
    });
    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());
    expect(result.issues.some((i) => i.code === "MISSING_SUBTEXT")).toBe(true);
  });

  it("NO_FAILURE_MODE when failureModeToAvoid is empty", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const plan = makePlan({ failureModeToAvoid: "" });
    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());
    expect(result.issues.some((i) => i.code === "NO_FAILURE_MODE")).toBe(true);
  });

  it("POV_CHAR_MISSING when POV character not in bible", () => {
    const bible = makeBible(); // no characters
    const result = lintPayload(makeR1(100), makeR3(100000), makePlan(), bible, makeConfig());
    expect(result.issues.some((i) => i.code === "POV_CHAR_MISSING")).toBe(true);
  });

  it("EMPTY_KILL_LIST when no kill list entries", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const result = lintPayload(makeR1(100), makeR3(100000), makePlan(), bible, makeConfig());
    expect(result.issues.some((i) => i.code === "EMPTY_KILL_LIST")).toBe(true);
  });

  it("NO_ANCHOR_LINES when no anchors", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const plan = makePlan({ anchorLines: [] });
    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());
    expect(result.issues.some((i) => i.code === "NO_ANCHOR_LINES")).toBe(true);
  });

  it("MISSING_LOCATION when locationId set but not found", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const plan = makePlan({ locationId: "nonexistent" });
    const result = lintPayload(makeR1(100), makeR3(100000), plan, bible, makeConfig());
    expect(result.issues.some((i) => i.code === "MISSING_LOCATION")).toBe(true);
  });

  it("R2_OVER_CAP when ring2 exceeds its fraction cap", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    const config = makeConfig({ ring2MaxFraction: 0.25, modelContextWindow: 200000, reservedForOutput: 2000 });
    const result = lintPayload(makeR1(100), makeR3(100000), makePlan(), bible, config, 50000);
    expect(result.issues.some((i) => i.code === "R2_OVER_CAP")).toBe(true);
  });

  it("TOTAL_OVER_BUDGET when total exceeds available", () => {
    const bible = makeBible({ characters: [{ ...createEmptyCharacterDossier("M"), id: "marcus" }] });
    // Available = 200000 - 2000 = 198000
    const result = lintPayload(makeR1(100000), makeR3(100000), makePlan(), bible, makeConfig());
    expect(result.issues.some((i) => i.code === "TOTAL_OVER_BUDGET")).toBe(true);
  });
});
