import { describe, expect, it } from "vitest";
import { buildRing2 } from "../../src/compiler/ring2.js";
import {
  type Bible,
  type ChapterArc,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyNarrativeIR,
  type NarrativeIR,
  type ReaderState,
} from "../../src/types/index.js";

function makeReaderState(overrides: Partial<ReaderState> = {}): ReaderState {
  return { knows: [], suspects: [], wrongAbout: [], activeTensions: [], ...overrides };
}

function makeArc(overrides: Partial<ChapterArc> = {}): ChapterArc {
  return {
    id: "ch1",
    projectId: "test",
    chapterNumber: 1,
    workingTitle: "The Beginning",
    narrativeFunction: "Establish the world and introduce tension",
    dominantRegister: "literary realism",
    pacingTarget: "slow build",
    endingPosture: "question mark",
    readerStateEntering: makeReaderState({
      knows: ["protagonist is a teacher"],
      suspects: ["something is wrong at the school"],
      activeTensions: ["who sent the letter"],
    }),
    readerStateExiting: makeReaderState(),
    sourcePrompt: null,
    ...overrides,
  };
}

function makeBible(overrides: Partial<Bible> = {}): Bible {
  return {
    ...createEmptyBible("test"),
    narrativeRules: {
      ...createEmptyBible("test").narrativeRules,
      setups: [
        {
          id: "s1",
          description: "The letter in the desk",
          plantedInScene: null,
          payoffInScene: null,
          status: "planned",
        },
        { id: "s2", description: "Missing keys", plantedInScene: "scene-1", payoffInScene: null, status: "planted" },
        {
          id: "s3",
          description: "Dog barking",
          plantedInScene: "scene-1",
          payoffInScene: "scene-2",
          status: "paid-off",
        },
      ],
    },
    ...overrides,
  };
}

const config = createDefaultCompilationConfig();

describe("buildRing2", () => {
  it("includes chapter brief with all fields", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    expect(result.text).toContain("=== CHAPTER CONTEXT ===");
    expect(result.text).toContain("Chapter 1: The Beginning");
    expect(result.text).toContain("Function: Establish the world");
    expect(result.text).toContain("Register: literary realism");
    expect(result.text).toContain("Pacing: slow build");
    expect(result.text).toContain("Ending: question mark");
  });

  it("chapter brief is immune", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    const brief = result.sections.find((s) => s.name === "CHAPTER_BRIEF");
    expect(brief).toBeDefined();
    expect(brief!.immune).toBe(true);
  });

  it("includes reader state at entry when populated", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    expect(result.text).toContain("READER STATE AT CHAPTER START");
    expect(result.text).toContain("Knows: protagonist is a teacher");
    expect(result.text).toContain("Suspects: something is wrong at the school");
    expect(result.text).toContain("Tensions: who sent the letter");
  });

  it("reader state section is compressible", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    const rs = result.sections.find((s) => s.name === "READER_STATE_ENTRY");
    expect(rs).toBeDefined();
    expect(rs!.immune).toBe(false);
    expect(rs!.priority).toBe(3);
  });

  it("omits reader state when all arrays empty", () => {
    const arc = makeArc({ readerStateEntering: makeReaderState() });
    const result = buildRing2(arc, makeBible(), [], config);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("READER_STATE_ENTRY");
  });

  it("includes only active setups (planned + planted, not paid-off)", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    expect(result.text).toContain("ACTIVE SETUPS");
    expect(result.text).toContain("The letter in the desk [planned]");
    expect(result.text).toContain("Missing keys [planted]");
    expect(result.text).not.toContain("Dog barking");
  });

  it("active setups section is compressible", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    const setups = result.sections.find((s) => s.name === "ACTIVE_SETUPS");
    expect(setups).toBeDefined();
    expect(setups!.immune).toBe(false);
    expect(setups!.priority).toBe(4);
  });

  it("omits active setups when none are active", () => {
    const bible = makeBible({
      narrativeRules: {
        ...createEmptyBible("test").narrativeRules,
        setups: [{ id: "s1", description: "x", plantedInScene: "a", payoffInScene: "b", status: "paid-off" }],
      },
    });
    const result = buildRing2(makeArc(), bible, [], config);
    const names = result.sections.map((s) => s.name);
    expect(names).not.toContain("ACTIVE_SETUPS");
  });

  it("token count is positive", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("minimal arc produces only chapter brief", () => {
    const arc = makeArc({
      workingTitle: "Chapter One",
      narrativeFunction: "",
      dominantRegister: "",
      pacingTarget: "",
      endingPosture: "",
      readerStateEntering: makeReaderState(),
    });
    const bible = makeBible({
      narrativeRules: { ...createEmptyBible("test").narrativeRules, setups: [] },
    });
    const result = buildRing2(arc, bible, [], config);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]!.name).toBe("CHAPTER_BRIEF");
  });

  it("previousSceneIRs param accepted (empty array)", () => {
    const result = buildRing2(makeArc(), makeBible(), [], config);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

describe("buildRing2 with IR-derived character states", () => {
  function makeVerifiedIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
    return {
      ...createEmptyNarrativeIR(sceneId),
      verified: true,
      ...overrides,
    };
  }

  function makeBibleWithChar(): Bible {
    return {
      ...makeBible(),
      characters: [
        {
          id: "char-alice",
          name: "Alice",
          role: "protagonist",
          physicalDescription: null,
          backstory: null,
          selfNarrative: null,
          contradictions: null,
          voice: {
            sentenceLengthRange: null,
            vocabularyNotes: null,
            verbalTics: [],
            metaphoricRegister: null,
            prohibitedLanguage: [],
            dialogueSamples: [],
          },
          behavior: null,
        },
      ],
    };
  }

  it("adds character state section when verified IR has deltas", () => {
    const ir = makeVerifiedIR("scene-1", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "the secret",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    const result = buildRing2(makeArc(), makeBibleWithChar(), [ir], config);
    const charSection = result.sections.find((s) => s.name.startsWith("CHAR_STATE_"));
    expect(charSection).toBeDefined();
    expect(charSection!.text).toContain("ALICE");
    expect(charSection!.text).toContain("the secret");
    expect(charSection!.immune).toBe(false);
    expect(charSection!.priority).toBe(2);
  });

  it("omits character state sections when no verified IRs", () => {
    const unverifiedIR = makeVerifiedIR("scene-1", { verified: false });
    const result = buildRing2(makeArc(), makeBibleWithChar(), [unverifiedIR], config);
    const charSections = result.sections.filter((s) => s.name.startsWith("CHAR_STATE_"));
    expect(charSections).toHaveLength(0);
  });

  it("adds unresolved tensions from last IR", () => {
    const ir = makeVerifiedIR("scene-1", {
      unresolvedTensions: ["Why did Bob leave?", "Who has the letter?"],
    });
    const result = buildRing2(makeArc(), makeBibleWithChar(), [ir], config);
    const tensions = result.sections.find((s) => s.name === "UNRESOLVED_TENSIONS");
    expect(tensions).toBeDefined();
    expect(tensions!.text).toContain("Why did Bob leave?");
    expect(tensions!.text).toContain("Who has the letter?");
    expect(tensions!.immune).toBe(false);
  });

  it("cumulates character deltas across multiple IRs", () => {
    const ir1 = makeVerifiedIR("scene-1", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "fact from scene 1",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    const ir2 = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "fact from scene 2",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    const result = buildRing2(makeArc(), makeBibleWithChar(), [ir1, ir2], config);
    const charSection = result.sections.find((s) => s.name.startsWith("CHAR_STATE_"));
    expect(charSection!.text).toContain("fact from scene 1");
    expect(charSection!.text).toContain("fact from scene 2");
  });

  it("includes character position from last IR", () => {
    const ir = makeVerifiedIR("scene-1", {
      // A delta is required for the character to enter the state section loop;
      // position is then appended to the state text.
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: null,
          suspicionGained: null,
          emotionalShift: "composed",
          relationshipChange: null,
        },
      ],
      characterPositions: { Alice: "standing at the doorway" },
    });
    const result = buildRing2(makeArc(), makeBibleWithChar(), [ir], config);
    const allText = result.sections.map((s) => s.text).join("\n");
    expect(allText).toContain("standing at the doorway");
  });
});
