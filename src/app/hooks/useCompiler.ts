import { useEffect } from "react";
import type { AppState, AppAction } from "./useProject.js";
import { compilePayload } from "../../compiler/assembler.js";

export function useCompiler(state: AppState, dispatch: React.Dispatch<AppAction>) {
  useEffect(() => {
    if (!state.bible || !state.scenePlan) {
      dispatch({ type: "SET_COMPILED", payload: null, log: null, lint: null });
      return;
    }

    try {
      const nextChunkNumber = state.chunks.length;
      const result = compilePayload(
        state.bible,
        state.scenePlan,
        state.chunks,
        nextChunkNumber,
        state.compilationConfig,
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
  }, [state.bible, state.scenePlan, state.chunks, state.compilationConfig, dispatch]);
}
