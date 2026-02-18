import { useReducer, useCallback, useEffect, useMemo } from "react";
import type {
  Project,
  Bible,
  ChapterArc,
  ScenePlan,
  Chunk,
  CompilationConfig,
  CompiledPayload,
  CompilationLog,
  LintResult,
  AuditFlag,
  ProseMetrics,
  ModelSpec,
  SceneStatus,
} from "../../types/index.js";
import { createDefaultCompilationConfig } from "../../types/index.js";
import { fetchModels } from "../../llm/client.js";

export interface SceneEntry {
  plan: ScenePlan;
  status: SceneStatus;
  sceneOrder: number;
}

export interface AppState {
  // Project-level
  project: Project | null;
  chapterArc: ChapterArc | null;
  scenes: SceneEntry[];
  activeSceneIndex: number;
  sceneChunks: Record<string, Chunk[]>;
  bible: Bible | null;
  bibleVersions: Array<{ version: number; createdAt: string }>;
  // Config
  compilationConfig: CompilationConfig;
  availableModels: ModelSpec[];
  // Derived from active scene
  compiledPayload: CompiledPayload | null;
  compilationLog: CompilationLog | null;
  lintResult: LintResult | null;
  auditFlags: AuditFlag[];
  metrics: ProseMetrics | null;
  // UI
  isGenerating: boolean;
  selectedChunkIndex: number | null;
  bootstrapModalOpen: boolean;
  error: string | null;
}

export type AppAction =
  | { type: "SET_PROJECT"; project: Project | null }
  | { type: "SET_BIBLE"; bible: Bible | null }
  | { type: "SET_BIBLE_VERSIONS"; versions: Array<{ version: number; createdAt: string }> }
  | { type: "SET_CHAPTER_ARC"; arc: ChapterArc | null }
  | { type: "SET_SCENES"; scenes: SceneEntry[] }
  | { type: "SET_ACTIVE_SCENE"; index: number }
  | { type: "UPDATE_SCENE_STATUS"; sceneId: string; status: SceneStatus }
  | { type: "SET_SCENE_CHUNKS"; sceneId: string; chunks: Chunk[] }
  | { type: "SET_CONFIG"; config: CompilationConfig }
  | { type: "SET_MODELS"; models: ModelSpec[] }
  | { type: "ADD_CHUNK"; chunk: Chunk }
  | { type: "UPDATE_CHUNK"; index: number; chunk: Partial<Chunk> }
  | { type: "REMOVE_CHUNK"; index: number }
  | { type: "SET_COMPILED"; payload: CompiledPayload | null; log: CompilationLog | null; lint: LintResult | null }
  | { type: "SET_AUDIT"; flags: AuditFlag[]; metrics: ProseMetrics | null }
  | { type: "RESOLVE_AUDIT_FLAG"; flagId: string; action: string; wasActionable: boolean }
  | { type: "DISMISS_AUDIT_FLAG"; flagId: string; action: string }
  | { type: "SET_GENERATING"; value: boolean }
  | { type: "SET_BOOTSTRAP_OPEN"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SELECT_CHUNK"; index: number | null }
  | { type: "LOAD_FROM_SERVER"; project: Project; bible: Bible | null; chapterArc: ChapterArc | null; scenes: SceneEntry[]; sceneChunks: Record<string, Chunk[]>; bibleVersions: Array<{ version: number; createdAt: string }> }
  | { type: "COMPLETE_SCENE"; sceneId: string }
  // Backward compat: Phase 0 single-scene mode
  | { type: "SET_SCENE_PLAN"; plan: ScenePlan | null };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_PROJECT":
      return { ...state, project: action.project, error: null };
    case "SET_BIBLE":
      return { ...state, bible: action.bible, error: null };
    case "SET_BIBLE_VERSIONS":
      return { ...state, bibleVersions: action.versions };
    case "SET_CHAPTER_ARC":
      return { ...state, chapterArc: action.arc };
    case "SET_SCENES":
      return { ...state, scenes: action.scenes };
    case "SET_ACTIVE_SCENE":
      return { ...state, activeSceneIndex: action.index, selectedChunkIndex: null };
    case "UPDATE_SCENE_STATUS":
      return {
        ...state,
        scenes: state.scenes.map((s) =>
          s.plan.id === action.sceneId ? { ...s, status: action.status } : s,
        ),
      };
    case "SET_SCENE_CHUNKS":
      return {
        ...state,
        sceneChunks: { ...state.sceneChunks, [action.sceneId]: action.chunks },
      };
    case "SET_CONFIG":
      return { ...state, compilationConfig: action.config };
    case "SET_MODELS":
      return { ...state, availableModels: action.models };
    case "ADD_CHUNK": {
      const sceneId = action.chunk.sceneId;
      const existing = state.sceneChunks[sceneId] ?? [];
      // Auto-transition to drafting on first chunk
      const updatedScenes = state.scenes.map((s) =>
        s.plan.id === sceneId && s.status === "planned" ? { ...s, status: "drafting" as SceneStatus } : s,
      );
      return {
        ...state,
        scenes: updatedScenes,
        sceneChunks: { ...state.sceneChunks, [sceneId]: [...existing, action.chunk] },
      };
    }
    case "UPDATE_CHUNK": {
      const activeScene = state.scenes[state.activeSceneIndex];
      if (!activeScene) return state;
      const sceneId = activeScene.plan.id;
      const chunks = [...(state.sceneChunks[sceneId] ?? [])];
      const existing = chunks[action.index];
      if (existing) {
        chunks[action.index] = { ...existing, ...action.chunk };
      }
      return { ...state, sceneChunks: { ...state.sceneChunks, [sceneId]: chunks } };
    }
    case "REMOVE_CHUNK": {
      const activeScene = state.scenes[state.activeSceneIndex];
      if (!activeScene) return state;
      const sceneId = activeScene.plan.id;
      const chunks = (state.sceneChunks[sceneId] ?? []).filter((_, i) => i !== action.index);
      return { ...state, sceneChunks: { ...state.sceneChunks, [sceneId]: chunks } };
    }
    case "SET_COMPILED":
      return {
        ...state,
        compiledPayload: action.payload,
        compilationLog: action.log,
        lintResult: action.lint,
      };
    case "SET_AUDIT":
      return { ...state, auditFlags: action.flags, metrics: action.metrics };
    case "RESOLVE_AUDIT_FLAG":
      return {
        ...state,
        auditFlags: state.auditFlags.map((f) =>
          f.id === action.flagId
            ? { ...f, resolved: true, resolvedAction: action.action, wasActionable: action.wasActionable }
            : f,
        ),
      };
    case "DISMISS_AUDIT_FLAG":
      return {
        ...state,
        auditFlags: state.auditFlags.map((f) =>
          f.id === action.flagId
            ? { ...f, resolved: true, resolvedAction: action.action, wasActionable: false }
            : f,
        ),
      };
    case "SET_GENERATING":
      return { ...state, isGenerating: action.value };
    case "SET_BOOTSTRAP_OPEN":
      return { ...state, bootstrapModalOpen: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SELECT_CHUNK":
      return { ...state, selectedChunkIndex: action.index };
    case "COMPLETE_SCENE":
      return {
        ...state,
        scenes: state.scenes.map((s) =>
          s.plan.id === action.sceneId ? { ...s, status: "complete" as SceneStatus } : s,
        ),
      };
    case "SET_SCENE_PLAN": {
      // Backward compat: wrap in SceneEntry
      if (!action.plan) return { ...state, scenes: [], activeSceneIndex: 0 };
      const entry: SceneEntry = { plan: action.plan, status: "planned", sceneOrder: 0 };
      return { ...state, scenes: [entry], activeSceneIndex: 0 };
    }
    case "LOAD_FROM_SERVER":
      return {
        ...state,
        project: action.project,
        bible: action.bible,
        chapterArc: action.chapterArc,
        scenes: action.scenes,
        sceneChunks: action.sceneChunks,
        bibleVersions: action.bibleVersions,
        error: null,
      };
    default:
      return state;
  }
}

const initialState: AppState = {
  project: null,
  chapterArc: null,
  scenes: [],
  activeSceneIndex: 0,
  sceneChunks: {},
  bible: null,
  bibleVersions: [],
  compilationConfig: createDefaultCompilationConfig(),
  availableModels: [],
  compiledPayload: null,
  compilationLog: null,
  lintResult: null,
  auditFlags: [],
  metrics: null,
  isGenerating: false,
  selectedChunkIndex: null,
  bootstrapModalOpen: false,
  error: null,
};

export function useProject() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Fetch available models from API on mount
  useEffect(() => {
    fetchModels()
      .then((models) => {
        dispatch({ type: "SET_MODELS", models });
      })
      .catch(() => {
        // Proxy not running — models list stays empty, hardcoded defaults work
      });
  }, []);

  // Computed: active scene data (memoized to prevent infinite re-render loops in useCompiler)
  const activeScene = state.scenes[state.activeSceneIndex] ?? null;
  const activeScenePlan = activeScene?.plan ?? null;
  const activeSceneId = activeScenePlan?.id ?? null;
  const activeSceneChunks = useMemo(
    () => (activeSceneId ? (state.sceneChunks[activeSceneId] ?? []) : []),
    [activeSceneId, state.sceneChunks],
  );

  // Computed: previous scene's last chunk (for cross-scene bridge)
  const previousSceneLastChunk = useMemo(() => {
    if (state.activeSceneIndex <= 0) return null;
    const prevScene = state.scenes[state.activeSceneIndex - 1];
    if (!prevScene) return null;
    const prevChunks = state.sceneChunks[prevScene.plan.id] ?? [];
    return prevChunks.length > 0 ? prevChunks[prevChunks.length - 1]! : null;
  }, [state.activeSceneIndex, state.scenes, state.sceneChunks]);

  const selectModel = useCallback(
    (modelId: string) => {
      const spec = state.availableModels.find((m) => m.id === modelId);
      if (spec) {
        dispatch({
          type: "SET_CONFIG",
          config: {
            ...state.compilationConfig,
            defaultModel: spec.id,
            modelContextWindow: spec.contextWindow,
            reservedForOutput: Math.min(state.compilationConfig.reservedForOutput, spec.maxOutput),
          },
        });
      }
    },
    [state.availableModels, state.compilationConfig, dispatch],
  );

  const loadFile = useCallback(async (): Promise<string | null> => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    return new Promise((resolve) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const text = await file.text();
        resolve(text);
      };
      input.click();
    });
  }, []);

  const saveFile = useCallback((data: unknown, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    state,
    dispatch,
    loadFile,
    saveFile,
    selectModel,
    // Computed
    activeScene,
    activeScenePlan,
    activeSceneChunks,
    previousSceneLastChunk,
  };
}
