import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the LLM client module BEFORE importing anything that imports it.
// CRITICAL (review E-C2): fetchModels MUST be stubbed too -- ProjectStore's
// constructor calls it unconditionally.
const generateStream = vi.fn();
const callLLM = vi.fn();
const fetchModels = vi.fn().mockResolvedValue([]);
vi.mock("../../src/llm/client.js", () => ({
  fetchModels: (...args: unknown[]) => fetchModels(...args),
  generateStream: (...args: unknown[]) => generateStream(...args),
  callLLM: (...args: unknown[]) => callLLM(...args),
}));

// Mock the auditor so we don't need a real bible.
vi.mock("../../src/auditor/index.js", () => ({
  runAudit: vi.fn(() => ({ flags: [], metrics: null })),
  checkKillList: vi.fn(() => []),
}));
vi.mock("../../src/auditor/setupReconciler.js", () => ({
  reconcileSetupStatuses: vi.fn((_bible: unknown, _irs: unknown, _orders: unknown, _ids: unknown) => ({
    updatedBible: {},
    changes: [],
  })),
}));
vi.mock("../../src/auditor/subtext.js", () => ({
  checkSubtext: vi.fn(() => []),
}));

import { createGenerationActions } from "../../src/app/store/generation.svelte.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeChunk, makeScenePlan } from "../../src/app/stories/factories.js";
import { createEmptyBible } from "../../src/types/index.js";

function makeCommands() {
  return {
    saveBible: vi.fn().mockResolvedValue({ ok: true }),
    saveScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    updateScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    saveMultipleScenePlans: vi.fn().mockResolvedValue({ ok: true }),
    saveChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    updateChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    saveChunk: vi.fn().mockResolvedValue({ ok: true }),
    updateChunk: vi.fn().mockResolvedValue({ ok: true }),
    persistChunk: vi.fn().mockResolvedValue({ ok: true }),
    removeChunk: vi.fn().mockResolvedValue({ ok: true }),
    deleteChunk: vi.fn().mockResolvedValue({ ok: true }),
    completeScene: vi.fn().mockResolvedValue({ ok: true }),
    saveSceneIR: vi.fn().mockResolvedValue({ ok: true }),
    verifySceneIR: vi.fn().mockResolvedValue({ ok: true }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true }),
    resolveAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    dismissAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    saveCompilationLog: vi.fn().mockResolvedValue({ ok: true }),
    applyRefinement: vi.fn().mockResolvedValue({ ok: true }),
  } as any;
}

function makeStoreWithScene(): ProjectStore {
  const store = new ProjectStore();
  store.setProject({ id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" });
  store.setBible(createEmptyBible("p1"));
  store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
  store.setActiveScene(0);
  // Minimal compiled payload so generation can read model/temperature/topP.
  store.setCompiled(
    {
      systemMessage: "sys",
      userMessage: "user",
      model: "claude-test",
      temperature: 0.8,
      topP: 0.92,
      maxTokens: 1000,
    } as any,
    null,
    null,
  );
  return store;
}

describe("createGenerationActions", () => {
  beforeEach(() => {
    generateStream.mockReset();
    callLLM.mockReset();
    fetchModels.mockClear();
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // --- generateChunk ---

  describe("generateChunk", () => {
    it("sets store.error and removes pending chunk when onError fires", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(async (_p: unknown, h: { onError: (e: string) => void }) =>
        h.onError("llm failure"),
      );
      await actions.generateChunk();
      expect(store.error).toContain("Generation failed");
      expect(commands.saveChunk).not.toHaveBeenCalled();
      expect(store.activeSceneChunks).toHaveLength(0);
    });

    it("treats onDone with empty text and stop reason max_tokens as an error", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(async (_p: unknown, h: { onDone: (u: unknown, r: string) => void }) =>
        h.onDone({}, "max_tokens"),
      );
      await actions.generateChunk();
      expect(store.error).toContain("Empty generation");
      expect(commands.saveChunk).not.toHaveBeenCalled();
      expect(store.activeSceneChunks).toHaveLength(0);
    });

    it("persists the chunk and runs audit on happy-path onDone", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(
        async (_p: unknown, h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void }) => {
          h.onToken("Hello ");
          h.onToken("world.");
          h.onDone({}, "end_turn");
        },
      );
      await actions.generateChunk();
      expect(commands.saveChunk).toHaveBeenCalledTimes(1);
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.activeSceneChunks[0]!.generatedText).toBe("Hello world.");
      expect(store.error).toBeNull();
    });

    it("removes pending chunk on AbortError and does not set error", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(async () => {
        throw new DOMException("aborted", "AbortError");
      });
      await actions.generateChunk();
      expect(store.activeSceneChunks).toHaveLength(0);
      expect(store.error).toBeNull();
      expect(commands.saveChunk).not.toHaveBeenCalled();
    });
  });

  // --- runAuditManual ---

  describe("runAuditManual", () => {
    it("sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(store.error).toContain("missing bible");
      expect(commands.saveAuditFlags).not.toHaveBeenCalled();
    });

    it("sets error when the active scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(store.error).toContain("no chunks");
      expect(commands.saveAuditFlags).not.toHaveBeenCalled();
    });

    it("runs audit and persists flags on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.auditFlags).toEqual([]);
    });
  });

  // --- runDeepAudit ---

  describe("runDeepAudit", () => {
    it("sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(store.error).toContain("missing bible");
    });

    it("sets error when the active scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(store.error).toContain("no chunks");
    });

    it("toggles isAuditing and persists combined flags on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.isAuditing).toBe(false);
    });
  });

  // --- extractSceneIR ---

  describe("extractSceneIR", () => {
    it("sets error when no active scene plan", async () => {
      const store = new ProjectStore();
      store.setBible(createEmptyBible("p1"));
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("no active scene plan");
      expect(callLLM).not.toHaveBeenCalled();
    });

    it("sets error when there are no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("no chunks");
    });

    it("sets error when all chunks are empty prose", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "   " })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("all chunks are empty");
    });

    it("happy path: saves IR, reconciles setups, opens inspector", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "Real prose here." })]);
      // extractIR under the hood delegates to callLLM -- return a minimal IR-shaped JSON.
      // Must have at least one non-empty array so rawToNarrativeIR doesn't throw.
      callLLM.mockResolvedValue(
        JSON.stringify({
          sceneId: "s1",
          events: ["something happened"],
          characterDeltas: [],
          setupsPlanted: [],
          payoffsExecuted: [],
          factsIntroduced: [],
          factsRevealedToReader: [],
          factsWithheld: [],
          characterPositions: {},
          unresolvedTensions: [],
          verified: false,
        }),
      );
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(callLLM).toHaveBeenCalled();
      expect(commands.saveSceneIR).toHaveBeenCalledTimes(1);
      expect(store.irInspectorOpen).toBe(true);
    });
  });

  // --- runAutopilot ---

  describe("runAutopilot", () => {
    it("sets error when no active scene plan / payload / bible", async () => {
      const store = new ProjectStore();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();
      expect(store.error).toContain("missing scene plan");
    });

    it("stops iteration when autopilotCancelled is set mid-loop", async () => {
      const store = makeStoreWithScene();
      const plan = makeScenePlan({ id: "s1", chunkCount: 5 });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.compilationConfig = { ...store.compilationConfig, autopilotMaxChunks: 20 };

      // Cancel after the first chunk is generated.
      let callCount = 0;
      generateStream.mockImplementation(
        async (_p: unknown, h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void }) => {
          callCount++;
          h.onToken("body");
          h.onDone({}, "end_turn");
          // Cancel after first iteration completes
          if (callCount >= 1) {
            store.autopilotCancelled = true;
          }
        },
      );

      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();
      // Should have stopped after 1 chunk due to cancellation, not all 5.
      expect(store.sceneChunks.s1!.length).toBeLessThanOrEqual(2);
      expect(commands.completeScene).not.toHaveBeenCalled();
    });

    // REGRESSION GUARD for PR #68.
    // Scene wants 5 chunks, cap is 2 -> generate exactly 2 and do NOT finalize.
    it("honors autopilotMaxChunks cap and skips finalize when willCompleteScene=false", async () => {
      const store = makeStoreWithScene();
      const plan = makeScenePlan({ id: "s1", chunkCount: 5 });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.compilationConfig = { ...store.compilationConfig, autopilotMaxChunks: 2 };

      generateStream.mockImplementation(
        async (_p: unknown, h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void }) => {
          h.onToken("chunk body");
          h.onDone({}, "end_turn");
        },
      );

      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();

      // Exactly 2 chunks created this run.
      expect(store.sceneChunks.s1).toHaveLength(2);
      // Cap hit -> finalize skipped.
      expect(commands.completeScene).not.toHaveBeenCalled();
      expect(commands.saveSceneIR).not.toHaveBeenCalled();
      expect(store.isAutopilot).toBe(false);
    });

    it("finalizes (completeScene + IR extraction) when run fulfills scene target", async () => {
      const store = makeStoreWithScene();
      const plan = makeScenePlan({ id: "s1", chunkCount: 2 });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.compilationConfig = { ...store.compilationConfig, autopilotMaxChunks: 20 };

      generateStream.mockImplementation(
        async (_p: unknown, h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void }) => {
          h.onToken("body");
          h.onDone({}, "end_turn");
        },
      );
      callLLM.mockResolvedValue(
        JSON.stringify({
          sceneId: "s1",
          events: ["something happened"],
          characterDeltas: [],
          setupsPlanted: [],
          payoffsExecuted: [],
          factsIntroduced: [],
          factsRevealedToReader: [],
          factsWithheld: [],
          characterPositions: {},
          unresolvedTensions: [],
          verified: false,
        }),
      );

      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();

      expect(store.sceneChunks.s1).toHaveLength(2);
      expect(commands.completeScene).toHaveBeenCalledTimes(1);
      expect(commands.saveSceneIR).toHaveBeenCalledTimes(1);
    });
  });

  // --- requestRefinement ---

  describe("requestRefinement", () => {
    const baseReq = {
      sceneId: "s1",
      selectedText: "Hello",
      selectionStart: 0,
      selectionEnd: 5,
      instruction: "tighten",
      chips: [],
    };

    it("returns null and sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq);
      expect(res).toBeNull();
      expect(store.error).toContain("missing bible");
    });

    it("returns null when the scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq);
      expect(res).toBeNull();
      expect(store.error).toContain("no chunks");
    });

    it("returns null and surfaces parse error when variants are empty", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      callLLM.mockResolvedValue("not json at all");
      const commands = makeCommands();
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq);
      expect(res).toBeNull();
      expect(store.error).not.toBeNull();
    });

    it("returns a RefinementResult on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "Hello world text here." }),
      ]);
      callLLM.mockResolvedValue(
        JSON.stringify({
          variants: [{ text: "Refined text.", rationale: "tighter" }],
        }),
      );
      const commands = makeCommands();
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq);
      expect(res).not.toBeNull();
      expect(res!.variants.length).toBeGreaterThan(0);
      expect(res!.requestedAt).toBeDefined();
      expect(res!.completedAt).toBeDefined();
    });
  });
});
