import { describe, it, expect } from "vitest";
import { buildRing3 } from "../../src/compiler/ring3.js";
import {
  createEmptyBible,
  createEmptyScenePlan,
  createDefaultCompilationConfig,
  type Bible,
  type ScenePlan,
  type Chunk,
  type CompilationConfig,
  type CharacterDossier,
} from "../../src/types/index.js";

function makeChar(id: string, name: string): CharacterDossier {
  return {
    id,
    name,
    role: "protagonist",
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: {
      sentenceLengthRange: [6, 14],
      vocabularyNotes: `${name}'s vocab`,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: [],
      dialogueSamples: [`${name} said something`],
    },
    behavior: null,
  };
}

function makeBible(chars: CharacterDossier[] = []): Bible {
  return {
    ...createEmptyBible("test"),
    characters: chars,
    locations: [
      {
        id: "loc-bar",
        name: "The Bar",
        description: null,
        sensoryPalette: {
          sounds: ["ice in glass"],
          smells: ["old wood"],
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
    title: "The Bar",
    povCharacterId: "marcus",
    narrativeGoal: "Establish tension",
    emotionalBeat: "Unease",
    readerEffect: "Feel distance",
    failureModeToAvoid: "Stated emotions",
    dialogueConstraints: { elena: ["Guarded"] },
    locationId: "loc-bar",
    anchorLines: [
      { text: "The ice never melts the same way twice.", placement: "final third", verbatim: true },
    ],
    ...overrides,
  };
}

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "c1",
    sceneId: "s1",
    sequenceNumber: 0,
    generatedText: "He walked in and sat down. The bar was quiet. Nobody looked up.",
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

describe("buildRing3", () => {
  it("first chunk (no bridge) includes contract, voice, sensory, anchors, anti-ablation", () => {
    const bible = makeBible([makeChar("marcus", "Marcus"), makeChar("elena", "Elena")]);
    const plan = makePlan();

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("SCENE_CONTRACT");
    expect(names).toContain("VOICE_MARCUS"); // POV char
    expect(names).toContain("VOICE_ELENA"); // speaking char
    expect(names).toContain("SENSORY_PALETTE");
    expect(names).toContain("ANCHOR_LINES");
    expect(names).toContain("ANTI_ABLATION");
    // No bridge or micro-directive for first chunk
    expect(names).not.toContain("CONTINUITY_BRIDGE");
    expect(names).not.toContain("MICRO_DIRECTIVE");

    expect(result.text).toContain("=== SCENE: The Bar ===");
    expect(result.text).toContain("=== MARCUS — VOICE ===");
    expect(result.text).toContain("=== LOCATION: The Bar ===");
    expect(result.text).toContain("ANCHOR LINES");
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("second chunk includes continuity bridge", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const chunks = [makeChunk()];

    const result = buildRing3(plan, bible, chunks, 1, config);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("CONTINUITY_BRIDGE");
    expect(result.text).toContain("=== PRECEDING TEXT");
    expect(result.text).toContain("He walked in");
  });

  it("second chunk includes micro-directive when humanNotes present", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const chunks = [makeChunk({ humanNotes: "Slow down the pacing here" })];

    const result = buildRing3(plan, bible, chunks, 1, config);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("MICRO_DIRECTIVE");
    expect(result.text).toContain("Slow down the pacing here");
  });

  it("POV character always in voice fingerprints even when not in dialogueConstraints", () => {
    const bible = makeBible([makeChar("marcus", "Marcus"), makeChar("elena", "Elena")]);
    const plan = makePlan({
      povCharacterId: "marcus",
      dialogueConstraints: { elena: ["Guarded"] }, // marcus not listed
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("VOICE_MARCUS");
    expect(names).toContain("VOICE_ELENA");
  });

  it("missing character gracefully skipped", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]); // No elena
    const plan = makePlan({
      dialogueConstraints: { elena: ["Guarded"] },
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("VOICE_MARCUS");
    expect(names).not.toContain("VOICE_ELENA"); // silently skipped
  });

  it("missing location gracefully skipped", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    // Override locations to empty
    bible.locations = [];
    const plan = makePlan({
      dialogueConstraints: {},
      locationId: "nonexistent",
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).not.toContain("SENSORY_PALETTE");
  });

  it("scene contract and voice sections are immune", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const contract = result.sections.find((s) => s.name === "SCENE_CONTRACT");
    const voice = result.sections.find((s) => s.name === "VOICE_MARCUS");

    expect(contract!.immune).toBe(true);
    expect(voice!.immune).toBe(true);
  });

  it("sensory palette is compressible", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const sensory = result.sections.find((s) => s.name === "SENSORY_PALETTE");

    expect(sensory!.immune).toBe(false);
    expect(sensory!.priority).toBe(4);
  });
});
