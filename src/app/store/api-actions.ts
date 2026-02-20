import * as api from "../../api/client.js";
import type { AuditFlag, Bible, ChapterArc, Chunk, CompilationLog, NarrativeIR, ScenePlan } from "../../types/index.js";
import type { ProjectStore } from "./project.svelte.js";

export function createApiActions(store: ProjectStore) {
  function handleError(err: unknown) {
    store.setError(err instanceof Error ? err.message : String(err));
  }

  async function saveBible(bible: Bible): Promise<void> {
    try {
      const saved = await api.apiSaveBible(bible);
      store.setBible(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveScenePlan(plan: ScenePlan, sceneOrder: number): Promise<void> {
    try {
      const saved = await api.apiSaveScenePlan(plan, sceneOrder);
      store.addScenePlan(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveMultipleScenePlans(plans: ScenePlan[]): Promise<void> {
    try {
      const saved = await Promise.all(plans.map((plan, i) => api.apiSaveScenePlan(plan, store.scenes.length + i)));
      store.addMultipleScenePlans(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveChapterArc(arc: ChapterArc): Promise<void> {
    try {
      const saved = await api.apiSaveChapterArc(arc);
      store.setChapterArc(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function updateChapterArc(arc: ChapterArc): Promise<void> {
    try {
      const saved = await api.apiUpdateChapterArc(arc);
      store.setChapterArc(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveChunk(chunk: Chunk): Promise<void> {
    try {
      await api.apiSaveChunk(chunk);
    } catch (err) {
      handleError(err);
    }
  }

  async function updateChunk(chunk: Chunk): Promise<void> {
    try {
      await api.apiUpdateChunk(chunk);
    } catch (err) {
      handleError(err);
    }
  }

  async function completeScene(sceneId: string): Promise<void> {
    try {
      await api.apiUpdateSceneStatus(sceneId, "complete");
      store.completeScene(sceneId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveSceneIR(sceneId: string, ir: NarrativeIR): Promise<void> {
    try {
      const saved = await api.apiCreateSceneIR(sceneId, ir);
      store.setSceneIR(sceneId, saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function verifySceneIR(sceneId: string): Promise<void> {
    try {
      await api.apiVerifySceneIR(sceneId);
      store.verifySceneIR(sceneId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveAuditFlags(flags: AuditFlag[]): Promise<void> {
    try {
      await api.apiSaveAuditFlags(flags);
    } catch (err) {
      handleError(err);
    }
  }

  async function resolveAuditFlag(flagId: string, action: string, wasActionable: boolean): Promise<void> {
    try {
      await api.apiResolveAuditFlag(flagId, action, wasActionable);
      store.resolveAuditFlag(flagId, action, wasActionable);
    } catch (err) {
      handleError(err);
    }
  }

  async function dismissAuditFlag(flagId: string): Promise<void> {
    try {
      await api.apiResolveAuditFlag(flagId, "", false);
      store.dismissAuditFlag(flagId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveCompilationLog(log: CompilationLog): Promise<void> {
    try {
      await api.apiSaveCompilationLog(log);
    } catch (err) {
      handleError(err);
    }
  }

  return {
    saveBible,
    saveScenePlan,
    saveMultipleScenePlans,
    saveChapterArc,
    updateChapterArc,
    saveChunk,
    updateChunk,
    completeScene,
    saveSceneIR,
    verifySceneIR,
    saveAuditFlags,
    resolveAuditFlag,
    dismissAuditFlag,
    saveCompilationLog,
  };
}

export type ApiActions = ReturnType<typeof createApiActions>;
