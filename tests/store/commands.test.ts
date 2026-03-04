import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiActions } from "../../src/app/store/api-actions.js";
import { createCommands } from "../../src/app/store/commands.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import {
  makeAuditFlag,
  makeChapterArc,
  makeChunk,
  makeNarrativeIR,
  makeScenePlan,
} from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

function mockActions(): ApiActions {
  return {
    saveBible: vi.fn().mockResolvedValue(undefined),
    saveScenePlan: vi.fn().mockResolvedValue(undefined),
    updateScenePlan: vi.fn().mockResolvedValue(undefined),
    saveMultipleScenePlans: vi.fn().mockResolvedValue(undefined),
    saveChapterArc: vi.fn().mockResolvedValue(undefined),
    updateChapterArc: vi.fn().mockResolvedValue(undefined),
    saveChunk: vi.fn().mockResolvedValue(undefined),
    updateChunk: vi.fn().mockResolvedValue(undefined),
    deleteChunk: vi.fn().mockResolvedValue(undefined),
    completeScene: vi.fn().mockResolvedValue(undefined),
    saveSceneIR: vi.fn().mockResolvedValue(undefined),
    verifySceneIR: vi.fn().mockResolvedValue(undefined),
    saveAuditFlags: vi.fn().mockResolvedValue(undefined),
    resolveAuditFlag: vi.fn().mockResolvedValue(undefined),
    dismissAuditFlag: vi.fn().mockResolvedValue(undefined),
    saveCompilationLog: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createCommands", () => {
  let store: ProjectStore;
  let actions: ApiActions;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
    store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });
    actions = mockActions();
  });

  // ─── saveBible ────────────────────────────────

  describe("saveBible", () => {
    it("delegates to actions when available", async () => {
      const cmds = createCommands(store, actions);
      const bible = createEmptyBible("proj-1");

      const result = await cmds.saveBible(bible);

      expect(result.ok).toBe(true);
      expect(actions.saveBible).toHaveBeenCalledWith(bible);
    });

    it("falls back to store in store-only mode", async () => {
      const cmds = createCommands(store);
      const bible = createEmptyBible("proj-1");

      const result = await cmds.saveBible(bible);

      expect(result.ok).toBe(true);
      expect(store.bible).toEqual(bible);
    });

    it("returns failure and sets store error on exception", async () => {
      (actions.saveBible as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
      const cmds = createCommands(store, actions);

      const result = await cmds.saveBible(createEmptyBible("proj-1"));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("DB error");
      expect(store.error).toBe("DB error");
    });
  });

  // ─── saveScenePlan ────────────────────────────

  describe("saveScenePlan", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const plan = createEmptyScenePlan("proj-1");

      const result = await cmds.saveScenePlan(plan, 0);

      expect(result.ok).toBe(true);
      expect(actions.saveScenePlan).toHaveBeenCalledWith(plan, 0);
    });

    it("adds to store in store-only mode (first plan)", async () => {
      const cmds = createCommands(store);
      const plan = createEmptyScenePlan("proj-1");

      await cmds.saveScenePlan(plan, 0);

      expect(store.scenes).toHaveLength(1);
    });

    it("uses addScenePlan when scenes already exist", async () => {
      const cmds = createCommands(store);
      store.setScenePlan(createEmptyScenePlan("proj-1"));
      const plan2 = createEmptyScenePlan("proj-1");

      await cmds.saveScenePlan(plan2, 1);

      expect(store.scenes).toHaveLength(2);
    });
  });

  // ─── saveMultipleScenePlans ───────────────────

  describe("saveMultipleScenePlans", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const plans = [createEmptyScenePlan("proj-1"), createEmptyScenePlan("proj-1")];

      const result = await cmds.saveMultipleScenePlans(plans);

      expect(result.ok).toBe(true);
      expect(actions.saveMultipleScenePlans).toHaveBeenCalledWith(plans);
    });

    it("bulk-adds to store in store-only mode", async () => {
      const cmds = createCommands(store);
      const plans = [createEmptyScenePlan("proj-1"), createEmptyScenePlan("proj-1")];

      await cmds.saveMultipleScenePlans(plans);

      expect(store.scenes).toHaveLength(2);
    });
  });

  // ─── saveChapterArc / updateChapterArc ────────

  describe("saveChapterArc", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const arc = makeChapterArc();

      const result = await cmds.saveChapterArc(arc);

      expect(result.ok).toBe(true);
      expect(actions.saveChapterArc).toHaveBeenCalledWith(arc);
    });

    it("sets store directly in store-only mode", async () => {
      const cmds = createCommands(store);
      const arc = makeChapterArc();

      await cmds.saveChapterArc(arc);

      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("updateChapterArc", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const arc = makeChapterArc();

      const result = await cmds.updateChapterArc(arc);

      expect(result.ok).toBe(true);
      expect(actions.updateChapterArc).toHaveBeenCalledWith(arc);
    });
  });

  // ─── saveChunk ────────────────────────────────

  describe("saveChunk", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const chunk = makeChunk();

      const result = await cmds.saveChunk(chunk);

      expect(result.ok).toBe(true);
      expect(actions.saveChunk).toHaveBeenCalledWith(chunk);
    });

    it("no-ops silently in store-only mode", async () => {
      const cmds = createCommands(store);
      const chunk = makeChunk();

      const result = await cmds.saveChunk(chunk);

      expect(result.ok).toBe(true);
    });
  });

  // ─── updateChunk ──────────────────────────────

  describe("updateChunk", () => {
    it("mutates store and persists via actions", async () => {
      const cmds = createCommands(store, actions);
      const chunk = makeChunk({ sceneId: "s1", sequenceNumber: 0 });
      store.setSceneChunks("s1", [chunk]);

      const result = await cmds.updateChunk("s1", 0, { status: "accepted" });

      expect(result.ok).toBe(true);
      expect(store.sceneChunks.s1![0]!.status).toBe("accepted");
      expect(actions.updateChunk).toHaveBeenCalled();
    });
  });

  // ─── persistChunk ─────────────────────────────

  describe("persistChunk", () => {
    it("persists without mutating store", async () => {
      const cmds = createCommands(store, actions);
      const chunk = makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "original" });
      store.setSceneChunks("s1", [chunk]);

      const result = await cmds.persistChunk("s1", 0);

      expect(result.ok).toBe(true);
      expect(actions.updateChunk).toHaveBeenCalledWith(expect.objectContaining({ generatedText: "original" }));
    });

    it("no-ops in store-only mode", async () => {
      const cmds = createCommands(store);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1" })]);

      const result = await cmds.persistChunk("s1", 0);

      expect(result.ok).toBe(true);
    });
  });

  // ─── removeChunk ──────────────────────────────

  describe("removeChunk", () => {
    it("deletes from server, renumbers, and persists remaining chunks", async () => {
      const cmds = createCommands(store, actions);
      const c0 = makeChunk({ id: "c0", sceneId: "s1", sequenceNumber: 0 });
      const c1 = makeChunk({ id: "c1", sceneId: "s1", sequenceNumber: 1 });
      const c2 = makeChunk({ id: "c2", sceneId: "s1", sequenceNumber: 2 });
      store.setSceneChunks("s1", [c0, c1, c2]);

      const result = await cmds.removeChunk("s1", 1);

      expect(result.ok).toBe(true);
      expect(actions.deleteChunk).toHaveBeenCalledWith("c1");

      // Remaining chunks renumbered
      const remaining = store.sceneChunks.s1!;
      expect(remaining).toHaveLength(2);
      expect(remaining[0]!.id).toBe("c0");
      expect(remaining[0]!.sequenceNumber).toBe(0);
      expect(remaining[1]!.id).toBe("c2");
      expect(remaining[1]!.sequenceNumber).toBe(1);

      // Renumbered chunks persisted
      expect(actions.updateChunk).toHaveBeenCalledTimes(2);
    });

    it("works in store-only mode", async () => {
      const cmds = createCommands(store);
      const c0 = makeChunk({ id: "c0", sceneId: "s1", sequenceNumber: 0 });
      const c1 = makeChunk({ id: "c1", sceneId: "s1", sequenceNumber: 1 });
      store.setSceneChunks("s1", [c0, c1]);

      const result = await cmds.removeChunk("s1", 0);

      expect(result.ok).toBe(true);
      expect(store.sceneChunks.s1!).toHaveLength(1);
      expect(store.sceneChunks.s1![0]!.sequenceNumber).toBe(0);
    });
  });

  // ─── completeScene ────────────────────────────

  describe("completeScene", () => {
    function setupCompletableScene(store: ProjectStore) {
      const plan = makeScenePlan({ id: "s1", chunkCount: 2 });
      store.addScenePlan(plan);
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0, status: "accepted" }),
        makeChunk({ sceneId: "s1", sequenceNumber: 1, status: "accepted" }),
      ]);
      store.setAudit([], null);
      return plan;
    }

    it("completes scene when gates pass", async () => {
      const cmds = createCommands(store, actions);
      setupCompletableScene(store);

      const result = await cmds.completeScene("s1");

      expect(result.ok).toBe(true);
      expect(actions.completeScene).toHaveBeenCalledWith("s1");
    });

    it("rejects with gate failures when chunks insufficient", async () => {
      const cmds = createCommands(store, actions);
      const plan = makeScenePlan({ id: "s1", chunkCount: 3 });
      store.addScenePlan(plan);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0, status: "accepted" })]);

      const result = await cmds.completeScene("s1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gateFailures).toBeDefined();
        expect(result.gateFailures!.length).toBeGreaterThan(0);
      }
      expect(actions.completeScene).not.toHaveBeenCalled();
    });

    it("rejects with gate failures when unresolved critical audit flags exist", async () => {
      const cmds = createCommands(store, actions);
      setupCompletableScene(store);
      store.setAudit([makeAuditFlag({ severity: "critical", resolved: false })], null);

      const result = await cmds.completeScene("s1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gateFailures).toBeDefined();
        expect(result.gateFailures!.some((m) => m.includes("critical"))).toBe(true);
      }
      expect(store.error).toBeTruthy();
    });

    it("works in store-only mode when gates pass", async () => {
      const cmds = createCommands(store);
      setupCompletableScene(store);

      const result = await cmds.completeScene("s1");

      expect(result.ok).toBe(true);
      expect(store.scenes[0]!.status).toBe("complete");
    });

    it("returns failure for nonexistent scene", async () => {
      const cmds = createCommands(store, actions);

      const result = await cmds.completeScene("nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("Scene not found");
    });
  });

  // ─── saveAuditFlags ───────────────────────────

  describe("saveAuditFlags", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const flags = [makeAuditFlag()];

      const result = await cmds.saveAuditFlags(flags);

      expect(result.ok).toBe(true);
      expect(actions.saveAuditFlags).toHaveBeenCalledWith(flags);
    });
  });

  // ─── resolveAuditFlag ─────────────────────────

  describe("resolveAuditFlag", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);

      const result = await cmds.resolveAuditFlag("f1", "fixed", true);

      expect(result.ok).toBe(true);
      expect(actions.resolveAuditFlag).toHaveBeenCalledWith("f1", "fixed", true);
    });

    it("resolves in store directly in store-only mode", async () => {
      const cmds = createCommands(store);
      store.setAudit([makeAuditFlag({ id: "f1" })], null);

      await cmds.resolveAuditFlag("f1", "fixed", true);

      expect(store.auditFlags[0]!.resolved).toBe(true);
    });
  });

  // ─── dismissAuditFlag ─────────────────────────

  describe("dismissAuditFlag", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);

      const result = await cmds.dismissAuditFlag("f1");

      expect(result.ok).toBe(true);
      expect(actions.dismissAuditFlag).toHaveBeenCalledWith("f1");
    });

    it("dismisses in store directly in store-only mode", async () => {
      const cmds = createCommands(store);
      store.setAudit([makeAuditFlag({ id: "f1" })], null);

      await cmds.dismissAuditFlag("f1");

      expect(store.auditFlags[0]!.resolved).toBe(true);
      expect(store.auditFlags[0]!.wasActionable).toBe(false);
    });
  });

  // ─── saveSceneIR ──────────────────────────────

  describe("saveSceneIR", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const ir = makeNarrativeIR();

      const result = await cmds.saveSceneIR("s1", ir);

      expect(result.ok).toBe(true);
      expect(actions.saveSceneIR).toHaveBeenCalledWith("s1", ir);
    });

    it("sets store directly in store-only mode", async () => {
      const cmds = createCommands(store);
      const ir = makeNarrativeIR();

      await cmds.saveSceneIR("s1", ir);

      expect(store.sceneIRs.s1).toEqual(ir);
    });
  });

  // ─── verifySceneIR ────────────────────────────

  describe("verifySceneIR", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);

      const result = await cmds.verifySceneIR("s1");

      expect(result.ok).toBe(true);
      expect(actions.verifySceneIR).toHaveBeenCalledWith("s1");
    });

    it("verifies in store directly in store-only mode", async () => {
      const cmds = createCommands(store);
      store.setSceneIR("s1", makeNarrativeIR());

      await cmds.verifySceneIR("s1");

      expect(store.sceneIRs.s1!.verified).toBe(true);
    });
  });

  // ─── applyRefinement ──────────────────────────

  describe("applyRefinement", () => {
    function setupChunks(store: ProjectStore, texts: string[]) {
      const chunks = texts.map((text, i) =>
        makeChunk({ id: `c${i}`, sceneId: "s1", sequenceNumber: i, generatedText: text }),
      );
      store.setSceneChunks("s1", chunks);
      return chunks;
    }

    it("splices replacement into the middle of a single chunk", async () => {
      const cmds = createCommands(store);
      // "Hello world." — offsets 0..12
      setupChunks(store, ["Hello world."]);

      const result = await cmds.applyRefinement("s1", 6, 11, "earth");

      expect(result.ok).toBe(true);
      expect(store.sceneChunks.s1![0]!.editedText).toBe("Hello earth.");
    });

    it("splices across two chunk boundaries", async () => {
      const cmds = createCommands(store);
      // "AB\n\nCD" — chunk0=[0,2), chunk1=[4,6)
      setupChunks(store, ["AB", "CD"]);

      // Replace from offset 1 (within chunk0) to offset 5 (within chunk1)
      const result = await cmds.applyRefinement("s1", 1, 5, "XY");

      expect(result.ok).toBe(true);
      // First chunk: "A" + replacement "XY"
      expect(store.sceneChunks.s1![0]!.editedText).toBe("AXY");
      // Last chunk: "D" (remaining after offset 5 within chunk1 = localEnd 1)
      expect(store.sceneChunks.s1![1]!.editedText).toBe("D");
    });

    it("handles cut (empty replacement)", async () => {
      const cmds = createCommands(store);
      setupChunks(store, ["Hello world."]);

      const result = await cmds.applyRefinement("s1", 5, 11, "");

      expect(result.ok).toBe(true);
      expect(store.sceneChunks.s1![0]!.editedText).toBe("Hello.");
    });

    it("empties middle chunks when spanning three", async () => {
      const cmds = createCommands(store);
      // "AA\n\nBB\n\nCC" — chunk0=[0,2), chunk1=[4,6), chunk2=[8,10)
      setupChunks(store, ["AA", "BB", "CC"]);

      // Replace from offset 1 to offset 9 — spans all three chunks
      const result = await cmds.applyRefinement("s1", 1, 9, "Z");

      expect(result.ok).toBe(true);
      expect(store.sceneChunks.s1![0]!.editedText).toBe("AZ");
      expect(store.sceneChunks.s1![1]!.editedText).toBe("");
      expect(store.sceneChunks.s1![2]!.editedText).toBe("C");
    });

    it("returns failure for empty scene", async () => {
      const cmds = createCommands(store);

      const result = await cmds.applyRefinement("s1", 0, 5, "X");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("No chunks found for scene");
    });

    it("returns failure when selection falls in separator gap", async () => {
      const cmds = createCommands(store);
      // "AB\n\nCD" — gap is [2,4)
      setupChunks(store, ["AB", "CD"]);

      const result = await cmds.applyRefinement("s1", 2, 4, "X");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("No chunks found for selection range");
    });

    it("returns failure when bounds are out of range after text changes", async () => {
      const cmds = createCommands(store);
      // "Hi" — only 2 chars
      setupChunks(store, ["Hi"]);

      // Selection range extends beyond chunk text
      const result = await cmds.applyRefinement("s1", 0, 10, "X");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("bounds out of range");
    });
  });

  // ─── saveCompilationLog ───────────────────────

  describe("saveCompilationLog", () => {
    it("delegates to actions", async () => {
      const cmds = createCommands(store, actions);
      const log = {
        id: "log-1",
        chunkId: "c-1",
        payloadHash: "h",
        ring1Tokens: 100,
        ring2Tokens: 200,
        ring3Tokens: 300,
        totalTokens: 600,
        availableBudget: 1000,
        ring1Contents: [] as string[],
        ring2Contents: [] as string[],
        ring3Contents: [] as string[],
        lintWarnings: [] as string[],
        lintErrors: [] as string[],
        timestamp: "",
      };

      const result = await cmds.saveCompilationLog(log);

      expect(result.ok).toBe(true);
      expect(actions.saveCompilationLog).toHaveBeenCalledWith(log);
    });

    it("no-ops in store-only mode", async () => {
      const cmds = createCommands(store);
      const log = {
        id: "log-1",
        chunkId: "c-1",
        payloadHash: "h",
        ring1Tokens: 100,
        ring2Tokens: 200,
        ring3Tokens: 300,
        totalTokens: 600,
        availableBudget: 1000,
        ring1Contents: [] as string[],
        ring2Contents: [] as string[],
        ring3Contents: [] as string[],
        lintWarnings: [] as string[],
        lintErrors: [] as string[],
        timestamp: "",
      };

      const result = await cmds.saveCompilationLog(log);

      expect(result.ok).toBe(true);
    });
  });
});
