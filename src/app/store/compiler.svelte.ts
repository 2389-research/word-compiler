import { compilePayload } from "../../compiler/assembler.js";
import type { ProjectStore } from "./project.svelte.js";

/**
 * Sets up an $effect that auto-recompiles the payload whenever
 * bible, scene plan, chunks, config, or chapter arc change.
 * Freezes during generation so the Compiler View shows the
 * payload currently being used for generation.
 */
export function setupCompilerEffect(store: ProjectStore): void {
  $effect(() => {
    // Freeze compilation during generation
    if (store.isGenerating) return;

    const bible = store.bible;
    const plan = store.activeScenePlan;
    if (!bible || !plan) {
      store.setCompiled(null, null, null);
      return;
    }

    try {
      const nextChunkNumber = store.activeSceneChunks.length;
      const result = compilePayload(
        bible,
        plan,
        store.activeSceneChunks,
        nextChunkNumber,
        store.compilationConfig,
        store.chapterArc ?? undefined,
        store.previousSceneLastChunk ?? undefined,
      );
      store.setCompiled(result.payload, result.log, result.lintResult);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Compilation error");
    }
  });
}
