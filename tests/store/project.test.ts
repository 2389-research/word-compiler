import { beforeEach, describe, expect, it, vi } from "vitest";

// CRITICAL (review E-C2): ProjectStore's constructor calls fetchModels()
// from src/llm/client.js. Without this mock, every `new ProjectStore()`
// call crashes with `TypeError: fetchModels is not a function`.
vi.mock("../../src/llm/client.js", () => ({
  fetchModels: vi.fn().mockResolvedValue([]),
  generateStream: vi.fn(),
  callLLM: vi.fn(),
}));

import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeAuditFlag, makeChunk, makeNarrativeIR, makeScenePlan } from "../../src/app/stories/factories.js";
import { createDefaultCompilationConfig, createEmptyBible } from "../../src/types/index.js";

describe("ProjectStore", () => {
  let store: ProjectStore;

  beforeEach(() => {
    store = new ProjectStore();
  });

  describe("setProject", () => {
    it("stores the project", () => {
      store.setProject({ id: "p1", title: "X", status: "drafting", createdAt: "", updatedAt: "" });
      expect(store.project?.id).toBe("p1");
    });

    it("accepts null to clear", () => {
      store.setProject({ id: "p1", title: "X", status: "drafting", createdAt: "", updatedAt: "" });
      store.setProject(null);
      expect(store.project).toBeNull();
    });
  });

  describe("setBible / setChapterArc / setVoiceGuide", () => {
    it("round-trips bible", () => {
      const bible = createEmptyBible("p1");
      store.setBible(bible);
      expect(store.bible).toEqual(bible);
    });
  });

  describe("scenes and active scene", () => {
    it("exposes the active scene plan via the getter", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.activeScenePlan?.id).toBe("s1");
    });

    it("returns null for activeScene when no scenes exist", () => {
      expect(store.activeScene).toBeNull();
      expect(store.activeScenePlan).toBeNull();
    });

    it("addMultipleScenePlans appends entries", () => {
      store.addMultipleScenePlans([makeScenePlan(), makeScenePlan()]);
      expect(store.scenes).toHaveLength(2);
    });

    it("updateSceneStatus mutates the matching scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.updateSceneStatus("s1", "complete");
      expect(store.scenes[0]!.status).toBe("complete");
    });
  });

  describe("scene chunks", () => {
    it("setSceneChunks replaces the per-scene chunk list", () => {
      const c1 = makeChunk({ sceneId: "s1", sequenceNumber: 0 });
      store.setSceneChunks("s1", [c1]);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });

    it("addChunk appends to the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.addChunk(makeChunk({ sceneId: "s1", sequenceNumber: 0 }));
      expect(store.activeSceneChunks).toHaveLength(1);
    });

    it("updateChunkForScene mutates the chunk at the given index", () => {
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.updateChunkForScene("s1", 0, { status: "accepted" });
      expect(store.sceneChunks.s1![0]!.status).toBe("accepted");
    });

    it("removeChunkForScene drops the chunk at the given index", () => {
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0 }),
        makeChunk({ sceneId: "s1", sequenceNumber: 1 }),
      ]);
      store.removeChunkForScene("s1", 0);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });
  });

  describe("previousSceneLastChunk", () => {
    it("returns null when active scene is the first", () => {
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.previousSceneLastChunk).toBeNull();
    });

    it("returns the last chunk of the prior scene when index > 0", () => {
      const prev = makeChunk({ sceneId: "s0", sequenceNumber: 1, generatedText: "prev text" });
      store.setScenes([
        { plan: makeScenePlan({ id: "s0" }), status: "complete", sceneOrder: 0 },
        { plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 1 },
      ]);
      store.setSceneChunks("s0", [makeChunk({ sceneId: "s0", sequenceNumber: 0 }), prev]);
      store.setActiveScene(1);
      expect(store.previousSceneLastChunk?.generatedText).toBe("prev text");
    });
  });

  describe("scene IRs", () => {
    it("setSceneIR stores the IR", () => {
      const ir = makeNarrativeIR();
      store.setSceneIR("s1", ir);
      expect(store.sceneIRs.s1).toEqual(ir);
    });

    it("verifySceneIR marks the stored IR as verified", () => {
      store.setSceneIR("s1", makeNarrativeIR({ verified: false }));
      store.verifySceneIR("s1");
      expect(store.sceneIRs.s1!.verified).toBe(true);
    });

    it("previousSceneIRs returns IRs from scenes before the active one", () => {
      store.setScenes([
        { plan: makeScenePlan({ id: "s0" }), status: "complete", sceneOrder: 0 },
        { plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 1 },
      ]);
      store.setSceneIR("s0", makeNarrativeIR());
      store.setActiveScene(1);
      expect(store.previousSceneIRs).toHaveLength(1);
    });
  });

  describe("audit flags", () => {
    it("setAudit replaces flags and metrics", () => {
      store.setAudit([], null);
      expect(store.auditFlags).toEqual([]);
      expect(store.metrics).toBeNull();
    });

    // Review E-C1: use makeAuditFlag factory -- it already uses the canonical
    // hyphen form `category: "kill-list"` (NOT `"kill_list"`).
    it("resolveAuditFlag sets resolved and wasActionable on the matching flag", () => {
      store.setAudit([makeAuditFlag({ id: "f1", sceneId: "s1" })], null);
      store.resolveAuditFlag("f1", "fixed", true);
      expect(store.auditFlags[0]!.resolved).toBe(true);
      expect(store.auditFlags[0]!.resolvedAction).toBe("fixed");
      expect(store.auditFlags[0]!.wasActionable).toBe(true);
    });

    it("dismissAuditFlag marks the flag resolved and non-actionable", () => {
      store.setAudit([makeAuditFlag({ id: "f1", sceneId: "s1" })], null);
      store.dismissAuditFlag("f1");
      expect(store.auditFlags[0]!.resolved).toBe(true);
      expect(store.auditFlags[0]!.wasActionable).toBe(false);
    });
  });

  describe("error and selection", () => {
    it("setError stores the error message", () => {
      store.setError("boom");
      expect(store.error).toBe("boom");
      store.setError(null);
      expect(store.error).toBeNull();
    });

    it("selectChunk stores the selected index", () => {
      store.selectChunk(3);
      expect(store.selectedChunkIndex).toBe(3);
      store.selectChunk(null);
      expect(store.selectedChunkIndex).toBeNull();
    });
  });

  // --- Added per review E-C3: missing public-API coverage ---

  describe("loadFromServer", () => {
    it("populates project, bible, scenes, chunks, IRs, versions, voice guides", () => {
      const plan = makeScenePlan({ id: "s1" });
      const chunk = makeChunk({ sceneId: "s1", sequenceNumber: 0 });
      const ir = makeNarrativeIR();
      store.loadFromServer({
        project: { id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" },
        bible: createEmptyBible("p1"),
        chapterArc: null,
        scenes: [{ plan, status: "drafting", sceneOrder: 0 }],
        sceneChunks: { s1: [chunk] },
        sceneIRs: { s1: ir },
        bibleVersions: [{ version: 1, createdAt: "2024-01-01T00:00:00Z" }],
        voiceGuide: null,
        projectVoiceGuide: null,
      });
      expect(store.project?.id).toBe("p1");
      expect(store.scenes).toHaveLength(1);
      expect(store.sceneChunks.s1).toHaveLength(1);
      expect(store.sceneIRs.s1).toEqual(ir);
      expect(store.bibleVersions).toHaveLength(1);
      expect(store.error).toBeNull();
    });

    it("defaults projectVoiceGuide to null when omitted", () => {
      store.loadFromServer({
        project: { id: "p", title: "", status: "drafting", createdAt: "", updatedAt: "" },
        bible: null,
        chapterArc: null,
        scenes: [],
        sceneChunks: {},
        sceneIRs: {},
        bibleVersions: [],
        voiceGuide: null,
      });
      expect(store.projectVoiceGuide).toBeNull();
    });
  });

  describe("resetForProjectSwitch", () => {
    it("clears all project-scoped state back to defaults", () => {
      store.setProject({ id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" });
      store.setBible(createEmptyBible("p1"));
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.setError("boom");
      store.resetForProjectSwitch();
      expect(store.project).toBeNull();
      expect(store.bible).toBeNull();
      expect(store.scenes).toEqual([]);
      expect(store.sceneChunks).toEqual({});
      expect(store.sceneIRs).toEqual({});
      expect(store.auditFlags).toEqual([]);
      expect(store.error).toBeNull();
      expect(store.isGenerating).toBe(false);
      expect(store.isAutopilot).toBe(false);
    });
  });

  describe("addScenePlan and setScenePlan", () => {
    it("addScenePlan appends a new plan and makes it active", () => {
      store.addScenePlan(makeScenePlan({ id: "s1" }));
      store.addScenePlan(makeScenePlan({ id: "s2" }));
      expect(store.scenes).toHaveLength(2);
      expect(store.activeSceneIndex).toBe(1);
    });

    it("addScenePlan replaces a scene with the same id in place", () => {
      const first = makeScenePlan({ id: "s1", title: "first" });
      const replacement = makeScenePlan({ id: "s1", title: "replaced" });
      store.addScenePlan(first);
      store.addScenePlan(replacement);
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.title).toBe("replaced");
    });

    it("setScenePlan(null) clears scenes", () => {
      store.setScenePlan(makeScenePlan({ id: "s1" }));
      store.setScenePlan(null);
      expect(store.scenes).toEqual([]);
      expect(store.activeSceneIndex).toBe(0);
    });

    it("setScenePlan(plan) replaces scenes with a single entry", () => {
      store.setScenePlan(makeScenePlan({ id: "s1" }));
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.id).toBe("s1");
    });
  });

  describe("completeScene", () => {
    it("marks the matching scene as complete", () => {
      store.setScenes([
        { plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 },
        { plan: makeScenePlan({ id: "s2" }), status: "drafting", sceneOrder: 1 },
      ]);
      store.completeScene("s1");
      expect(store.scenes[0]!.status).toBe("complete");
      expect(store.scenes[1]!.status).toBe("drafting");
    });
  });

  describe("setBibleVersions / setEditorialAnnotations / setExtractingIR", () => {
    it("setBibleVersions stores version list", () => {
      store.setBibleVersions([{ version: 1, createdAt: "2024-01-01" }]);
      expect(store.bibleVersions).toHaveLength(1);
    });

    it("setEditorialAnnotations and getEditorialAnnotations round-trip", () => {
      store.setEditorialAnnotations("s1", 0, [{ id: "a1", chunkIndex: 0, comment: "nice" } as any]);
      const anns = store.getEditorialAnnotations("s1");
      expect(anns.get(0)).toHaveLength(1);
    });

    it("clearEditorialAnnotations removes the scene's annotations", () => {
      store.setEditorialAnnotations("s1", 0, [{ id: "a1" } as any]);
      store.clearEditorialAnnotations("s1");
      expect(store.getEditorialAnnotations("s1").size).toBe(0);
    });

    it("setExtractingIR updates extractingIRSceneId and isExtractingIR derives correctly", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.isExtractingIR).toBe(false);
      store.setExtractingIR("s1");
      expect(store.extractingIRSceneId).toBe("s1");
      expect(store.isExtractingIR).toBe(true);
      store.setExtractingIR(null);
      expect(store.isExtractingIR).toBe(false);
    });
  });

  describe("activeSceneIR", () => {
    it("returns null when no IR is stored for the active scene", () => {
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.activeSceneIR).toBeNull();
    });

    it("returns the stored IR for the active scene", () => {
      const ir = makeNarrativeIR();
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneIR("s1", ir);
      expect(store.activeSceneIR).toEqual(ir);
    });
  });

  describe("cancelGeneration / cancelAutopilot / setGenerating / setAutopilot", () => {
    it("setGenerating(true) creates an AbortController; (false) clears it", () => {
      store.setGenerating(true);
      expect(store.isGenerating).toBe(true);
      expect(store.generationAbortController).not.toBeNull();
      store.setGenerating(false);
      expect(store.generationAbortController).toBeNull();
    });

    it("cancelGeneration aborts the in-flight controller without flipping isGenerating", () => {
      store.setGenerating(true);
      const ctrl = store.generationAbortController!;
      store.cancelGeneration();
      expect(ctrl.signal.aborted).toBe(true);
      // isGenerating stays true -- the finally block in generateChunk clears it.
      expect(store.isGenerating).toBe(true);
    });

    it("setAutopilot(true) resets autopilotCancelled", () => {
      store.autopilotCancelled = true;
      store.setAutopilot(true);
      expect(store.isAutopilot).toBe(true);
      expect(store.autopilotCancelled).toBe(false);
    });

    it("cancelAutopilot sets autopilotCancelled, clears isAutopilot, aborts stream", () => {
      store.setAutopilot(true);
      store.setGenerating(true);
      const ctrl = store.generationAbortController!;
      store.cancelAutopilot();
      expect(store.autopilotCancelled).toBe(true);
      expect(store.isAutopilot).toBe(false);
      expect(ctrl.signal.aborted).toBe(true);
    });
  });

  describe("selectModel", () => {
    it("no-ops when model id is not in availableModels", () => {
      const before = store.compilationConfig.defaultModel;
      store.selectModel("nonexistent");
      expect(store.compilationConfig.defaultModel).toBe(before);
    });

    it("updates defaultModel, modelContextWindow, and reservedForOutput when spec is found", () => {
      store.setModels([{ id: "m1", label: "Model 1", contextWindow: 200_000, maxOutput: 4096 }]);
      store.selectModel("m1");
      expect(store.compilationConfig.defaultModel).toBe("m1");
      expect(store.compilationConfig.modelContextWindow).toBe(200_000);
      expect(store.compilationConfig.reservedForOutput).toBeLessThanOrEqual(4096);
    });
  });

  describe("setCompiled", () => {
    it("stores compiled payload, log, and lint together", () => {
      store.setCompiled({ systemMessage: "s", userMessage: "u" } as any, { steps: [] } as any, { issues: [] } as any);
      expect(store.compiledPayload).not.toBeNull();
      expect(store.compilationLog).not.toBeNull();
      expect(store.lintResult).not.toBeNull();
    });
  });

  describe("setConfig and setModels", () => {
    it("setConfig replaces the compilation config", () => {
      const cfg = createDefaultCompilationConfig();
      store.setConfig(cfg);
      expect(store.compilationConfig).toEqual(cfg);
    });

    it("setModels replaces the models list", () => {
      store.setModels([{ id: "m1", label: "Model 1", contextWindow: 100, maxOutput: 50 }]);
      expect(store.availableModels).toHaveLength(1);
    });
  });

  describe("voice guide setters", () => {
    it("setVoiceGuide / setProjectVoiceGuide store and clear", () => {
      const g = { version: 1, createdAt: "", ring1Injection: "x" } as any;
      store.setVoiceGuide(g);
      expect(store.voiceGuide).toEqual(g);
      store.setVoiceGuide(null);
      expect(store.voiceGuide).toBeNull();
      store.setProjectVoiceGuide(g);
      expect(store.projectVoiceGuide).toEqual(g);
    });
  });

  describe("setChapterArc", () => {
    it("stores and clears the chapter arc", () => {
      const arc = { id: "a1", title: "Ch1" } as any;
      store.setChapterArc(arc);
      expect(store.chapterArc).toEqual(arc);
      store.setChapterArc(null);
      expect(store.chapterArc).toBeNull();
    });
  });

  describe("updateChunk / removeChunk (active-scene wrappers)", () => {
    it("updateChunk delegates to updateChunkForScene for the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.updateChunk(0, { status: "accepted" });
      expect(store.sceneChunks.s1![0]!.status).toBe("accepted");
    });

    it("updateChunk is a no-op when no scene is active", () => {
      store.updateChunk(0, { status: "accepted" });
      expect(store.sceneChunks).toEqual({});
    });

    it("removeChunk delegates to removeChunkForScene for the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0 }),
        makeChunk({ sceneId: "s1", sequenceNumber: 1 }),
      ]);
      store.removeChunk(0);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });
  });

  describe("UI state setters", () => {
    it("setBootstrapOpen / setBibleAuthoringOpen / setSceneAuthoringOpen / setIRInspectorOpen", () => {
      store.setBootstrapOpen(true);
      store.setBibleAuthoringOpen(true);
      store.setSceneAuthoringOpen(true);
      store.setIRInspectorOpen(true);
      expect(store.bootstrapModalOpen).toBe(true);
      expect(store.bibleAuthoringOpen).toBe(true);
      expect(store.sceneAuthoringOpen).toBe(true);
      expect(store.irInspectorOpen).toBe(true);
    });

    it("setAuditing / setReviewingChunks", () => {
      store.setAuditing(true);
      expect(store.isAuditing).toBe(true);
      store.setReviewingChunks(new Set([1, 2]));
      expect(store.reviewingChunks.size).toBe(2);
    });
  });

  // loadFile / saveFile require a real DOM and are skipped here.
  // TODO(#36 follow-up): exercise them in a jsdom-specific spec.
});
