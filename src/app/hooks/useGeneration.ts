import { useCallback } from "react";
import type { AppState, AppAction } from "./useProject.js";
import type { Chunk } from "../../types/index.js";
import { generateId } from "../../types/index.js";
import { generateStream } from "../../llm/client.js";
import { runAudit } from "../../auditor/index.js";

export function useGeneration(state: AppState, dispatch: React.Dispatch<AppAction>) {
  const generateChunk = useCallback(async () => {
    if (!state.compiledPayload || !state.bible || !state.scenePlan) return;

    dispatch({ type: "SET_GENERATING", value: true });
    dispatch({ type: "SET_ERROR", error: null });

    try {
      // Create a pending chunk immediately so the user sees streaming text
      const chunkId = generateId();
      const chunkIndex = state.chunks.length;
      const pendingChunk: Chunk = {
        id: chunkId,
        sceneId: state.scenePlan.id,
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
          // Update the chunk's text as tokens arrive
          dispatch({ type: "UPDATE_CHUNK", index: chunkIndex, chunk: { generatedText: fullText } });
        },
        onDone: () => {
          // Final update with complete text
          dispatch({ type: "UPDATE_CHUNK", index: chunkIndex, chunk: { generatedText: fullText } });
        },
        onError: (err) => {
          dispatch({ type: "SET_ERROR", error: `Generation failed: ${err}` });
        },
      });

      // Run audit on all chunks
      const allText = [...state.chunks, { ...pendingChunk, generatedText: fullText }]
        .map((c) => c.editedText ?? c.generatedText)
        .join("\n\n");
      const { flags, metrics } = runAudit(allText, state.bible, state.scenePlan.id);
      dispatch({ type: "SET_AUDIT", flags, metrics });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [state.compiledPayload, state.bible, state.scenePlan, state.chunks, dispatch]);

  const runAuditManual = useCallback(() => {
    if (!state.bible || !state.scenePlan || state.chunks.length === 0) return;

    const allText = state.chunks
      .map((c) => c.editedText ?? c.generatedText)
      .join("\n\n");
    const { flags, metrics } = runAudit(allText, state.bible, state.scenePlan.id);
    dispatch({ type: "SET_AUDIT", flags, metrics });
  }, [state.bible, state.scenePlan, state.chunks, dispatch]);

  return { generateChunk, runAuditManual };
}
