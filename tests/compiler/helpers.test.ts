import { describe, expect, it } from "vitest";
import {
  assembleSections,
  formatAntiAblation,
  formatBackgroundCharacter,
  formatCharacterVoice,
  formatForegroundCharacter,
  formatPovInteriority,
  formatSceneContract,
  formatSensoryGuardrail,
  formatSensoryPalette,
} from "../../src/compiler/helpers.js";
import type { CharacterDossier, Location, RingSection, ScenePlan } from "../../src/types/index.js";
import { createEmptyCharacterDossier, createEmptyLocation, createEmptyScenePlan } from "../../src/types/index.js";

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
    expect(text).toContain("Do not hedge");
    expect(text).toContain("Vary sentence length");
  });

  it("includes essay-specific guardrails", () => {
    const text = formatAntiAblation(makePlan());
    expect(text).toContain("Vary paragraph length");
    expect(text).toContain("elegant variation");
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

describe("formatSensoryGuardrail", () => {
  it("returns detail rules for essay context", () => {
    const text = formatSensoryGuardrail();
    expect(text).toContain("=== DETAIL RULES ===");
    expect(text).toContain("support a claim");
    expect(text).toContain("overwrought specificity");
  });
});

describe("formatCharacterVoice — behavior fields", () => {
  it("includes all 5 behavior fields when populated", () => {
    const char = createEmptyCharacterDossier("Elena");
    char.behavior = {
      emotionPhysicality: "Jaw tension, hand-to-collarbone",
      stressResponse: "Goes still, voice drops",
      socialPosture: "Deflects with humor",
      noticesFirst: "Exits and sharp objects",
      lyingStyle: "Partial truths wrapped in real emotion",
    };
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("Body shows emotion: Jaw tension");
    expect(result).toContain("Under stress: Goes still");
    expect(result).toContain("Social posture: Deflects with humor");
    expect(result).toContain("Notices first: Exits and sharp objects");
    expect(result).toContain("Lying style: Partial truths");
  });

  it("omits null behavior fields gracefully", () => {
    const char = createEmptyCharacterDossier("Bob");
    char.behavior = {
      emotionPhysicality: "Clenches fists",
      stressResponse: null,
      socialPosture: null,
      noticesFirst: "Windows",
      lyingStyle: null,
    };
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("Body shows emotion: Clenches fists");
    expect(result).toContain("Notices first: Windows");
    expect(result).not.toContain("Under stress");
    expect(result).not.toContain("Social posture");
    expect(result).not.toContain("Lying style");
  });

  it("still works when behavior is null", () => {
    const char = createEmptyCharacterDossier("Ghost");
    char.behavior = null;
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("GHOST — VOICE");
    expect(result).not.toContain("Body shows emotion");
  });
});

describe("formatSensoryPalette — description", () => {
  it("includes location description when present", () => {
    const location = createEmptyLocation("Diner");
    location.description =
      "A cramped diner with cracked vinyl booths and a counter sticky with decades of spilled coffee.";
    const result = formatSensoryPalette(location);
    expect(result).toContain("cramped diner");
    const headerIndex = result.indexOf("=== LOCATION:");
    const descIndex = result.indexOf("cramped diner");
    expect(descIndex).toBeGreaterThan(headerIndex);
  });

  it("omits description line when null", () => {
    const location = createEmptyLocation("Park");
    location.description = null;
    const result = formatSensoryPalette(location);
    expect(result).toContain("=== LOCATION:");
    expect(result).not.toContain("null");
  });

  it("truncates very long descriptions", () => {
    const location = createEmptyLocation("Castle");
    location.description = "Word ".repeat(200);
    const result = formatSensoryPalette(location);
    expect(result).toContain("Word");
    const descLine = result.split("\n").find((l) => l.includes("Word"));
    expect(descLine!.length).toBeLessThan(location.description.length);
  });
});

describe("formatPovInteriority", () => {
  function makeFullChar(): CharacterDossier {
    return {
      ...createEmptyCharacterDossier("Elena"),
      backstory: "Grew up in coastal Oregon logging town\nLeft for college at 17",
      selfNarrative: "Believes she is someone who makes hard choices cleanly",
      contradictions: [
        "Sees herself as decisive, but avoids confrontation",
        "Claims independence, but checks her mother's approval",
      ],
      behavior: {
        emotionPhysicality: "Jaw tension, hand-to-collarbone gesture",
        stressResponse: "Goes still, voice drops",
        socialPosture: "Deflects with humor, controls seating position",
        noticesFirst: "Exits and sharp objects",
        lyingStyle: "Partial truths wrapped in real emotion",
      },
    };
  }

  it("intimate distance includes all fields", () => {
    const result = formatPovInteriority(makeFullChar(), "intimate");
    expect(result).toContain("=== POV INTERIORITY: ELENA ===");
    expect(result).toContain("Backstory:");
    expect(result).toContain("coastal Oregon");
    expect(result).toContain("Self-narrative:");
    expect(result).toContain("hard choices cleanly");
    expect(result).toContain("Contradictions");
    expect(result).toContain("avoids confrontation");
    expect(result).toContain("Behavior:");
    expect(result).toContain("Notices first:");
    expect(result).toContain("Social posture:");
    expect(result).toContain("Lying style:");
    expect(result).toContain("Under stress:");
    expect(result).toContain("Body shows emotion:");
  });

  it("close distance includes all fields (same as intimate)", () => {
    const result = formatPovInteriority(makeFullChar(), "close");
    expect(result).toContain("Backstory:");
    expect(result).toContain("Self-narrative:");
    expect(result).toContain("Contradictions");
  });

  it("moderate distance excludes backstory and self-narrative", () => {
    const result = formatPovInteriority(makeFullChar(), "moderate");
    expect(result).not.toContain("Backstory:");
    expect(result).not.toContain("Self-narrative:");
    expect(result).toContain("Contradictions");
    expect(result).toContain("Behavior:");
  });

  it("distant distance includes only behavior", () => {
    const result = formatPovInteriority(makeFullChar(), "distant");
    expect(result).not.toContain("Backstory:");
    expect(result).not.toContain("Self-narrative:");
    expect(result).not.toContain("Contradictions");
    expect(result).toContain("Behavior:");
  });

  it("handles null fields gracefully", () => {
    const char = createEmptyCharacterDossier("Test");
    const result = formatPovInteriority(char, "intimate");
    expect(result).toContain("=== POV INTERIORITY: TEST ===");
    expect(result).not.toContain("null");
  });

  it("appends guardrail text", () => {
    const result = formatPovInteriority(makeFullChar(), "intimate");
    expect(result).toContain("Show contradictions through action");
    expect(result).toContain("Do not invent backstory");
  });
});

describe("formatForegroundCharacter", () => {
  it("includes physical description and role but NOT behavior", () => {
    const char = createEmptyCharacterDossier("Elena");
    char.role = "protagonist";
    char.physicalDescription = "Tall, dark hair cut short, perpetual coffee stain on left sleeve";
    char.behavior = {
      emotionPhysicality: "Jaw tension",
      stressResponse: "Goes still",
      socialPosture: "Deflects with humor",
      noticesFirst: "Exits",
      lyingStyle: null,
    };
    const result = formatForegroundCharacter(char);
    expect(result).toContain("Elena");
    expect(result).toContain("protagonist");
    expect(result).toContain("dark hair cut short");
    expect(result).not.toContain("Jaw tension");
    expect(result).not.toContain("Goes still");
  });

  it("gracefully handles null physicalDescription", () => {
    const char = createEmptyCharacterDossier("Bob");
    const result = formatForegroundCharacter(char);
    expect(result).toContain("Bob");
    expect(result).not.toContain("null");
  });
});

describe("formatBackgroundCharacter", () => {
  it("includes only name and role with defining cue", () => {
    const char = createEmptyCharacterDossier("Marcus");
    char.role = "supporting";
    char.physicalDescription = "Broad shoulders, always wearing a leather jacket";
    const result = formatBackgroundCharacter(char);
    expect(result).toContain("Marcus");
    expect(result).toContain("supporting");
    expect(result.length).toBeLessThan(200);
  });

  it("works with minimal character data", () => {
    const char = createEmptyCharacterDossier("Extra");
    const result = formatBackgroundCharacter(char);
    expect(result).toContain("Extra");
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
