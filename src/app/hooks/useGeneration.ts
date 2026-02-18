import { useCallback } from "react";
import type { ScenePlan, Chunk } from "../../types/index.js";
import type { AppState, AppAction } from "./useProject.js";
import { generateId } from "../../types/index.js";
import { generateStream } from "../../llm/client.js";
import { runAudit } from "../../auditor/index.js";

export function useGeneration(
  state: AppState,
  dispatch: React.Dispatch<AppAction>,
  activeScenePlan: ScenePlan | null,
  activeSceneChunks: Chunk[],
) {
  const generateChunk = useCallback(async () => {
    if (!state.compiledPayload || !state.bible || !activeScenePlan) return;

    dispatch({ type: "SET_GENERATING", value: true });
    dispatch({ type: "SET_ERROR", error: null });

    try {
      const chunkId = generateId();
      const chunkIndex = activeSceneChunks.length;
      const pendingChunk: Chunk = {
        id: chunkId,
        sceneId: activeScenePlan.id,
        sequenceNumber: chunkIndex,
        generatedText: "",
        payloadHash: generateId(),
        model: state.compiledPayload.model,
        temperature: state.compiledPayload.temperature,
        topP: state.compiledPayload.topP,
        generatedAt: new Date().toISOString(),
        status: "pending",
        editedText: null,
        humanNotes: null,
      };
      dispatch({ type: "ADD_CHUNK", chunk: pendingChunk });

      let fullText = "";
      await generateStream(state.compiledPayload, {
        onToken: (text) => {
          fullText += text;
          dispatch({ type: "UPDATE_CHUNK", index: chunkIndex, chunk: { generatedText: fullText } });
        },
        onDone: () => {
          dispatch({ type: "UPDATE_CHUNK", index: chunkIndex, chunk: { generatedText: fullText } });
        },
        onError: (err) => {
          dispatch({ type: "SET_ERROR", error: `Generation failed: ${err}` });
        },
      });

      // Run audit on all chunks for this scene
      const allText = [...activeSceneChunks, { ...pendingChunk, generatedText: fullText }]
        .map((c) => c.editedText ?? c.generatedText)
        .join("\n\n");
      const { flags, metrics } = runAudit(allText, state.bible, activeScenePlan.id);
      dispatch({ type: "SET_AUDIT", flags, metrics });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [state.compiledPayload, state.bible, activeScenePlan, activeSceneChunks, dispatch]);

  const runAuditManual = useCallback(() => {
    if (!state.bible || !activeScenePlan || activeSceneChunks.length === 0) return;

    const allText = activeSceneChunks
      .map((c) => c.editedText ?? c.generatedText)
      .join("\n\n");
    const { flags, metrics } = runAudit(allText, state.bible, activeScenePlan.id);
    dispatch({ type: "SET_AUDIT", flags, metrics });
  }, [state.bible, activeScenePlan, activeSceneChunks, dispatch]);

  return { generateChunk, runAuditManual };
}
