/**
 * Integration test: Full 4-scene chapter workflow.
 *
 * Validates the compile pipeline end-to-end:
 * - Ring 1+2+3 assembly and budget enforcement
 * - Cross-scene continuity bridge
 * - All six gates enforced at appropriate checkpoints
 * - Audit trust tracking
 * - Bible versioning
 * - Scene status transitions
 */
import { describe, expect, it } from "vitest";
import { getAuditStats, runAudit } from "../../src/auditor/index.js";
import { createBibleVersion, diffBibles } from "../../src/bible/versioning.js";
import { compilePayload } from "../../src/compiler/assembler.js";
import {
  checkAuditResolutionGate,
  checkBibleVersioningGate,
  checkChunkReviewGate,
  checkCompileGate,
  checkSceneCompletionGate,
  checkScenePlanGate,
} from "../../src/gates/index.js";
import {
  type AuditFlag,
  type Bible,
  type ChapterArc,
  type Chunk,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyChapterArc,
  createEmptyScenePlan,
  generateId,
  type ScenePlan,
} from "../../src/types/index.js";

// ─── Test Data Setup ───────────────────────────────

function makeBible(): Bible {
  return {
    ...createEmptyBible("test-project"),
    characters: [
      {
        id: "marcus",
        name: "Marcus",
        role: "protagonist",
        physicalDescription: "Tall, angular, perpetually rumpled suit",
        backstory: "Former journalist turned schoolteacher",
        selfNarrative: "He tells himself he chose teaching. The truth is murkier.",
        contradictions: ["Claims not to care; shows up every day"],
        voice: {
          sentenceLengthRange: [4, 18],
          vocabularyNotes: "Precise but informal. Newspaper diction.",
          verbalTics: ["Look,", "The thing is"],
          metaphoricRegister: "Mechanical — gears, engines, pressure",
          prohibitedLanguage: ["literally", "actually"],
          dialogueSamples: [
            "Look, I'm not saying it's a conspiracy. I'm saying someone moved the letters.",
            "The thing is, nobody remembers hiring the substitute.",
          ],
        },
        behavior: {
          stressResponse: "Gets very still, then paces",
          socialPosture: "Deflects with questions",
          noticesFirst: "Exits and inconsistencies",
          lyingStyle: "Omission, not fabrication",
          emotionPhysicality: "Jaw tension, hand in pocket",
        },
      },
      {
        id: "elena",
        name: "Elena",
        role: "supporting",
        physicalDescription: "Small, sharp-eyed, always carrying a thermos",
        backstory: null,
        selfNarrative: null,
        contradictions: null,
        voice: {
          sentenceLengthRange: [3, 12],
          vocabularyNotes: "Clipped. Economy of words.",
          verbalTics: [],
          metaphoricRegister: null,
          prohibitedLanguage: [],
          dialogueSamples: ["Not my problem. Not yet."],
        },
        behavior: null,
      },
    ],
    locations: [
      {
        id: "loc-school",
        name: "Northfield School",
        description: "A crumbling red-brick school with too many shadows",
        sensoryPalette: {
          sounds: ["chalk on board", "distant radiator clang", "rubber soles on linoleum"],
          smells: ["floor wax", "old paper"],
          textures: ["cold metal door handles", "gritty windowsills"],
          lightQuality: "Fluorescent flicker",
          atmosphere: "Institutional decay with pockets of warmth",
          prohibitedDefaults: ["sunlight streaming"],
        },
      },
    ],
    styleGuide: {
      ...createEmptyBible("test").styleGuide,
      killList: [
        { pattern: "suddenly", type: "exact" },
        { pattern: "he realized", type: "exact" },
      ],
      negativeExemplars: [
        {
          text: "He suddenly realized the truth and felt a wave of sadness wash over him.",
          annotation: "Tells emotion, uses 'suddenly' and 'realized'",
        },
      ],
    },
    narrativeRules: {
      pov: {
        default: "close-third",
        distance: "close",
        interiority: "filtered",
        reliability: "reliable",
      },
      subtextPolicy: "Characters never state their actual feelings directly",
      expositionPolicy: "Embed in action or dialogue, never narrate backstory",
      sceneEndingPolicy: "End on a question or unresolved tension",
      setups: [
        { id: "s1", description: "The missing letters", plantedInScene: null, payoffInScene: null, status: "planned" },
        { id: "s2", description: "Elena's thermos", plantedInScene: "scene-1", payoffInScene: null, status: "planted" },
      ],
    },
  };
}

function makeScenePlans(): ScenePlan[] {
  const base = {
    projectId: "test-project",
    chapterId: "ch1",
    povCharacterId: "marcus",
    povDistance: "close" as const,
    readerStateEntering: null,
    readerStateExiting: null,
    characterKnowledgeChanges: {},
    subtext: null,
    pacing: null,
    density: "moderate" as const,
    sensoryNotes: null,
    sceneSpecificProhibitions: [],
    anchorLines: [],
    estimatedWordCount: [400, 600] as [number, number],
    chunkCount: 3,
    chunkDescriptions: [],
    locationId: "loc-school",
    presentCharacterIds: [],
  };

  return [
    {
      ...base,
      id: "scene-1",
      title: "The Empty Desk",
      narrativeGoal: "Establish the mystery — a teacher is missing",
      emotionalBeat: "Unease beneath routine",
      readerEffect: "Something is wrong but nobody says it",
      failureModeToAvoid: "Stating emotions directly",
      dialogueConstraints: { elena: ["Guarded", "Avoids direct answers"] },
    },
    {
      ...base,
      id: "scene-2",
      title: "The Staff Room",
      narrativeGoal: "Deepen suspicion — facts don't add up",
      emotionalBeat: "Growing paranoia",
      readerEffect: "Distrust the official story",
      failureModeToAvoid: "Info-dump through dialogue",
      dialogueConstraints: { elena: ["Slightly more open"] },
    },
    {
      ...base,
      id: "scene-3",
      title: "After Hours",
      narrativeGoal: "Discovery — something hidden in the classroom",
      emotionalBeat: "Dread",
      readerEffect: "Feel physical tension",
      failureModeToAvoid: "Melodrama",
      dialogueConstraints: {},
    },
    {
      ...base,
      id: "scene-4",
      title: "The Corridor",
      narrativeGoal: "Confrontation without resolution",
      emotionalBeat: "Controlled fury",
      readerEffect: "Feel the weight of what's unsaid",
      failureModeToAvoid: "Climactic resolution too early",
      dialogueConstraints: { elena: ["Direct for the first time"] },
    },
  ];
}

function makeChapterArc(): ChapterArc {
  return {
    ...createEmptyChapterArc("test-project", 1),
    workingTitle: "The Letters",
    narrativeFunction: "Establish the central mystery and Marcus's isolation",
    dominantRegister: "literary realism with thriller undertones",
    pacingTarget: "slow build to dread",
    endingPosture: "question mark — no resolution",
    readerStateEntering: {
      knows: ["Marcus is a teacher"],
      suspects: [],
      wrongAbout: [],
      activeTensions: [],
    },
    readerStateExiting: {
      knows: ["Marcus is a teacher", "A colleague is missing", "Letters were moved"],
      suspects: ["Elena knows more than she says"],
      wrongAbout: [],
      activeTensions: ["Who moved the letters?", "Where is the missing teacher?"],
    },
  };
}

function simulateChunk(sceneId: string, seq: number, text: string): Chunk {
  return {
    id: generateId(),
    sceneId,
    sequenceNumber: seq,
    generatedText: text,
    payloadHash: generateId(),
    model: "test-model",
    temperature: 0.8,
    topP: 0.92,
    generatedAt: new Date().toISOString(),
    status: "pending",
    editedText: null,
    humanNotes: null,
  };
}

// ─── Tests ─────────────────────────────────────────

const config = createDefaultCompilationConfig();

describe("4-scene chapter end-to-end workflow", () => {
  const bible = makeBible();
  const scenePlans = makeScenePlans();
  const chapterArc = makeChapterArc();

  // ─── Scene 1: Compile + Simulate Chunks ────────

  describe("Scene 1: compilation and chunk workflow", () => {
    it("scene plan gate passes", () => {
      const gate = checkScenePlanGate(scenePlans[0]!);
      expect(gate.passed).toBe(true);
    });

    it("compiles with Ring 1 + Ring 2 + Ring 3", () => {
      const result = compilePayload(bible, scenePlans[0]!, [], 0, config, chapterArc);
      expect(result.payload.systemMessage).toBeTruthy();
      expect(result.payload.userMessage).toBeTruthy();

      // Ring 2 should be present (chapter context)
      expect(result.log.ring2Tokens).toBeGreaterThan(0);
      expect(result.log.ring2Contents).toContain("CHAPTER_BRIEF");

      // Ring 1 should have voice specs
      expect(result.log.ring1Contents).toContain("HEADER");

      // Ring 3 should have scene contract
      expect(result.log.ring3Contents).toContain("SCENE_CONTRACT");
    });

    it("compile gate passes (no lint errors)", () => {
      const result = compilePayload(bible, scenePlans[0]!, [], 0, config, chapterArc);
      const gate = checkCompileGate(result.lintResult);
      expect(gate.passed).toBe(true);
    });

    it("total tokens within budget", () => {
      const result = compilePayload(bible, scenePlans[0]!, [], 0, config, chapterArc);
      const available = config.modelContextWindow - config.reservedForOutput;
      expect(result.log.totalTokens).toBeLessThanOrEqual(available);
    });

    it("chunk review gate blocks unreviewed chunks", () => {
      const chunk = simulateChunk("scene-1", 0, "Marcus sat at the empty desk.");
      const gate = checkChunkReviewGate(chunk);
      expect(gate.passed).toBe(false);
    });

    it("chunk review gate passes after acceptance", () => {
      const chunk = simulateChunk("scene-1", 0, "Marcus sat at the empty desk.");
      chunk.status = "accepted";
      const gate = checkChunkReviewGate(chunk);
      expect(gate.passed).toBe(true);
    });

    it("scene completion gate blocks until all chunks reviewed", () => {
      const chunks = [
        { ...simulateChunk("scene-1", 0, "Text one."), status: "accepted" as const },
        { ...simulateChunk("scene-1", 1, "Text two."), status: "accepted" as const },
      ];
      // Only 2 of 3 chunks
      const gate = checkSceneCompletionGate(chunks, scenePlans[0]!);
      expect(gate.passed).toBe(false);
    });

    it("scene completion gate passes with all chunks reviewed", () => {
      const chunks = [
        { ...simulateChunk("scene-1", 0, "Text one."), status: "accepted" as const },
        { ...simulateChunk("scene-1", 1, "Text two."), status: "edited" as const },
        { ...simulateChunk("scene-1", 2, "Text three."), status: "accepted" as const },
      ];
      const gate = checkSceneCompletionGate(chunks, scenePlans[0]!);
      expect(gate.passed).toBe(true);
    });
  });

  // ─── Scene 2: Cross-Scene Bridge ───────────────

  describe("Scene 2: cross-scene continuity bridge", () => {
    it("first chunk of scene 2 includes previous scene text", () => {
      const prevSceneLastChunk = simulateChunk(
        "scene-1",
        2,
        "Elena set down her thermos. The fluorescent light hummed. Nobody mentioned the empty desk.",
      );
      prevSceneLastChunk.status = "accepted";

      const result = compilePayload(bible, scenePlans[1]!, [], 0, config, chapterArc, prevSceneLastChunk);

      // User message should contain the bridge text
      expect(result.payload.userMessage).toContain("previous scene");
      expect(result.payload.userMessage).toContain("empty desk");
      expect(result.log.ring3Contents).toContain("CONTINUITY_BRIDGE");
    });

    it("chapter context (Ring 2) persists across scenes", () => {
      const result = compilePayload(bible, scenePlans[1]!, [], 0, config, chapterArc);
      expect(result.log.ring2Contents).toContain("CHAPTER_BRIEF");
      // Reader state should be present
      expect(result.payload.userMessage).toContain("CHAPTER CONTEXT");
    });
  });

  // ─── Audit and Trust Tracking ──────────────────

  describe("audit workflow", () => {
    it("audit detects kill list violations", () => {
      const proseWithViolation = "Marcus suddenly looked up. He realized the desk was empty.";
      const { flags } = runAudit(proseWithViolation, bible, "scene-1");
      const killListFlags = flags.filter((f) => f.category === "kill_list");
      expect(killListFlags.length).toBeGreaterThanOrEqual(2); // "suddenly" and "he realized"
    });

    it("audit resolution gate blocks on unresolved critical flags", () => {
      const flags: AuditFlag[] = [
        {
          id: "af1",
          sceneId: "scene-1",
          severity: "critical",
          category: "kill_list",
          message: "Avoid list: suddenly",
          lineReference: "line 1",
          resolved: false,
          resolvedAction: null,
          wasActionable: null,
        },
      ];
      const gate = checkAuditResolutionGate(flags);
      expect(gate.passed).toBe(false);
    });

    it("audit resolution gate passes after resolving critical flags", () => {
      const flags: AuditFlag[] = [
        {
          id: "af1",
          sceneId: "scene-1",
          severity: "critical",
          category: "kill_list",
          message: "Avoid list: suddenly",
          lineReference: "line 1",
          resolved: true,
          resolvedAction: "Removed the word",
          wasActionable: true,
        },
      ];
      const gate = checkAuditResolutionGate(flags);
      expect(gate.passed).toBe(true);
    });

    it("signal-to-noise ratio tracks across resolved flags", () => {
      const flags: AuditFlag[] = [
        {
          id: "af1",
          sceneId: "s1",
          severity: "critical",
          category: "kill_list",
          message: "Avoid list: suddenly",
          lineReference: "line 1",
          resolved: true,
          resolvedAction: "Removed",
          wasActionable: true,
        },
        {
          id: "af2",
          sceneId: "s1",
          severity: "warning",
          category: "rhythm_monotony",
          message: "Low variance",
          lineReference: null,
          resolved: true,
          resolvedAction: "False positive",
          wasActionable: false,
        },
        {
          id: "af3",
          sceneId: "s1",
          severity: "critical",
          category: "kill_list",
          message: "Avoid list: realized",
          lineReference: "line 2",
          resolved: true,
          resolvedAction: "Rewrote sentence",
          wasActionable: true,
        },
      ];
      const stats = getAuditStats(flags);
      expect(stats.signalToNoiseRatio).toBeCloseTo(0.667, 2); // 2/3
      expect(stats.byCategory.kill_list!.actionable).toBe(2);
    });
  });

  // ─── Bible Versioning ─────────────────────────

  describe("bible versioning", () => {
    it("modifying bible creates new version", () => {
      const v1 = bible;
      const v2 = createBibleVersion(v1);
      expect(v2.version).toBe(v1.version + 1);
    });

    it("versioning gate detects stale bible", () => {
      const gate = checkBibleVersioningGate(bible, bible.version + 1);
      expect(gate.passed).toBe(false);
    });

    it("versioning gate passes with current bible", () => {
      const gate = checkBibleVersioningGate(bible, bible.version);
      expect(gate.passed).toBe(true);
    });

    it("diff detects added kill list entry", () => {
      const v2: Bible = {
        ...bible,
        version: 2,
        styleGuide: {
          ...bible.styleGuide,
          killList: [...bible.styleGuide.killList, { pattern: "very", type: "exact" }],
        },
      };
      const diffs = diffBibles(bible, v2);
      expect(diffs.some((d) => d.area === "kill_list" && d.type === "added")).toBe(true);
    });
  });

  // ─── All Scenes Compile ────────────────────────

  describe("all 4 scenes compile successfully", () => {
    it("each scene produces a valid payload", () => {
      for (let i = 0; i < scenePlans.length; i++) {
        const plan = scenePlans[i]!;
        const prevChunk = i > 0 ? simulateChunk(scenePlans[i - 1]!.id, 2, "Previous scene final text.") : undefined;

        const result = compilePayload(bible, plan, [], 0, config, chapterArc, prevChunk);

        expect(result.payload.systemMessage.length).toBeGreaterThan(0);
        expect(result.payload.userMessage.length).toBeGreaterThan(0);
        expect(result.log.totalTokens).toBeGreaterThan(0);
        expect(result.log.ring2Tokens).toBeGreaterThan(0);

        // Compile gate should pass for all scenes
        const gate = checkCompileGate(result.lintResult);
        expect(gate.passed).toBe(true);
      }
    });
  });

  // ─── Six Gates Summary ─────────────────────────

  describe("all six gates enforced at correct checkpoints", () => {
    it("Gate 1 (scene plan) blocks empty plans", () => {
      const emptyPlan = createEmptyScenePlan("test");
      expect(checkScenePlanGate(emptyPlan).passed).toBe(false);
    });

    it("Gate 2 (compile) allows warnings", () => {
      // A compile result with only warnings should pass
      const result = compilePayload(bible, scenePlans[0]!, [], 0, config, chapterArc);
      const _warnings = result.lintResult.issues.filter((i) => i.severity === "warning");
      const errors = result.lintResult.issues.filter((i) => i.severity === "error");
      // Even if there are warnings, gate passes if no errors
      expect(checkCompileGate(result.lintResult).passed).toBe(errors.length === 0);
    });

    it("Gate 3 (chunk review) requires accepted/edited", () => {
      const pending = simulateChunk("s1", 0, "Text");
      expect(checkChunkReviewGate(pending).passed).toBe(false);
      pending.status = "accepted";
      expect(checkChunkReviewGate(pending).passed).toBe(true);
    });

    it("Gate 4 (scene completion) requires all chunks", () => {
      const plan = scenePlans[0]!;
      expect(checkSceneCompletionGate([], plan).passed).toBe(false);
    });

    it("Gate 5 (audit) allows non-critical unresolved", () => {
      const flags: AuditFlag[] = [
        {
          id: "x",
          sceneId: "s1",
          severity: "warning",
          category: "test",
          message: "test",
          lineReference: null,
          resolved: false,
          resolvedAction: null,
          wasActionable: null,
        },
      ];
      expect(checkAuditResolutionGate(flags).passed).toBe(true);
    });

    it("Gate 6 (bible version) requires current version", () => {
      expect(checkBibleVersioningGate(bible, bible.version).passed).toBe(true);
      expect(checkBibleVersioningGate(bible, bible.version + 1).passed).toBe(false);
    });
  });
});
