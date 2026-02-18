import { describe, expect, it } from "vitest";
import {
  checkBudgetCompliance,
  checkDialoguePresence,
  checkIRCompleteness,
  checkKillListCompliance,
  checkLintCompliance,
  checkProhibitedLanguage,
  checkRing1Cap,
  checkSentenceDistribution,
  checkSetupPayoffClosure,
  checkStructuralBans,
  checkWordCount,
  runAllDeterministicChecks,
} from "../../eval/checks/deterministic.js";
import {
  type Bible,
  type CharacterDossier,
  type CompilationLog,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyNarrativeIR,
  createEmptyScenePlan,
  type LintResult,
  type NarrativeIR,
  type ProseMetrics,
  type ScenePlan,
} from "../../src/types/index.js";

// ─── Test Helpers ───────────────────────────────────

function makeBible(): Bible {
  return {
    ...createEmptyBible("test"),
    styleGuide: {
      ...createEmptyBible("test").styleGuide,
      killList: [
        { pattern: "suddenly", type: "exact" },
        { pattern: "he realized", type: "exact" },
      ],
      structuralBans: ["It was a dark and stormy night"],
    },
  };
}

function makeCharacter(): CharacterDossier {
  return {
    ...createEmptyCharacterDossier("Marcus"),
    voice: {
      sentenceLengthRange: [4, 18],
      vocabularyNotes: null,
      verbalTics: [],
      metaphoricRegister: null,
      prohibitedLanguage: ["literally", "actually"],
      dialogueSamples: [],
    },
  };
}

function makeLog(overrides: Partial<CompilationLog> = {}): CompilationLog {
  return {
    id: "log-1",
    chunkId: "chunk-1",
    payloadHash: "hash-1",
    ring1Tokens: 500,
    ring2Tokens: 300,
    ring3Tokens: 800,
    totalTokens: 1600,
    availableBudget: 198000,
    ring1Contents: ["HEADER"],
    ring2Contents: ["CHAPTER_BRIEF"],
    ring3Contents: ["SCENE_CONTRACT"],
    lintWarnings: [],
    lintErrors: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<ProseMetrics> = {}): ProseMetrics {
  return {
    wordCount: 500,
    sentenceCount: 30,
    avgSentenceLength: 16.7,
    sentenceLengthVariance: 5.2,
    typeTokenRatio: 0.65,
    paragraphCount: 8,
    avgParagraphLength: 3.75,
    ...overrides,
  };
}

function makePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    ...createEmptyScenePlan("test"),
    estimatedWordCount: [400, 600],
    ...overrides,
  };
}

// ─── Kill List ──────────────────────────────────────

describe("checkKillListCompliance", () => {
  it("passes with clean prose", () => {
    const result = checkKillListCompliance("Marcus stood at the window. The desk was empty.", makeBible(), "scene-1");
    expect(result.passed).toBe(true);
  });

  it("fails when kill list words appear", () => {
    const result = checkKillListCompliance("Marcus suddenly looked up. He realized the truth.", makeBible(), "scene-1");
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("suddenly");
    expect(result.detail).toContain("he realized");
  });

  it("counts multiple violations", () => {
    const result = checkKillListCompliance("Suddenly he turned. Then suddenly again.", makeBible(), "scene-1");
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("2 violation");
  });
});

// ─── Budget Compliance ──────────────────────────────

describe("checkBudgetCompliance", () => {
  const config = createDefaultCompilationConfig();

  it("passes when within budget", () => {
    const result = checkBudgetCompliance(makeLog({ totalTokens: 1000 }), config);
    expect(result.passed).toBe(true);
  });

  it("fails when over budget", () => {
    const available = config.modelContextWindow - config.reservedForOutput;
    const result = checkBudgetCompliance(makeLog({ totalTokens: available + 100 }), config);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("exceeds");
  });
});

// ─── Ring 1 Cap ─────────────────────────────────────

describe("checkRing1Cap", () => {
  const config = createDefaultCompilationConfig();

  it("passes when Ring 1 within cap", () => {
    const result = checkRing1Cap(makeLog({ ring1Tokens: 500 }), config);
    expect(result.passed).toBe(true);
  });

  it("fails when Ring 1 exceeds cap", () => {
    const result = checkRing1Cap(makeLog({ ring1Tokens: config.ring1HardCap + 1 }), config);
    expect(result.passed).toBe(false);
  });
});

// ─── Lint Compliance ────────────────────────────────

describe("checkLintCompliance", () => {
  it("passes with no errors", () => {
    const lint: LintResult = { issues: [] };
    expect(checkLintCompliance(lint).passed).toBe(true);
  });

  it("passes with only warnings", () => {
    const lint: LintResult = {
      issues: [{ code: "W1", severity: "warning", message: "Just a warning" }],
    };
    expect(checkLintCompliance(lint).passed).toBe(true);
  });

  it("fails with errors", () => {
    const lint: LintResult = {
      issues: [{ code: "E1", severity: "error", message: "Bad stuff" }],
    };
    const result = checkLintCompliance(lint);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("Bad stuff");
  });
});

// ─── Sentence Distribution ──────────────────────────

describe("checkSentenceDistribution", () => {
  it("passes with good variance", () => {
    const result = checkSentenceDistribution(
      makeMetrics({ sentenceLengthVariance: 5.0, sentenceCount: 20 }),
      makeCharacter(),
    );
    expect(result.passed).toBe(true);
  });

  it("fails with low variance", () => {
    const result = checkSentenceDistribution(
      makeMetrics({ sentenceLengthVariance: 1.5, sentenceCount: 20 }),
      makeCharacter(),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("below minimum");
  });

  it("skips variance check for short prose (< 5 sentences)", () => {
    const result = checkSentenceDistribution(
      makeMetrics({ sentenceLengthVariance: 1.0, sentenceCount: 3 }),
      makeCharacter(),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when avg sentence length far outside character range", () => {
    const result = checkSentenceDistribution(
      makeMetrics({ sentenceLengthVariance: 5.0, sentenceCount: 20, avgSentenceLength: 40 }),
      makeCharacter(), // range [4, 18] → max tolerance 36
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("outside character range");
  });

  it("passes with no character defined", () => {
    const result = checkSentenceDistribution(
      makeMetrics({ sentenceLengthVariance: 5.0, sentenceCount: 20 }),
      undefined,
    );
    expect(result.passed).toBe(true);
  });
});

// ─── Prohibited Language ────────────────────────────

describe("checkProhibitedLanguage", () => {
  it("passes with clean prose", () => {
    const result = checkProhibitedLanguage("Marcus walked to the door.", makeCharacter());
    expect(result.passed).toBe(true);
  });

  it("fails when prohibited words appear", () => {
    const result = checkProhibitedLanguage("He literally could not believe it. Actually, he could.", makeCharacter());
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("literally");
    expect(result.detail).toContain("actually");
  });

  it("passes when no character provided", () => {
    const result = checkProhibitedLanguage("He literally said so.", undefined);
    expect(result.passed).toBe(true);
  });

  it("passes when character has no prohibited language", () => {
    const char = {
      ...makeCharacter(),
      voice: { ...makeCharacter().voice, prohibitedLanguage: [] },
    };
    const result = checkProhibitedLanguage("He literally said so.", char);
    expect(result.passed).toBe(true);
  });
});

// ─── Structural Bans ───────────────────────────────

describe("checkStructuralBans", () => {
  it("passes with clean prose", () => {
    const result = checkStructuralBans("Marcus entered the room.", makeBible());
    expect(result.passed).toBe(true);
  });

  it("fails when structural ban violated", () => {
    const result = checkStructuralBans("It was a dark and stormy night when Marcus arrived.", makeBible());
    expect(result.passed).toBe(false);
  });

  it("passes when no bans defined", () => {
    const bible = { ...makeBible(), styleGuide: { ...makeBible().styleGuide, structuralBans: [] } };
    const result = checkStructuralBans("It was a dark and stormy night.", bible);
    expect(result.passed).toBe(true);
  });
});

// ─── Word Count ─────────────────────────────────────

describe("checkWordCount", () => {
  it("passes within range", () => {
    const result = checkWordCount(makeMetrics({ wordCount: 500 }), makePlan());
    expect(result.passed).toBe(true);
  });

  it("passes at lower tolerance bound", () => {
    // Plan [400, 600], -20% of 400 = 320
    const result = checkWordCount(makeMetrics({ wordCount: 320 }), makePlan());
    expect(result.passed).toBe(true);
  });

  it("fails below tolerance", () => {
    const result = checkWordCount(makeMetrics({ wordCount: 200 }), makePlan());
    expect(result.passed).toBe(false);
  });

  it("fails above tolerance", () => {
    // Plan [400, 600], +20% of 600 = 720
    const result = checkWordCount(makeMetrics({ wordCount: 800 }), makePlan());
    expect(result.passed).toBe(false);
  });
});

// ─── Dialogue Presence ──────────────────────────────

describe("checkDialoguePresence", () => {
  it("reports dialogue found", () => {
    const result = checkDialoguePresence('"Look," Marcus said. "The thing is, nobody knows."');
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("2 dialogue");
  });

  it("reports no dialogue", () => {
    const result = checkDialoguePresence("Marcus walked silently through the corridor.");
    expect(result.passed).toBe(true); // Informational, doesn't fail
    expect(result.detail).toContain("No dialogue");
  });
});

// ─── IR Completeness ────────────────────────────────

describe("checkIRCompleteness", () => {
  function makeVerifiedIR(sceneId: string): NarrativeIR {
    return { ...createEmptyNarrativeIR(sceneId), verified: true };
  }

  it("passes when all completed scenes have verified IRs", () => {
    const irMap = new Map([
      ["scene-1", makeVerifiedIR("scene-1")],
      ["scene-2", makeVerifiedIR("scene-2")],
    ]);
    const result = checkIRCompleteness(["scene-1", "scene-2"], irMap);
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("2 completed");
  });

  it("passes with empty completed scenes list", () => {
    const result = checkIRCompleteness([], new Map());
    expect(result.passed).toBe(true);
  });

  it("fails when a completed scene has no IR in the map", () => {
    const irMap = new Map([["scene-1", makeVerifiedIR("scene-1")]]);
    const result = checkIRCompleteness(["scene-1", "scene-2"], irMap);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("scene-2");
  });

  it("fails when a completed scene has an unverified IR", () => {
    const ir = { ...createEmptyNarrativeIR("scene-1"), verified: false };
    const result = checkIRCompleteness(["scene-1"], new Map([["scene-1", ir]]));
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("scene-1");
  });

  it("only reports the missing/unverified scenes", () => {
    const irMap = new Map([
      ["scene-1", makeVerifiedIR("scene-1")],
      ["scene-3", makeVerifiedIR("scene-3")],
    ]);
    const result = checkIRCompleteness(["scene-1", "scene-2", "scene-3"], irMap);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("scene-2");
    expect(result.detail).not.toContain("scene-1");
    expect(result.detail).not.toContain("scene-3");
  });
});

// ─── Setup/Payoff Closure ───────────────────────────

describe("checkSetupPayoffClosure", () => {
  function makeBibleWithSetup(description: string): Bible {
    return {
      ...makeBible(),
      narrativeRules: {
        ...makeBible().narrativeRules,
        setups: [
          {
            id: "setup-1",
            description,
            plantedInScene: "scene-1",
            payoffInScene: null,
            status: "planted",
          },
        ],
      },
    };
  }

  it("passes when bible has no setups", () => {
    const result = checkSetupPayoffClosure([], makeBible(), "scene-4");
    expect(result.passed).toBe(true);
    expect(result.detail).toContain("No dangling");
  });

  it("passes when all planted setups are paid off across IRs", () => {
    const bible = makeBibleWithSetup("the hidden envelope");
    const ir = {
      ...createEmptyNarrativeIR("scene-4"),
      payoffsExecuted: ["the hidden envelope revealed"],
    };
    const result = checkSetupPayoffClosure([ir], bible, "scene-4");
    expect(result.passed).toBe(true);
  });

  it("fails when a planted setup has no corresponding payoff", () => {
    const bible = makeBibleWithSetup("the missing student");
    const ir = {
      ...createEmptyNarrativeIR("scene-4"),
      payoffsExecuted: ["unrelated payoff"],
    };
    const result = checkSetupPayoffClosure([ir], bible, "scene-4");
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("dangling");
    expect(result.detail).toContain("1 dangling");
  });

  it("fails with correct count for multiple dangling setups", () => {
    const bible = {
      ...makeBible(),
      narrativeRules: {
        ...makeBible().narrativeRules,
        setups: [
          {
            id: "s1",
            description: "setup alpha",
            plantedInScene: "scene-1",
            payoffInScene: null,
            status: "planted" as const,
          },
          {
            id: "s2",
            description: "setup beta",
            plantedInScene: "scene-2",
            payoffInScene: null,
            status: "planted" as const,
          },
        ],
      },
    };
    const result = checkSetupPayoffClosure([], bible, "scene-4");
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("2 dangling");
  });
});

// ─── Aggregate ──────────────────────────────────────

describe("runAllDeterministicChecks", () => {
  it("runs all checks and returns array", () => {
    const config = createDefaultCompilationConfig();
    const results = runAllDeterministicChecks({
      prose: "Marcus entered the school. The hallway was quiet.",
      sceneId: "scene-1",
      bible: makeBible(),
      plan: makePlan(),
      character: makeCharacter(),
      log: makeLog(),
      lintResult: { issues: [] },
      config,
      metrics: makeMetrics(),
    });

    expect(results.length).toBe(9);
    expect(results.every((r) => r.name && typeof r.passed === "boolean")).toBe(true);
  });

  it("catches kill list failure in aggregate", () => {
    const config = createDefaultCompilationConfig();
    const results = runAllDeterministicChecks({
      prose: "Marcus suddenly turned around.",
      sceneId: "scene-1",
      bible: makeBible(),
      plan: makePlan(),
      character: makeCharacter(),
      log: makeLog(),
      lintResult: { issues: [] },
      config,
      metrics: makeMetrics(),
    });

    const killList = results.find((r) => r.name === "kill_list");
    expect(killList?.passed).toBe(false);
  });
});
