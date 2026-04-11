import { describe, expect, it } from "vitest";
import {
  type BootstrapCharacterDossier,
  type BootstrapLocationDetail,
  type BootstrapNarrativeRules,
  buildSceneBootstrapPrompt,
  condensedCharacterDossiers,
  condensedExistingScenes,
  condensedKillListAndBans,
  condensedLocationDetails,
  condensedNarrativeRules,
  type ExistingSceneSummary,
  mapSceneBootstrapToPlans,
  parseSceneBootstrapResponse,
} from "../../src/bootstrap/sceneBootstrap.js";

const characters = [
  { id: "c1", name: "Marcus Cole", role: "protagonist" },
  { id: "c2", name: "Elena Voss", role: "antagonist" },
];

const locations = [
  { id: "l1", name: "The Velvet" },
  { id: "l2", name: "Harbor District" },
];

describe("buildSceneBootstrapPrompt", () => {
  it("returns a CompiledPayload with model and temperature", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense confrontation",
      sceneCount: 3,
      characters,
      locations,
      includeChapterArc: false,
    });
    expect(payload.model).toBe("claude-opus-4-6");
    expect(payload.temperature).toBe(0.7);
    expect(payload.topP).toBe(0.92);
    expect(payload.systemMessage).toContain("3 section plans");
    expect(payload.userMessage).toContain("Marcus Cole");
    expect(payload.userMessage).toContain("The Velvet");
  });

  it("omits outputSchema (grammar too large for constrained decoding)", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense confrontation",
      sceneCount: 2,
      characters,
      locations,
      includeChapterArc: false,
    });
    expect(payload.outputSchema).toBeUndefined();
  });

  it("includes chapter arc instruction when requested", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Test",
      sceneCount: 2,
      characters: [],
      locations: [],
      includeChapterArc: true,
    });
    expect(payload.userMessage).toContain("chapterArc");
  });

  it("instructs LLM to skip characters when none selected", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A quiet scene",
      sceneCount: 1,
      characters: [],
      locations: [],
      includeChapterArc: false,
    });
    expect(payload.userMessage).toContain("No voice profiles have been selected");
    expect(payload.userMessage).toContain('"povCharacterId": ""');
    expect(payload.userMessage).not.toContain("exact character name from the list above");
  });

  it("instructs name-based character selection when characters are selected", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense scene",
      sceneCount: 1,
      characters,
      locations: [],
      includeChapterArc: false,
    });
    expect(payload.userMessage).toContain("exact character name from the list above");
    expect(payload.userMessage).toContain("ID will be resolved automatically");
    expect(payload.userMessage).not.toContain("No voice profiles have been selected");
  });

  it("uses singular phrasing when sceneCount is 1", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A quiet scene",
      sceneCount: 1,
      characters,
      locations,
      includeChapterArc: false,
    });
    expect(payload.systemMessage).toContain("generate the next section plan");
    expect(payload.systemMessage).not.toContain("1 section plans");
    expect(payload.userMessage).toContain("Generate exactly 1 scene plan.");
    expect(payload.userMessage).not.toContain("1 section plans");
  });

  it("uses maxTokens 8192 for single scene", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A quiet scene",
      sceneCount: 1,
      characters: [],
      locations: [],
      includeChapterArc: false,
    });
    expect(payload.maxTokens).toBe(8192);
  });

  it("uses maxTokens 16384 for multiple scenes", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "A tense chapter",
      sceneCount: 3,
      characters: [],
      locations: [],
      includeChapterArc: false,
    });
    expect(payload.maxTokens).toBe(16384);
  });

  it("includes position hint when sceneCount is 1 with existing scenes", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Continue the chapter",
      sceneCount: 1,
      characters,
      locations,
      includeChapterArc: false,
      existingScenes,
    });
    expect(payload.userMessage).toContain("This is scene 3 of the chapter");
    expect(payload.userMessage).toContain("This scene must continue seamlessly from the existing ones");
    // Should NOT use the multi-scene range format
    expect(payload.userMessage).not.toContain("scenes 3 through");
  });

  it("uses range format for continuity when sceneCount > 1 with existing scenes", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Continue the chapter",
      sceneCount: 2,
      characters,
      locations,
      includeChapterArc: false,
      existingScenes,
    });
    expect(payload.userMessage).toContain("You are generating scenes 3 through 4");
    expect(payload.userMessage).not.toContain("This is scene");
  });

  it("includes constraints when provided", () => {
    const payload = buildSceneBootstrapPrompt({
      direction: "Test",
      sceneCount: 1,
      characters: [],
      locations: [],
      constraints: "No violence in scene 1",
      includeChapterArc: false,
    });
    expect(payload.userMessage).toContain("No violence in scene 1");
  });
});

describe("parseSceneBootstrapResponse", () => {
  const validResponse = JSON.stringify({
    scenes: [{ title: "Opening", narrativeGoal: "Establish tension" }],
  });

  it("parses clean JSON", () => {
    const result = parseSceneBootstrapResponse(validResponse);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]!.title).toBe("Opening");
    }
  });

  it("parses JSON inside code fences", () => {
    const fenced = `Here's the result:\n\`\`\`json\n${validResponse}\n\`\`\`\nDone!`;
    const result = parseSceneBootstrapResponse(fenced);
    expect("error" in result).toBe(false);
  });

  it("parses JSON with surrounding text using brace depth", () => {
    const wrapped = `Let me generate scenes for you.\n${validResponse}\n\nI hope these work!`;
    const result = parseSceneBootstrapResponse(wrapped);
    expect("error" in result).toBe(false);
  });

  it("returns error for unparseable text", () => {
    const result = parseSceneBootstrapResponse("This is not JSON at all.");
    expect("error" in result).toBe(true);
  });

  it("returns error for empty string", () => {
    const result = parseSceneBootstrapResponse("");
    expect("error" in result).toBe(true);
  });
});

describe("mapSceneBootstrapToPlans", () => {
  it("maps parsed scenes to typed ScenePlan[]", () => {
    const parsed = {
      scenes: [
        {
          title: "Opening",
          povCharacterId: "c1",
          povDistance: "close",
          narrativeGoal: "Establish the detective's routine",
          emotionalBeat: "Quiet unease",
          density: "moderate",
          estimatedWordCount: [800, 1200] as [number, number],
          chunkCount: 3,
          chunkDescriptions: ["Arrival", "Discovery", "Reaction"],
          readerStateEntering: { knows: ["Marcus owns a bar"] },
          readerStateExiting: { knows: ["Marcus owns a bar", "Someone was murdered"] },
        },
      ],
    };

    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe("Opening");
    expect(plans[0]!.povCharacterId).toBe("c1");
    expect(plans[0]!.projectId).toBe("proj-1");
    expect(plans[0]!.id).toBeTruthy();
    expect(plans[0]!.chunkDescriptions).toEqual(["Arrival", "Discovery", "Reaction"]);
  });

  it("resolves character by name when ID does not match", () => {
    const parsed = {
      scenes: [
        {
          title: "Test",
          povCharacterId: "unknown-id",
          povCharacterName: "Marcus Cole",
        },
      ],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("c1");
  });

  it("resolves character by name when no ID provided", () => {
    const parsed = {
      scenes: [{ title: "Test", povCharacterName: "Elena Voss" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("c2");
  });

  it("resolves location by name when ID does not match", () => {
    const parsed = {
      scenes: [{ title: "Test", locationId: "bad-id", locationName: "The Velvet" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.locationId).toBe("l1");
  });

  it("provides safe defaults for missing fields", () => {
    const parsed = { scenes: [{ title: "Minimal" }] };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.povDistance).toBe("close");
    expect(plans[0]!.density).toBe("moderate");
    expect(plans[0]!.estimatedWordCount).toEqual([800, 1200]);
    expect(plans[0]!.chunkCount).toBe(3);
  });

  it("normalizes scalar estimatedWordCount to range", () => {
    const parsed = { scenes: [{ title: "Test", estimatedWordCount: 1000 }] };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.estimatedWordCount).toEqual([800, 1200]);
  });

  it("generates unique IDs for each scene", () => {
    const parsed = {
      scenes: [{ title: "Scene 1" }, { title: "Scene 2" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.id).not.toBe(plans[1]!.id);
  });

  it("maps subtext correctly", () => {
    const parsed = {
      scenes: [
        {
          title: "Test",
          subtext: {
            surfaceConversation: "Business talk",
            actualConversation: "Power struggle",
            enforcementRule: "Never state power explicitly",
          },
        },
      ],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.subtext).toEqual({
      surfaceConversation: "Business talk",
      actualConversation: "Power struggle",
      enforcementRule: "Never state power explicitly",
    });
  });

  it("resolves character by fuzzy token match (underscore slug)", () => {
    const parsed = {
      scenes: [{ title: "Test", povCharacterId: "marcus_cole", povCharacterName: "" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("c1");
  });

  it("resolves character by fuzzy token match (partial name)", () => {
    const parsed = {
      scenes: [{ title: "Test", povCharacterName: "Elena" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [{ id: "c2", name: "Elena Voss" }], []);
    expect(plans[0]!.povCharacterId).toBe("c2");
  });

  it("resolves location by fuzzy token match", () => {
    const parsed = {
      scenes: [{ title: "Test", locationName: "the velvet lounge" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], locations);
    expect(plans[0]!.locationId).toBe("l1");
  });

  it("preserves raw name for unresolvable character (so resolution UI surfaces it)", () => {
    const parsed = {
      scenes: [{ title: "Test", povCharacterId: "made-up-id", povCharacterName: "Imaginary Person" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.povCharacterId).toBe("Imaginary Person");
  });

  it("preserves raw name for unresolvable location (so resolution UI surfaces it)", () => {
    const parsed = {
      scenes: [{ title: "Test", locationId: "made-up-id", locationName: "Narnia" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", characters, locations);
    expect(plans[0]!.locationId).toBe("Narnia");
  });

  it("validates enum values and falls back to defaults", () => {
    const parsed = {
      scenes: [{ title: "Test", density: "ultra-dense", povDistance: "ethereal" }],
    };
    const plans = mapSceneBootstrapToPlans(parsed, "proj-1", [], []);
    expect(plans[0]!.density).toBe("moderate");
    expect(plans[0]!.povDistance).toBe("close");
  });
});

// ─── Context-aware prompt building ────────────────────

const existingScenes: ExistingSceneSummary[] = [
  {
    title: "The Arrival",
    povCharacterName: "Marcus Cole",
    povDistance: "close",
    narrativeGoal: "Establish the setting",
    emotionalBeat: "Quiet dread",
    readerStateExiting: {
      knows: ["Marcus arrived at the bar"],
      suspects: ["Something is wrong"],
      wrongAbout: ["Elena is an ally"],
      activeTensions: ["Who sent the letter?"],
    },
  },
  {
    title: "The Confrontation",
    povCharacterName: "Elena Voss",
    povDistance: "intimate",
    narrativeGoal: "Reveal Elena's motive",
    emotionalBeat: "Cold fury",
    readerStateExiting: {
      knows: ["Elena wants the ledger"],
      suspects: [],
      wrongAbout: [],
      activeTensions: ["Will Marcus hand it over?"],
    },
  },
];

const sampleDossiers: BootstrapCharacterDossier[] = [
  {
    name: "Marcus Cole",
    role: "protagonist",
    backstory: "Ex-detective turned bar owner",
    contradictions: ["Claims to be done with the life but keeps his gun"],
    voice: {
      vocabularyNotes: "Short declarative sentences",
      verbalTics: ["Look,", "Here's the thing"],
      prohibitedLanguage: ["awesome", "literally"],
      metaphoricRegister: "blue-collar mechanical",
    },
    behavior: {
      stressResponse: "Gets very still",
      noticesFirst: "Exits and weapons",
      emotionPhysicality: "Jaw clenches, hands go flat",
    },
  },
];

const sampleLocations: BootstrapLocationDetail[] = [
  {
    name: "The Velvet",
    description: "A run-down jazz bar in the harbor district",
    atmosphere: "Smoky and dim, perpetually 2am",
    sounds: ["muted trumpet", "ice clinking"],
    smells: ["stale bourbon", "cigarette smoke"],
    prohibitedDefaults: ["neon signs", "jukebox"],
  },
];

const sampleRules: BootstrapNarrativeRules = {
  pov: {
    default: "close-third",
    distance: "close",
    interiority: "filtered",
    reliability: "reliable",
    notes: "Never break POV",
  },
  subtextPolicy: "Characters never say what they mean directly",
  expositionPolicy: "Drip-feed only through action",
  sceneEndingPolicy: "End on an unresolved question",
};

describe("condensation helpers", () => {
  it("condensedExistingScenes returns empty string for empty/undefined", () => {
    expect(condensedExistingScenes(undefined)).toBe("");
    expect(condensedExistingScenes([])).toBe("");
  });

  it("condensedExistingScenes formats numbered scene summaries", () => {
    const result = condensedExistingScenes(existingScenes);
    expect(result).toContain('1. "The Arrival"');
    expect(result).toContain("POV: Marcus Cole (close)");
    expect(result).toContain("Goal: Establish the setting");
    expect(result).toContain("Beat: Quiet dread");
    expect(result).toContain("knows: Marcus arrived at the bar");
    expect(result).toContain("suspects: Something is wrong");
    expect(result).toContain('2. "The Confrontation"');
    expect(result).toContain("POV: Elena Voss (intimate)");
  });

  it("condensedCharacterDossiers returns empty string for empty/undefined", () => {
    expect(condensedCharacterDossiers(undefined)).toBe("");
    expect(condensedCharacterDossiers([])).toBe("");
  });

  it("condensedCharacterDossiers formats dossier details", () => {
    const result = condensedCharacterDossiers(sampleDossiers);
    expect(result).toContain("Marcus Cole (protagonist)");
    expect(result).toContain("Ex-detective turned bar owner");
    expect(result).toContain("Claims to be done with the life but keeps his gun");
    expect(result).toContain("Short declarative sentences");
    expect(result).toContain("tics: Look,, Here's the thing");
    expect(result).toContain("never says: awesome, literally");
    expect(result).toContain("stress: Gets very still");
    expect(result).toContain("notices first: Exits and weapons");
  });

  it("condensedLocationDetails returns empty string for empty/undefined", () => {
    expect(condensedLocationDetails(undefined)).toBe("");
    expect(condensedLocationDetails([])).toBe("");
  });

  it("condensedLocationDetails formats location sensory palette", () => {
    const result = condensedLocationDetails(sampleLocations);
    expect(result).toContain("The Velvet");
    expect(result).toContain("run-down jazz bar");
    expect(result).toContain("Atmosphere: Smoky and dim");
    expect(result).toContain("sounds: muted trumpet, ice clinking");
    expect(result).toContain("smells: stale bourbon, cigarette smoke");
    expect(result).toContain("Avoid: neon signs, jukebox");
  });

  it("condensedNarrativeRules returns empty string for undefined", () => {
    expect(condensedNarrativeRules(undefined)).toBe("");
  });

  it("condensedNarrativeRules formats POV contract and policies", () => {
    const result = condensedNarrativeRules(sampleRules);
    expect(result).toContain(
      "POV CONTRACT: close-third person, close distance, filtered interiority, reliable narrator",
    );
    expect(result).toContain("POV notes: Never break POV");
    expect(result).toContain("SUBTEXT POLICY: Characters never say what they mean directly");
    expect(result).toContain("EXPOSITION POLICY: Drip-feed only through action");
    expect(result).toContain("SCENE ENDING POLICY: End on an unresolved question");
  });

  it("condensedKillListAndBans returns empty for empty inputs", () => {
    expect(condensedKillListAndBans(undefined, undefined)).toBe("");
    expect(condensedKillListAndBans([], [])).toBe("");
  });

  it("condensedKillListAndBans formats kill list and structural bans", () => {
    const result = condensedKillListAndBans(["suddenly", "felt a chill"], ["No dream sequences", "No deus ex machina"]);
    expect(result).toContain("NEVER USE these words/phrases: suddenly, felt a chill");
    expect(result).toContain("STRUCTURAL RULES: No dream sequences; No deus ex machina");
  });
});

describe("context-aware prompt building", () => {
  const baseParams = {
    direction: "A tense confrontation",
    sceneCount: 2,
    characters,
    locations,
    includeChapterArc: false,
  };

  it("existing scenes appear in user message with titles and reader state", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      existingScenes,
    });
    expect(payload.userMessage).toContain("EXISTING SCENES (do not contradict or duplicate)");
    expect(payload.userMessage).toContain('"The Arrival"');
    expect(payload.userMessage).toContain('"The Confrontation"');
    expect(payload.userMessage).toContain("knows: Marcus arrived at the bar");
  });

  it("chapter arc appears in user message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      chapterArc: {
        workingTitle: "The Reckoning",
        narrativeFunction: "Establish the central conflict",
        dominantRegister: "noir",
        pacingTarget: "Slow burn to explosive",
        endingPosture: "Cliffhanger",
      },
    });
    expect(payload.userMessage).toContain("ESTABLISHED CHAPTER ARC");
    expect(payload.userMessage).toContain("Title: The Reckoning");
    expect(payload.userMessage).toContain("Function: Establish the central conflict");
    expect(payload.userMessage).toContain("Register: noir");
  });

  it("narrative rules appear in system message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      narrativeRules: sampleRules,
    });
    expect(payload.systemMessage).toContain("POV CONTRACT: close-third person");
    expect(payload.systemMessage).toContain("SUBTEXT POLICY");
    expect(payload.systemMessage).toContain("EXPOSITION POLICY");
    // Should NOT appear in user message
    expect(payload.userMessage).not.toContain("POV CONTRACT");
  });

  it("character dossiers appear in user message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      characterDossiers: sampleDossiers,
    });
    expect(payload.userMessage).toContain("CHARACTER DOSSIERS");
    expect(payload.userMessage).toContain("Ex-detective turned bar owner");
    expect(payload.userMessage).toContain("Gets very still");
  });

  it("location details appear in user message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      locationDetails: sampleLocations,
    });
    expect(payload.userMessage).toContain("LOCATION DETAILS");
    expect(payload.userMessage).toContain("run-down jazz bar");
    expect(payload.userMessage).toContain("muted trumpet, ice clinking");
  });

  it("kill list and structural bans appear in system message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      killList: ["suddenly", "felt a chill"],
      structuralBans: ["No dream sequences"],
    });
    expect(payload.systemMessage).toContain("NEVER USE these words/phrases: suddenly, felt a chill");
    expect(payload.systemMessage).toContain("STRUCTURAL RULES: No dream sequences");
    // Should NOT appear in user message
    expect(payload.userMessage).not.toContain("NEVER USE");
  });

  it("empty/undefined context fields produce no extra blocks (backward compat)", () => {
    const payload = buildSceneBootstrapPrompt(baseParams);
    expect(payload.userMessage).not.toContain("EXISTING SCENES");
    expect(payload.userMessage).not.toContain("ESTABLISHED CHAPTER ARC");
    expect(payload.userMessage).not.toContain("CHARACTER DOSSIERS");
    expect(payload.userMessage).not.toContain("LOCATION DETAILS");
    expect(payload.userMessage).not.toContain("ACTIVE SETUPS");
    expect(payload.systemMessage).not.toContain("POV CONTRACT");
    expect(payload.systemMessage).not.toContain("NEVER USE");
    // Original content still present
    expect(payload.systemMessage).toContain("essay structure planner");
    expect(payload.userMessage).toContain("CHAPTER DIRECTION");
  });

  it("continuity note references correct scene numbering", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      sceneCount: 2,
      existingScenes,
    });
    // 2 existing scenes + generating 2 more → scenes 3 through 4
    expect(payload.userMessage).toContain("You are generating scenes 3 through 4");
    expect(payload.userMessage).toContain("New scenes must continue seamlessly from existing ones");
  });

  it("active setups appear in user message", () => {
    const payload = buildSceneBootstrapPrompt({
      ...baseParams,
      activeSetups: [
        { description: "The letter is forged", status: "planted" },
        { description: "Elena has a twin", status: "planned" },
      ],
    });
    expect(payload.userMessage).toContain("ACTIVE SETUPS");
    expect(payload.userMessage).toContain("[planted] The letter is forged");
    expect(payload.userMessage).toContain("[planned] Elena has a twin");
  });
});
