import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { createApiActions } from "../../src/app/store/api-actions.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeAuditFlag, makeChapterArc, makeChunk, makeNarrativeIR } from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

describe("createApiActions", () => {
  let store: ProjectStore;
  let actions: ReturnType<typeof createApiActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
    store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });
    actions = createApiActions(store);
  });

  describe("saveBible", () => {
    it("calls API then updates store", async () => {
      const bible = createEmptyBible("proj-1");
      const saved = { ...bible, version: 2 };
      mockedApi.apiSaveBible.mockResolvedValue(saved);

      await actions.saveBible(bible);

      expect(mockedApi.apiSaveBible).toHaveBeenCalledWith(bible);
      expect(store.bible).toEqual(saved);
    });

    it("sets store error on failure", async () => {
      mockedApi.apiSaveBible.mockRejectedValue(new Error("DB error"));

      await actions.saveBible(createEmptyBible("proj-1"));

      expect(store.error).toBe("DB error");
    });
  });

  describe("saveScenePlan", () => {
    it("calls API then adds to store", async () => {
      const plan = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockResolvedValue(plan);

      await actions.saveScenePlan(plan, 0);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledWith(plan, 0);
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.id).toBe(plan.id);
    });
  });

  describe("saveMultipleScenePlans", () => {
    it("calls API for each plan then bulk-adds to store", async () => {
      const plan1 = createEmptyScenePlan("proj-1");
      const plan2 = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockImplementation(async (p) => p);

      await actions.saveMultipleScenePlans([plan1, plan2]);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledTimes(2);
      expect(store.scenes).toHaveLength(2);
    });
  });

  describe("saveChapterArc", () => {
    it("calls API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiSaveChapterArc.mockResolvedValue(arc);

      await actions.saveChapterArc(arc);

      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("updateChapterArc", () => {
    it("calls update API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiUpdateChapterArc.mockResolvedValue(arc);

      await actions.updateChapterArc(arc);

      expect(mockedApi.apiUpdateChapterArc).toHaveBeenCalledWith(arc);
      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("saveChunk", () => {
    it("calls API to persist chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiSaveChunk.mockResolvedValue(chunk);

      await actions.saveChunk(chunk);

      expect(mockedApi.apiSaveChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("updateChunk", () => {
    it("calls API to update chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiUpdateChunk.mockResolvedValue(chunk);

      await actions.updateChunk(chunk);

      expect(mockedApi.apiUpdateChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("completeScene", () => {
    it("calls API then updates store status", async () => {
      const plan = createEmptyScenePlan("proj-1");
      store.addScenePlan(plan);
      mockedApi.apiUpdateSceneStatus.mockResolvedValue(undefined);

      await actions.completeScene(plan.id);

      expect(mockedApi.apiUpdateSceneStatus).toHaveBeenCalledWith(plan.id, "complete");
      expect(store.scenes[0]!.status).toBe("complete");
    });
  });

  describe("saveSceneIR", () => {
    it("calls create API for new IR then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      mockedApi.apiCreateSceneIR.mockResolvedValue(ir);

      await actions.saveSceneIR("scene-1", ir);

      expect(mockedApi.apiCreateSceneIR).toHaveBeenCalledWith("scene-1", ir);
      expect(store.sceneIRs["scene-1"]).toEqual(ir);
    });
  });

  describe("verifySceneIR", () => {
    it("calls verify API then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      store.setSceneIR("scene-1", ir);
      mockedApi.apiVerifySceneIR.mockResolvedValue(undefined);

      await actions.verifySceneIR("scene-1");

      expect(mockedApi.apiVerifySceneIR).toHaveBeenCalledWith("scene-1");
      expect(store.sceneIRs["scene-1"]!.verified).toBe(true);
    });
  });

  describe("saveAuditFlags", () => {
    it("calls API to persist flags", async () => {
      const flags = [makeAuditFlag()];
      mockedApi.apiSaveAuditFlags.mockResolvedValue(flags);

      await actions.saveAuditFlags(flags);

      expect(mockedApi.apiSaveAuditFlags).toHaveBeenCalledWith(flags);
    });
  });

  describe("resolveAuditFlag", () => {
    it("calls API then updates store", async () => {
      const flag = makeAuditFlag({ id: "flag-1" });
      store.setAudit([flag], null);
      mockedApi.apiResolveAuditFlag.mockResolvedValue(undefined);

      await actions.resolveAuditFlag("flag-1", "fixed it", true);

      expect(mockedApi.apiResolveAuditFlag).toHaveBeenCalledWith("flag-1", "fixed it", true);
      expect(store.auditFlags[0]!.resolved).toBe(true);
    });
  });

  describe("dismissAuditFlag", () => {
    it("calls resolve API with empty action then dismisses in store", async () => {
      const flag = makeAuditFlag({ id: "flag-2" });
      store.setAudit([flag], null);
      mockedApi.apiResolveAuditFlag.mockResolvedValue(undefined);

      await actions.dismissAuditFlag("flag-2");

      expect(mockedApi.apiResolveAuditFlag).toHaveBeenCalledWith("flag-2", "", false);
      expect(store.auditFlags[0]!.resolved).toBe(true);
    });
  });

  describe("saveCompilationLog", () => {
    it("calls API to persist log", async () => {
      const log = {
        id: "log-1",
        chunkId: "c-1",
        payloadHash: "h",
        ring1Tokens: 100,
        ring2Tokens: 200,
        ring3Tokens: 300,
        totalTokens: 600,
        availableBudget: 1000,
        ring1Contents: [],
        ring2Contents: [],
        ring3Contents: [],
        lintWarnings: [],
        lintErrors: [],
        timestamp: "",
      };
      mockedApi.apiSaveCompilationLog.mockResolvedValue(log);

      await actions.saveCompilationLog(log);

      expect(mockedApi.apiSaveCompilationLog).toHaveBeenCalledWith(log);
    });
  });
});
