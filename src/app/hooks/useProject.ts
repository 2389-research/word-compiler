import { useReducer, useCallback, useEffect } from "react";
import type {
  Bible,
  ScenePlan,
  Chunk,
  CompilationConfig,
  CompiledPayload,
  CompilationLog,
  LintResult,
  AuditFlag,
  ProseMetrics,
  ModelSpec,
} from "../../types/index.js";
import { createDefaultCompilationConfig } from "../../types/index.js";
import { fetchModels } from "../../llm/client.js";

export interface AppState {
  bible: Bible | null;
  scenePlan: ScenePlan | null;
  chunks: Chunk[];
  compilationConfig: CompilationConfig;
  availableModels: ModelSpec[];
  // Derived
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
  | { type: "SET_BIBLE"; bible: Bible | null }
  | { type: "SET_SCENE_PLAN"; plan: ScenePlan | null }
  | { type: "SET_CONFIG"; config: CompilationConfig }
  | { type: "SET_MODELS"; models: ModelSpec[] }
  | { type: "ADD_CHUNK"; chunk: Chunk }
  | { type: "UPDATE_CHUNK"; index: number; chunk: Partial<Chunk> }
  | { type: "SET_COMPILED"; payload: CompiledPayload | null; log: CompilationLog | null; lint: LintResult | null }
  | { type: "SET_AUDIT"; flags: AuditFlag[]; metrics: ProseMetrics | null }
  | { type: "SET_GENERATING"; value: boolean }
  | { type: "SET_BOOTSTRAP_OPEN"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SELECT_CHUNK"; index: number | null };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_BIBLE":
      return { ...state, bible: action.bible, error: null };
    case "SET_SCENE_PLAN":
      return { ...state, scenePlan: action.plan, error: null };
    case "SET_CONFIG":
      return { ...state, compilationConfig: action.config };
    case "SET_MODELS":
      return { ...state, availableModels: action.models };
    case "ADD_CHUNK":
      return { ...state, chunks: [...state.chunks, action.chunk] };
    case "UPDATE_CHUNK": {
      const chunks = [...state.chunks];
      const existing = chunks[action.index];
      if (existing) {
        chunks[action.index] = { ...existing, ...action.chunk };
      }
      return { ...state, chunks };
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
    case "SET_GENERATING":
      return { ...state, isGenerating: action.value };
    case "SET_BOOTSTRAP_OPEN":
      return { ...state, bootstrapModalOpen: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SELECT_CHUNK":
      return { ...state, selectedChunkIndex: action.index };
    default:
      return state;
  }
}

const initialState: AppState = {
  bible: null,
  scenePlan: null,
  chunks: [],
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

  return { state, dispatch, loadFile, saveFile, selectModel };
}
