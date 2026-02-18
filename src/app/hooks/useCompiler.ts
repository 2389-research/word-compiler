import { useEffect } from "react";
import type { ScenePlan, Chunk, ChapterArc } from "../../types/index.js";
import type { AppState, AppAction } from "./useProject.js";
import { compilePayload } from "../../compiler/assembler.js";

export function useCompiler(
  state: AppState,
  dispatch: React.Dispatch<AppAction>,
  activeScenePlan: ScenePlan | null,
  activeSceneChunks: Chunk[],
  previousSceneLastChunk: Chunk | null,
) {
  useEffect(() => {
    // Freeze compilation during generation — the Compiler View should show the
    // payload currently being used, not leap ahead to the next chunk's payload.
    if (state.isGenerating) return;

    if (!state.bible || !activeScenePlan) {
      dispatch({ type: "SET_COMPILED", payload: null, log: null, lint: null });
      return;
    }

    try {
      const nextChunkNumber = activeSceneChunks.length;
      const result = compilePayload(
        state.bible,
        activeScenePlan,
        activeSceneChunks,
        nextChunkNumber,
        state.compilationConfig,
        state.chapterArc ?? undefined,
        previousSceneLastChunk ?? undefined,
      );
      dispatch({
        type: "SET_COMPILED",
        payload: result.payload,
        log: result.log,
        lint: result.lintResult,
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Compilation error",
      });
    }
  }, [state.bible, state.isGenerating, activeScenePlan, activeSceneChunks, state.compilationConfig, state.chapterArc, previousSceneLastChunk, dispatch]);
}
