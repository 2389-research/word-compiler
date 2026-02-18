import { describe, it, expect } from "vitest";
import {
  formatSceneContract,
  formatCharacterVoice,
  formatSensoryPalette,
  formatAntiAblation,
  assembleSections,
} from "../../src/compiler/helpers.js";
import type { ScenePlan, CharacterDossier, Location, RingSection } from "../../src/types/index.js";
import { createEmptyScenePlan, createEmptyCharacterDossier } from "../../src/types/index.js";

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    title: "The Bar",
    povCharacterId: "marcus",
    narrativeGoal: "Establish tension",
    emotionalBeat: "Unease",
    readerEffect: "Feel the distance between them",
    failureModeToAvoid: "Characters state emotions directly",
    ...overrides,
  };
}

describe("formatSceneContract", () => {
  it("formats minimal plan", () => {
    const text = formatSceneContract(makePlan());
    expect(text).toContain("=== SCENE: The Bar ===");
    expect(text).toContain("POV: marcus, close");
    expect(text).toContain("Goal: Establish tension");
    expect(text).toContain("Failure mode to avoid:");
  });

  it("includes subtext contract when present", () => {
    const text = formatSceneContract(
      makePlan({
        subtext: {
          surfaceConversation: "Catching up",
          actualConversation: "Testing loyalty",
          enforcementRule: "Never mention loyalty directly",
        },
      }),
    );
    expect(text).toContain("SUBTEXT CONTRACT:");
    expect(text).toContain("Surface: Catching up");
    expect(text).toContain("RULE: Never mention loyalty directly");
  });

  it("includes reader states when present", () => {
    const text = formatSceneContract(
      makePlan({
        readerStateEntering: {
          knows: ["Marcus is lying"],
          suspects: ["Elena knows"],
          wrongAbout: ["the timeline"],
          activeTensions: [],
        },
        readerStateExiting: {
          knows: ["Marcus is lying", "Elena suspects"],
          suspects: [],
          wrongAbout: [],
          activeTensions: [],
        },
      }),
    );
    expect(text).toContain("READER ENTERING:");
    expect(text).toContain("Knows: Marcus is lying");
    expect(text).toContain("READER EXITING:");
    expect(text).toContain("Should now know: Marcus is lying; Elena suspects");
  });
});

describe("formatCharacterVoice", () => {
  it("formats minimal character", () => {
    const char = createEmptyCharacterDossier("Marcus");
    const text = formatCharacterVoice(char, []);
    expect(text).toContain("=== MARCUS — VOICE ===");
  });

  it("includes all voice fields", () => {
    const char: CharacterDossier = {
      ...createEmptyCharacterDossier("Marcus"),
      voice: {
        sentenceLengthRange: [6, 14],
        vocabularyNotes: "Educated but not pretentious",
        verbalTics: ["trailing off mid-sentence", "rhetorical questions"],
        metaphoricRegister: "machinery and water",
        prohibitedLanguage: ["awesome", "literally"],
        dialogueSamples: [
          "You ever notice how the ice never melts the same way twice?",
          "That's not what I said. That's what you heard.",
        ],
      },
      behavior: {
        stressResponse: "Goes still, speaks slower",
        socialPosture: null,
        noticesFirst: null,
        lyingStyle: null,
        emotionPhysicality: "Jaw tightens, hands find pockets",
      },
    };

    const text = formatCharacterVoice(char, ["Guarded, not hostile"]);
    expect(text).toContain("Sentence length: 6-14 words");
    expect(text).toContain("Vocabulary: Educated but not pretentious");
    expect(text).toContain("Tics: trailing off mid-sentence; rhetorical questions");
    expect(text).toContain("Metaphors from: machinery and water");
    expect(text).toContain("Never says: awesome, literally");
    expect(text).toContain("Voice samples:");
    expect(text).toContain("In this scene:");
    expect(text).toContain("- Guarded, not hostile");
    expect(text).toContain("Body shows emotion: Jaw tightens");
    expect(text).toContain("Under stress: Goes still");
  });
});

describe("formatSensoryPalette", () => {
  it("formats minimal location", () => {
    const loc: Location = {
      id: "loc-1",
      name: "The Bar",
      description: null,
      sensoryPalette: {
        sounds: [],
        smells: [],
        textures: [],
        lightQuality: null,
        atmosphere: null,
        prohibitedDefaults: [],
      },
    };
    const text = formatSensoryPalette(loc);
    expect(text).toBe("=== LOCATION: The Bar ===");
  });

  it("formats full location", () => {
    const loc: Location = {
      id: "loc-1",
      name: "The Bar",
      description: "A dim dive bar",
      sensoryPalette: {
        sounds: ["ice in glass", "low murmur"],
        smells: ["old wood", "spilled beer"],
        textures: ["sticky bar top", "cracked leather"],
        lightQuality: "Amber, from neon signs through dirty glass",
        atmosphere: "Tired but not hostile",
        prohibitedDefaults: ["dim lighting", "clink of glasses"],
      },
    };
    const text = formatSensoryPalette(loc);
    expect(text).toContain("Sounds: ice in glass, low murmur");
    expect(text).toContain("Smells: old wood, spilled beer");
    expect(text).toContain("Light: Amber, from neon signs");
    expect(text).toContain("DO NOT default to: dim lighting, clink of glasses");
  });
});

describe("formatAntiAblation", () => {
  it("includes universal directives", () => {
    const text = formatAntiAblation(makePlan());
    expect(text).toContain("=== ANTI-ABLATION ===");
    expect(text).toContain("Do not summarize");
    expect(text).toContain("Vary sentence length");
  });

  it("includes scene-specific prohibitions", () => {
    const text = formatAntiAblation(
      makePlan({ sceneSpecificProhibitions: ["No flashbacks", "No internal monologue"] }),
    );
    expect(text).toContain("Scene-specific bans:");
    expect(text).toContain("- No flashbacks");
    expect(text).toContain("- No internal monologue");
  });
});

describe("assembleSections", () => {
  it("joins sections with double newlines", () => {
    const sections: RingSection[] = [
      { name: "A", text: "first", priority: 0, immune: true },
      { name: "B", text: "second", priority: 0, immune: true },
    ];
    expect(assembleSections(sections)).toBe("first\n\nsecond");
  });
});
