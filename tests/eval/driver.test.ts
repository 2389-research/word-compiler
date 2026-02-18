import { describe, it, expect } from "vitest";
import { runChapterWorkflow, type GenerateFn } from "../../eval/driver.js";
import {
  createEmptyBible,
  createEmptyScenePlan,
  createEmptyChapterArc,
  createDefaultCompilationConfig,
  type Bible,
  type ScenePlan,
  type ChapterArc,
} from "../../src/types/index.js";

// ─── Test Fixtures ──────────────────────────────────

function makeBible(): Bible {
  return {
    ...createEmptyBible("test"),
    characters: [
      {
        id: "marcus",
        name: "Marcus",
        role: "protagonist",
        physicalDescription: "Tall, angular",
        backstory: "Former journalist",
        selfNarrative: null,
        contradictions: null,
        voice: {
          sentenceLengthRange: [4, 18],
          vocabularyNotes: "Precise but informal",
          verbalTics: ["Look,"],
          metaphoricRegister: "Mechanical",
          prohibitedLanguage: ["literally"],
          dialogueSamples: ["Look, nobody remembers."],
        },
        behavior: null,
      },
    ],
    styleGuide: {
      ...createEmptyBible("test").styleGuide,
      killList: [{ pattern: "suddenly", type: "exact" }],
    },
  };
}

function makeScenePlans(): ScenePlan[] {
  const base = {
    ...createEmptyScenePlan("test"),
    chapterId: "ch1",
    povCharacterId: "marcus",
    estimatedWordCount: [100, 200] as [number, number],
    chunkCount: 2,
    locationId: null,
  };

  return [
    {
      ...base,
      id: "scene-1",
      title: "Opening",
      narrativeGoal: "Establish setting",
      failureModeToAvoid: "Info dump",
    },
    {
      ...base,
      id: "scene-2",
      title: "Escalation",
      narrativeGoal: "Raise tension",
      failureModeToAvoid: "Melodrama",
    },
  ];
}

function makeArc(): ChapterArc {
  return {
    ...createEmptyChapterArc("test", 1),
    workingTitle: "Test Chapter",
    narrativeFunction: "Establish mystery",
    dominantRegister: "literary realism",
    pacingTarget: "slow build",
    endingPosture: "open question",
  };
}

// Mock generator: returns deterministic text based on chunk context
const mockGenerate: GenerateFn = async (payload) => {
  const chunkMatch = payload.userMessage.match(/section (\d+) of (\d+)/);
  const chunkNum = chunkMatch ? chunkMatch[1] : "1";
  const totalChunks = chunkMatch ? chunkMatch[2] : "2";

  return `Marcus walked through the corridor. The lights flickered overhead, casting long shadows on the walls. He counted the doors — seven on the left, eight on the right. Someone had moved the furniture again.\n\nThis is chunk ${chunkNum} of ${totalChunks}. The hallway stretched on. He kept walking.`;
};

// ─── Tests ──────────────────────────────────────────

describe("runChapterWorkflow", () => {
  const config = createDefaultCompilationConfig();

  it("produces results for all scenes", async () => {
    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      { generateFn: mockGenerate, config },
    );

    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]!.sceneId).toBe("scene-1");
    expect(result.scenes[1]!.sceneId).toBe("scene-2");
  });

  it("generates correct number of chunks per scene", async () => {
    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      { generateFn: mockGenerate, config },
    );

    // Each scene has chunkCount = 2
    expect(result.scenes[0]!.chunks).toHaveLength(2);
    expect(result.scenes[1]!.chunks).toHaveLength(2);
    expect(result.allChunks).toHaveLength(4);
  });

  it("accumulates all prose", async () => {
    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      { generateFn: mockGenerate, config },
    );

    expect(result.allProse.length).toBeGreaterThan(0);
    expect(result.allProse).toContain("Marcus walked");
  });

  it("each chunk has metrics and audit flags", async () => {
    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      { generateFn: mockGenerate, config },
    );

    for (const scene of result.scenes) {
      for (const chunk of scene.chunks) {
        expect(chunk.metrics.wordCount).toBeGreaterThan(0);
        expect(chunk.metrics.sentenceCount).toBeGreaterThan(0);
        expect(Array.isArray(chunk.auditFlags)).toBe(true);
      }
    }
  });

  it("scene results include compilation log and lint", async () => {
    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      { generateFn: mockGenerate, config },
    );

    for (const scene of result.scenes) {
      expect(scene.compilationLog.totalTokens).toBeGreaterThan(0);
      expect(scene.lintResult).toBeDefined();
    }
  });

  it("calls onSceneComplete callback", async () => {
    const completed: string[] = [];
    await runChapterWorkflow(
      makeBible(),
      makeArc(),
      makeScenePlans(),
      {
        generateFn: mockGenerate,
        config,
        onSceneComplete: (sceneId) => completed.push(sceneId),
      },
    );

    expect(completed).toEqual(["scene-1", "scene-2"]);
  });

  it("handles single scene with one chunk", async () => {
    const singlePlan: ScenePlan[] = [{
      ...createEmptyScenePlan("test"),
      id: "scene-solo",
      title: "Solo Scene",
      narrativeGoal: "Test single scene",
      failureModeToAvoid: "None",
      chunkCount: 1,
      estimatedWordCount: [50, 100],
    }];

    const result = await runChapterWorkflow(
      makeBible(),
      makeArc(),
      singlePlan,
      { generateFn: mockGenerate, config },
    );

    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0]!.chunks).toHaveLength(1);
    expect(result.allChunks).toHaveLength(1);
  });

  it("detects kill list violations in generated text", async () => {
    const badGenerate: GenerateFn = async () =>
      "Marcus suddenly turned around. He realized the door was open.";

    const bible = makeBible();
    const result = await runChapterWorkflow(
      bible,
      makeArc(),
      makeScenePlans(),
      { generateFn: badGenerate, config },
    );

    // At least some chunks should have kill list flags
    const allFlags = result.scenes.flatMap((s) => s.chunks.flatMap((c) => c.auditFlags));
    const killListFlags = allFlags.filter((f) => f.category === "kill_list");
    expect(killListFlags.length).toBeGreaterThan(0);
  });
});

describe("mock mode consistency", () => {
  const config = createDefaultCompilationConfig();

  it("produces identical deterministic check results across runs", async () => {
    // Same mock generator producing identical text each time
    const stableGenerate: GenerateFn = async () =>
      "Marcus walked through the corridor. The lights flickered. He counted the doors.";

    const runOnce = async () =>
      runChapterWorkflow(makeBible(), makeArc(), makeScenePlans(), {
        generateFn: stableGenerate,
        config,
      });

    const run1 = await runOnce();
    const run2 = await runOnce();

    // Prose should be identical
    expect(run1.allProse).toBe(run2.allProse);

    // Chunk counts should match
    expect(run1.allChunks.length).toBe(run2.allChunks.length);

    // Per-chunk metrics should match
    for (let i = 0; i < run1.scenes.length; i++) {
      const scene1 = run1.scenes[i]!;
      const scene2 = run2.scenes[i]!;
      expect(scene1.chunks.length).toBe(scene2.chunks.length);
      for (let j = 0; j < scene1.chunks.length; j++) {
        expect(scene1.chunks[j]!.metrics.wordCount).toBe(scene2.chunks[j]!.metrics.wordCount);
        expect(scene1.chunks[j]!.metrics.sentenceCount).toBe(scene2.chunks[j]!.metrics.sentenceCount);
      }
    }
  });

  it("audit flag counts are consistent across mock runs", async () => {
    const stableGenerate: GenerateFn = async () =>
      "Marcus suddenly turned. The gears ground to a halt. He literally could not believe it.";

    const runOnce = async () =>
      runChapterWorkflow(makeBible(), makeArc(), makeScenePlans(), {
        generateFn: stableGenerate,
        config,
      });

    const run1 = await runOnce();
    const run2 = await runOnce();

    const flags1 = run1.scenes.flatMap((s) => s.chunks.flatMap((c) => c.auditFlags));
    const flags2 = run2.scenes.flatMap((s) => s.chunks.flatMap((c) => c.auditFlags));

    // Same number of flags
    expect(flags1.length).toBe(flags2.length);

    // Same categories
    const cats1 = flags1.map((f) => f.category).sort();
    const cats2 = flags2.map((f) => f.category).sort();
    expect(cats1).toEqual(cats2);
  });
});
