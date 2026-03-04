import { describe, expect, it } from "vitest";
import { buildReviewContext } from "../../src/review/contextBuilder.js";
import type { CharacterDossier, VoiceFingerprint } from "../../src/types/bible.js";
import { createEmptyBible } from "../../src/types/bible.js";
import { createEmptyScenePlan } from "../../src/types/scene.js";

function makeVoice(overrides: Partial<VoiceFingerprint> = {}): VoiceFingerprint {
  return {
    sentenceLengthRange: null,
    vocabularyNotes: null,
    verbalTics: [],
    metaphoricRegister: null,
    prohibitedLanguage: [],
    dialogueSamples: [],
    ...overrides,
  };
}

function makeCharacter(id: string, name: string, voice?: Partial<VoiceFingerprint>): CharacterDossier {
  return {
    id,
    name,
    role: "supporting",
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: makeVoice(voice),
    behavior: null,
  };
}

describe("buildReviewContext", () => {
  it("filters characters to only those in presentCharacterIds", () => {
    const bible = createEmptyBible("p1");
    bible.characters = [
      makeCharacter("alice", "Alice", { vocabularyNotes: "formal" }),
      makeCharacter("bob", "Bob", { vocabularyNotes: "casual" }),
      makeCharacter("eve", "Eve", { vocabularyNotes: "poetic" }),
    ];
    const scene = createEmptyScenePlan("p1");
    scene.presentCharacterIds = ["alice", "eve"];

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.activeVoices).toHaveLength(2);
    expect(ctx.activeVoices.map((v) => v.name)).toEqual(["Alice", "Eve"]);
  });

  it("includes POV character even if not in presentCharacterIds", () => {
    const bible = createEmptyBible("p1");
    bible.characters = [
      makeCharacter("alice", "Alice", { vocabularyNotes: "formal" }),
      makeCharacter("bob", "Bob", { vocabularyNotes: "casual" }),
    ];
    const scene = createEmptyScenePlan("p1");
    scene.presentCharacterIds = ["alice"];
    scene.povCharacterId = "bob";

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.activeVoices).toHaveLength(2);
    expect(ctx.activeVoices.map((v) => v.name)).toContain("Bob");
  });

  it("extracts POV rules from bible narrative rules with scene distance override", () => {
    const bible = createEmptyBible("p1");
    bible.characters = [makeCharacter("alice", "Alice")];
    const scene = createEmptyScenePlan("p1");
    scene.povCharacterId = "alice";
    scene.povDistance = "intimate";

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.povRules).toEqual({
      distance: "intimate",
      interiority: "filtered",
      reliability: "reliable",
    });
  });

  it("returns null POV rules when no POV character", () => {
    const bible = createEmptyBible("p1");
    const scene = createEmptyScenePlan("p1");
    scene.povCharacterId = "";

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.povRules).toBeNull();
  });

  it("formats voice fingerprint with available fields", () => {
    const bible = createEmptyBible("p1");
    bible.characters = [
      makeCharacter("alice", "Alice", {
        vocabularyNotes: "archaic diction",
        verbalTics: ["forsooth", "prithee"],
        metaphoricRegister: "classical",
        prohibitedLanguage: ["modern slang"],
      }),
    ];
    const scene = createEmptyScenePlan("p1");
    scene.presentCharacterIds = ["alice"];

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.activeVoices[0]?.fingerprint).toContain("archaic diction");
    expect(ctx.activeVoices[0]?.fingerprint).toContain("forsooth");
    expect(ctx.activeVoices[0]?.fingerprint).toContain("classical");
    expect(ctx.activeVoices[0]?.fingerprint).toContain("modern slang");
  });

  it("copies style rules from bible without exemplars", () => {
    const bible = createEmptyBible("p1");
    bible.styleGuide.structuralBans = ["flashbacks"];
    bible.styleGuide.killList = [{ pattern: "very", type: "exact" }];

    const scene = createEmptyScenePlan("p1");

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.styleRules.structuralBans).toEqual(["flashbacks"]);
    expect(ctx.styleRules.killList).toHaveLength(1);
    // Exemplars are NOT included in ReviewContext
    expect(ctx.styleRules).not.toHaveProperty("positiveExemplars");
    expect(ctx.styleRules).not.toHaveProperty("negativeExemplars");
  });

  it("returns empty activeVoices when no characters present", () => {
    const bible = createEmptyBible("p1");
    bible.characters = [makeCharacter("alice", "Alice")];
    const scene = createEmptyScenePlan("p1");
    scene.presentCharacterIds = [];

    const ctx = buildReviewContext(bible, scene);

    expect(ctx.activeVoices).toHaveLength(0);
  });
});
