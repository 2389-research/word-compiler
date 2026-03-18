import { compilePayload } from "../../compiler/assembler.js";
import type { VoiceGuide } from "../../profile/types.js";
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

      // Combine author-level and project-level voice guides
      let effectiveGuide: VoiceGuide | undefined = store.voiceGuide ?? undefined;
      if (effectiveGuide && store.projectVoiceGuide?.ring1Injection) {
        effectiveGuide = {
          ...effectiveGuide,
          ring1Injection:
            effectiveGuide.ring1Injection +
            "\n\n=== PROJECT-SPECIFIC VOICE ===\n" +
            store.projectVoiceGuide.ring1Injection,
        };
      }
      if (!effectiveGuide && store.projectVoiceGuide?.ring1Injection) {
        effectiveGuide = {
          ...store.projectVoiceGuide,
        };
      }

      const result = compilePayload(
        bible,
        plan,
        store.activeSceneChunks,
        nextChunkNumber,
        store.compilationConfig,
        store.chapterArc ?? undefined,
        store.previousSceneLastChunk ?? undefined,
        store.previousSceneIRs,
        effectiveGuide,
      );
      store.setCompiled(result.payload, result.log, result.lintResult);
    } catch (err) {
      store.setCompiled(null, null, null);
      store.setError(err instanceof Error ? err.message : "Compilation error");
    }
  });
}
