import { describe, expect, it, vi } from "vitest";
import { compilePayload } from "../../src/compiler/assembler.js";
import { enforceBudget } from "../../src/compiler/budget.js";
import { buildRing1 } from "../../src/compiler/ring1.js";
import { buildRing3 } from "../../src/compiler/ring3.js";
import * as tokens from "../../src/tokens/index.js";
import {
  type Bible,
  type Chunk,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
  type ScenePlan,
} from "../../src/types/index.js";

function makeChar(id: string, name: string) {
  return {
    ...createEmptyCharacterDossier(name),
    id,
    voice: {
      ...createEmptyCharacterDossier(name).voice,
      dialogueSamples: [`${name} said something`],
    },
  };
}

function makeBible(): Bible {
  return {
    ...createEmptyBible("test"),
    characters: [makeChar("marcus", "Marcus"), makeChar("elena", "Elena")],
    styleGuide: {
      ...createEmptyBible("test").styleGuide,
      killList: [{ pattern: "a sense of", type: "exact" as const }],
    },
    locations: [
      {
        id: "loc-bar",
        name: "The Bar",
        description: null,
        sensoryPalette: {
          sounds: ["ice in glass"],
          smells: [],
          textures: [],
          lightQuality: "amber",
          atmosphere: null,
          prohibitedDefaults: [],
        },
      },
    ],
  };
}

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    id: "scene-1",
    title: "The Bar",
    povCharacterId: "marcus",
    narrativeGoal: "Establish tension",
    emotionalBeat: "Unease",
    readerEffect: "Feel the distance",
    failureModeToAvoid: "Stated emotions",
    dialogueConstraints: { elena: ["Guarded"] },
    locationId: "loc-bar",
    anchorLines: [{ text: "The ice never melts the same.", placement: "final third", verbatim: true }],
    estimatedWordCount: [800, 1200],
    chunkCount: 3,
    chunkDescriptions: ["arrival/setup", "conversation", "withdrawal"],
    ...overrides,
  };
}

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "c1",
    sceneId: "scene-1",
    sequenceNumber: 0,
    generatedText: "He walked in and sat down. The bar was quiet. Nobody looked up at him.",
    payloadHash: "hash",
    model: "test",
    temperature: 0.8,
    topP: 0.92,
    generatedAt: new Date().toISOString(),
    status: "accepted",
    editedText: null,
    humanNotes: null,
    ...overrides,
  };
}

const config = createDefaultCompilationConfig();

describe("compilePayload", () => {
  it("first chunk: valid payload with system + user messages", () => {
    const result = compilePayload(makeBible(), makePlan(), [], 0, config);

    expect(result.payload.systemMessage).toContain("=== PROJECT VOICE ===");
    expect(result.payload.systemMessage).toContain("NEVER WRITE:");
    expect(result.payload.userMessage).toContain("=== SCENE: The Bar ===");
    expect(result.payload.userMessage).toContain("=== MARCUS — VOICE ===");
    expect(result.payload.userMessage).toContain("=== ELENA — VOICE ===");
    expect(result.payload.userMessage).toContain("=== LOCATION: The Bar ===");
    expect(result.payload.userMessage).toContain("ANCHOR LINES");
    expect(result.payload.temperature).toBe(0.8);
    expect(result.payload.topP).toBe(0.92);
    expect(result.payload.maxTokens).toBe(2000);
  });

  it("first chunk: user message includes continuity bridge absent, gen instruction present", () => {
    const result = compilePayload(makeBible(), makePlan(), [], 0, config);

    expect(result.payload.userMessage).not.toContain("PRECEDING TEXT");
    expect(result.payload.userMessage).toContain("Write the next section");
    expect(result.payload.userMessage).toContain("section 1 of 3: arrival/setup");
  });

  it("second chunk: user message includes continuity bridge", () => {
    const chunks = [makeChunk()];
    const result = compilePayload(makeBible(), makePlan(), chunks, 1, config);

    expect(result.payload.userMessage).toContain("=== PRECEDING TEXT");
    expect(result.payload.userMessage).toContain("section 2 of 3: conversation");
  });

  it("second chunk with human notes includes micro-directive", () => {
    const chunks = [makeChunk({ humanNotes: "Slow the pacing" })];
    const result = compilePayload(makeBible(), makePlan(), chunks, 1, config);

    expect(result.payload.userMessage).toContain("DIRECTION FOR THIS SECTION");
    expect(result.payload.userMessage).toContain("Slow the pacing");
  });

  it("lint results flow through", () => {
    // Missing POV char in bible triggers POV_CHAR_MISSING
    const bible = {
      ...makeBible(),
      characters: [], // no characters at all
    };
    const result = compilePayload(bible, makePlan(), [], 0, config);

    expect(result.lintResult.issues.some((i) => i.code === "POV_CHAR_MISSING")).toBe(true);
  });

  it("CompilationLog token counts are populated", () => {
    const result = compilePayload(makeBible(), makePlan(), [], 0, config);

    expect(result.log.ring1Tokens).toBeGreaterThan(0);
    expect(result.log.ring3Tokens).toBeGreaterThan(0);
    expect(result.log.totalTokens).toBe(result.log.ring1Tokens + result.log.ring3Tokens);
    expect(result.log.ring2Tokens).toBe(0); // Phase 0
    expect(result.log.availableBudget).toBe(config.modelContextWindow - config.reservedForOutput);
  });

  it("CompilationLog contains section names", () => {
    const result = compilePayload(makeBible(), makePlan(), [], 0, config);

    expect(result.log.ring1Contents).toContain("NEVER_WRITE");
    expect(result.log.ring1Contents).toContain("POV");
    expect(result.log.ring3Contents).toContain("SCENE_CONTRACT");
    expect(result.log.ring3Contents).toContain("VOICE_MARCUS");
  });

  it("generation instruction includes chunk description", () => {
    const result = compilePayload(makeBible(), makePlan(), [], 2, config);

    expect(result.payload.userMessage).toContain("section 3 of 3: withdrawal");
  });

  it("word target calculated from estimatedWordCount and chunkCount", () => {
    const plan = makePlan({ estimatedWordCount: [900, 1100], chunkCount: 2 });
    const result = compilePayload(makeBible(), plan, [], 0, config);

    // (900+1100)/2/2 = 500
    expect(result.payload.userMessage).toContain("~500 words");
  });
});

describe("compilePayload — countTokens call budget", () => {
  it("assembler adds zero countTokens calls beyond rings + budget and threads counts into the log", () => {
    const bible = makeBible();
    const plan = makePlan();

    let ringsAndBudgetCalls: number;
    const spyA = vi.spyOn(tokens, "countTokens");
    try {
      const ring1 = buildRing1(bible, config);
      const ring3 = buildRing3(plan, bible, [], 0, config);
      enforceBudget(ring1.sections, ring3.sections, config.modelContextWindow - config.reservedForOutput, config);
      ringsAndBudgetCalls = spyA.mock.calls.length;
    } finally {
      spyA.mockRestore();
    }

    let compileCalls: number;
    let result: ReturnType<typeof compilePayload>;
    const spyB = vi.spyOn(tokens, "countTokens");
    try {
      result = compilePayload(bible, plan, [], 0, config);
      compileCalls = spyB.mock.calls.length;
    } finally {
      spyB.mockRestore();
    }

    expect(compileCalls).toBeLessThanOrEqual(ringsAndBudgetCalls);
    expect(result.log.ring1Tokens).toBeGreaterThan(0);
    expect(result.log.ring3Tokens).toBeGreaterThan(0);
    expect(result.log.totalTokens).toBe(result.log.ring1Tokens + result.log.ring3Tokens);
  });
});
