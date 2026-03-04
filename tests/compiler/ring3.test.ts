import { describe, expect, it } from "vitest";
import { buildRing3 } from "../../src/compiler/ring3.js";
import {
  type Bible,
  type CharacterDossier,
  type Chunk,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyNarrativeIR,
  createEmptyScenePlan,
  type NarrativeIR,
  type ScenePlan,
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
    anchorLines: [{ text: "The ice never melts the same way twice.", placement: "final third", verbatim: true }],
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
    expect(names).toContain("POV_INTERIORITY"); // POV character interiority
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

  it("SENSORY_GUARDRAIL is always present and immune", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const guardrail = result.sections.find((s) => s.name === "SENSORY_GUARDRAIL");

    expect(guardrail).toBeDefined();
    expect(guardrail!.text).toContain("SENSORY DETAIL RULES");
    expect(guardrail!.text).toContain("narrative job");
    expect(guardrail!.immune).toBe(true);
    expect(guardrail!.priority).toBe(0);
  });

  it("SENSORY_GUARDRAIL present even without a location", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    bible.locations = [];
    const plan = makePlan({ dialogueConstraints: {}, locationId: null });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).not.toContain("SENSORY_PALETTE");
    expect(names).toContain("SENSORY_GUARDRAIL");
  });

  it("sensory palette is compressible", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const sensory = result.sections.find((s) => s.name === "SENSORY_PALETTE");

    expect(sensory!.immune).toBe(false);
    expect(sensory!.priority).toBe(4);
  });

  it("POV_INTERIORITY emitted for POV character with close distance (immune)", () => {
    const char = makeChar("marcus", "Marcus");
    char.backstory = "Grew up on a ranch";
    char.behavior = {
      emotionPhysicality: "Jaw tightens",
      stressResponse: "Goes still",
      socialPosture: null,
      noticesFirst: null,
      lyingStyle: null,
    };
    const bible = makeBible([char]);
    const plan = makePlan({ dialogueConstraints: {}, povDistance: "close" as ScenePlan["povDistance"] });

    const result = buildRing3(plan, bible, [], 0, config);
    const interiority = result.sections.find((s) => s.name === "POV_INTERIORITY");

    expect(interiority).toBeDefined();
    expect(interiority!.text).toContain("POV INTERIORITY: MARCUS");
    expect(interiority!.text).toContain("Backstory:");
    expect(interiority!.text).toContain("ranch");
    expect(interiority!.immune).toBe(true);
    expect(interiority!.priority).toBe(0);
  });

  it("POV_INTERIORITY with moderate distance is compressible (priority 2)", () => {
    const char = makeChar("marcus", "Marcus");
    char.contradictions = ["Sees himself as calm, but panics easily"];
    char.behavior = {
      emotionPhysicality: "Jaw tightens",
      stressResponse: null,
      socialPosture: null,
      noticesFirst: null,
      lyingStyle: null,
    };
    const bible = makeBible([char]);
    const plan = makePlan({ dialogueConstraints: {}, povDistance: "moderate" as ScenePlan["povDistance"] });

    const result = buildRing3(plan, bible, [], 0, config);
    const interiority = result.sections.find((s) => s.name === "POV_INTERIORITY");

    expect(interiority).toBeDefined();
    expect(interiority!.text).toContain("Contradictions");
    expect(interiority!.text).not.toContain("Backstory:");
    expect(interiority!.immune).toBe(false);
    expect(interiority!.priority).toBe(2);
  });

  it("POV_INTERIORITY appears after voice sections and before SENSORY_PALETTE", () => {
    const char = makeChar("marcus", "Marcus");
    char.behavior = {
      emotionPhysicality: "Jaw tightens",
      stressResponse: null,
      socialPosture: null,
      noticesFirst: null,
      lyingStyle: null,
    };
    const bible = makeBible([char]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    const voiceIdx = names.indexOf("VOICE_MARCUS");
    const interiorIdx = names.indexOf("POV_INTERIORITY");
    const sensoryIdx = names.indexOf("SENSORY_PALETTE");

    expect(voiceIdx).toBeLessThan(interiorIdx);
    expect(interiorIdx).toBeLessThan(sensoryIdx);
  });

  it("POV_INTERIORITY gracefully skipped when POV character not in bible", () => {
    const bible = makeBible([]); // no characters
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("POV_INTERIORITY");
  });

  // --- Scene cast tests ---

  it("SCENE_CAST_GUARDRAIL emitted when presentCharacterIds is non-empty", () => {
    const bible = makeBible([makeChar("marcus", "Marcus"), makeChar("bob", "Bob")]);
    const plan = makePlan({
      dialogueConstraints: {},
      presentCharacterIds: ["marcus", "bob"],
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const guardrail = result.sections.find((s) => s.name === "SCENE_CAST_GUARDRAIL");

    expect(guardrail).toBeDefined();
    expect(guardrail!.text).toContain("Only characters listed as present");
    expect(guardrail!.immune).toBe(true);
    expect(guardrail!.priority).toBe(0);
  });

  it("SCENE_CAST lists non-speaking present characters", () => {
    const bob = makeChar("bob", "Bob");
    bob.physicalDescription = "Tall, angular face";
    const bible = makeBible([makeChar("marcus", "Marcus"), bob]);
    const plan = makePlan({
      dialogueConstraints: {},
      presentCharacterIds: ["marcus", "bob"],
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const cast = result.sections.find((s) => s.name === "SCENE_CAST");

    expect(cast).toBeDefined();
    expect(cast!.text).toContain("ALSO PRESENT");
    expect(cast!.text).toContain("Bob");
    expect(cast!.text).toContain("Tall, angular face");
    expect(cast!.immune).toBe(false);
    expect(cast!.priority).toBe(2);
  });

  it("SCENE_CAST excludes speaking characters (already have VOICE_* sections)", () => {
    const bible = makeBible([makeChar("marcus", "Marcus"), makeChar("elena", "Elena")]);
    const plan = makePlan({
      dialogueConstraints: { elena: ["Guarded"] },
      presentCharacterIds: ["marcus", "elena"],
    });

    const result = buildRing3(plan, bible, [], 0, config);
    const cast = result.sections.find((s) => s.name === "SCENE_CAST");

    // Both marcus (POV) and elena (speaking) are already covered — no SCENE_CAST needed
    expect(cast).toBeUndefined();
  });

  it("no SCENE_CAST when presentCharacterIds is empty", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {}, presentCharacterIds: [] });

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).not.toContain("SCENE_CAST_GUARDRAIL");
    expect(names).not.toContain("SCENE_CAST");
  });

  it("SCENE_CAST handles missing presentCharacterIds gracefully (backward compat)", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    // Simulate old data without presentCharacterIds by creating plan without it
    const plan = makePlan({ dialogueConstraints: {} });
    (plan as unknown as Record<string, unknown>).presentCharacterIds = undefined;

    const result = buildRing3(plan, bible, [], 0, config);
    const names = result.sections.map((s) => s.name);

    expect(names).not.toContain("SCENE_CAST_GUARDRAIL");
    expect(names).not.toContain("SCENE_CAST");
  });

  // --- Cross-scene bridge tests ---

  it("cross-scene bridge uses previousSceneLastChunk when no previous chunks", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevSceneChunk = makeChunk({
      generatedText: "She closed the door behind her. The hallway was dark.",
    });

    const result = buildRing3(plan, bible, [], 0, config, prevSceneChunk);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("CONTINUITY_BRIDGE");
    expect(result.text).toContain("previous scene");
    expect(result.text).toContain("She closed the door");
  });

  it("cross-scene bridge uses editedText when available", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevSceneChunk = makeChunk({
      generatedText: "Original text",
      editedText: "The revised ending of the previous scene.",
    });

    const result = buildRing3(plan, bible, [], 0, config, prevSceneChunk);
    expect(result.text).toContain("revised ending");
    expect(result.text).not.toContain("Original text");
  });

  it("intra-scene bridge takes precedence over cross-scene bridge", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const intraChunks = [makeChunk({ generatedText: "Intra-scene text here." })];
    const crossSceneChunk = makeChunk({ generatedText: "Cross-scene text here." });

    const result = buildRing3(plan, bible, intraChunks, 1, config, crossSceneChunk);
    expect(result.text).toContain("Intra-scene text");
    expect(result.text).not.toContain("Cross-scene text");
  });

  it("no bridge when no previous chunks and no previous scene chunk", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });

    const result = buildRing3(plan, bible, [], 0, config, undefined);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("CONTINUITY_BRIDGE");
  });

  it("cross-scene bridge is compressible with priority 3", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevSceneChunk = makeChunk();

    const result = buildRing3(plan, bible, [], 0, config, prevSceneChunk);
    const bridge = result.sections.find((s) => s.name === "CONTINUITY_BRIDGE");

    expect(bridge).toBeDefined();
    expect(bridge!.immune).toBe(false);
    expect(bridge!.priority).toBe(3);
  });
});

describe("buildRing3 Part B continuity bridge", () => {
  function makeVerifiedIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
    return { ...createEmptyNarrativeIR(sceneId), verified: true, ...overrides };
  }

  it("adds CONTINUITY_BRIDGE_STATE when verified IR available and bridgeIncludeStateBullets is true", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevChunk = makeChunk();
    const ir = makeVerifiedIR("scene-prev", {
      unresolvedTensions: ["Who sent the letter?"],
      characterPositions: { Marcus: "at the bar exit" },
    });

    const result = buildRing3(plan, bible, [], 0, config, prevChunk, ir);
    const names = result.sections.map((s) => s.name);

    expect(names).toContain("CONTINUITY_BRIDGE_STATE");
    const stateSection = result.sections.find((s) => s.name === "CONTINUITY_BRIDGE_STATE")!;
    expect(stateSection.text).toContain("Who sent the letter?");
    expect(stateSection.text).toContain("at the bar exit");
    expect(stateSection.immune).toBe(false);
    expect(stateSection.priority).toBe(3);
  });

  it("omits CONTINUITY_BRIDGE_STATE when IR is not verified", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevChunk = makeChunk();
    const ir: NarrativeIR = {
      ...createEmptyNarrativeIR("scene-prev"),
      verified: false,
      unresolvedTensions: ["tension"],
    };

    const result = buildRing3(plan, bible, [], 0, config, prevChunk, ir);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("CONTINUITY_BRIDGE_STATE");
  });

  it("omits CONTINUITY_BRIDGE_STATE when no IR provided", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevChunk = makeChunk();

    const result = buildRing3(plan, bible, [], 0, config, prevChunk, undefined);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("CONTINUITY_BRIDGE_STATE");
  });

  it("omits CONTINUITY_BRIDGE_STATE when IR has no tensions or positions", () => {
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const prevChunk = makeChunk();
    const ir = makeVerifiedIR("scene-prev"); // empty arrays/maps

    const result = buildRing3(plan, bible, [], 0, config, prevChunk, ir);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("CONTINUITY_BRIDGE_STATE");
  });

  it("does not add Part B for intra-scene bridge (not a scene crossing)", () => {
    // When there are previous chunks, it's intra-scene — Part B only applies to cross-scene
    const bible = makeBible([makeChar("marcus", "Marcus")]);
    const plan = makePlan({ dialogueConstraints: {} });
    const intraChunks = [makeChunk()];
    const ir = makeVerifiedIR("scene-prev", { unresolvedTensions: ["tension"] });

    const result = buildRing3(plan, bible, intraChunks, 1, config, undefined, ir);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("CONTINUITY_BRIDGE_STATE");
  });
});
