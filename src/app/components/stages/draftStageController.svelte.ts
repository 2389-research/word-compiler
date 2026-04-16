import { untrack } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { apiFireBatchCipher, apiStoreSignificantEdit } from "../../../api/client.js";
import { callLLM } from "../../../llm/client.js";
import { shouldTriggerCipher } from "../../../profile/editFilter.js";
import type { ChunkView, EditorialAnnotation, LLMReviewClient, ReviewOrchestrator } from "../../../review/index.js";
import { createReviewOrchestrator, REVIEW_OUTPUT_SCHEMA } from "../../../review/index.js";
import type { Chunk } from "../../../types/index.js";
import { DEFAULT_MODEL, getCanonicalText } from "../../../types/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import { loadAnnotations, loadDismissed, saveAnnotations } from "./draftStagePersistence.js";

const REVIEW_MODEL = DEFAULT_MODEL;
const REVIEW_MAX_TOKENS = 2048;

export interface DraftStageController {
  readonly chunkAnnotations: SvelteMap<number, EditorialAnnotation[]>;
  readonly reviewingChunks: SvelteSet<number>;
  handleReviewChunk(index: number): void;
  handleDismissAnnotation(annotationId: string): void;
  handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null>;
  handleUpdateChunk(index: number, changes: Partial<Chunk>): void;
  handleRemoveChunk(index: number): Promise<void>;
  handleDestroyChunk(index: number): Promise<void>;
  dispose(): void;
}

export function createDraftStageController(store: ProjectStore, commands: Commands): DraftStageController {
  let dismissed = $state<Set<string>>(loadDismissed(store.project?.id));
  const chunkAnnotations = new SvelteMap<number, EditorialAnnotation[]>();
  const reviewingChunks = new SvelteSet<number>();
  let orchestrator = $state<ReviewOrchestrator | null>(null);
  let orchestratorVersion = $state(0);

  // Non-reactive closure state — lifecycle owned by dispose() and
  // the unmount-only $effect below.
  let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
  let prevChunkCount = 0;
  const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

  const llmReviewClient: LLMReviewClient = {
    review(systemPrompt, userPrompt, signal) {
      return callLLM(
        systemPrompt,
        userPrompt,
        REVIEW_MODEL,
        REVIEW_MAX_TOKENS,
        REVIEW_OUTPUT_SCHEMA as Record<string, unknown>,
        signal,
      );
    },
  };

  // NOTE: plain $effect calls — NOT $effect.root. Because this factory is
  // invoked at the top level of DraftStageMain's <script>, these effects
  // auto-bind to that component's lifetime.

  // Reload dismissed set when project changes
  $effect(() => {
    const _projectId = store.project?.id;
    if (disposed) return;
    dismissed = loadDismissed(store.project?.id);
  });

  // Recreate orchestrator when bible, scene, voice guide, or version changes
  $effect(() => {
    const bible = store.bible;
    const scenePlan = store.activeScenePlan;
    const _version = orchestratorVersion;
    const _voiceGuide = store.voiceGuide;
    if (disposed) return;

    untrack(() => {
      orchestrator?.cancelAll();
      reviewingChunks.clear();
      prevChunkCount = 0;
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = undefined;
    });

    if (!bible || !scenePlan) {
      orchestrator = null;
      chunkAnnotations.clear();
      return;
    }

    const loaded = loadAnnotations(store.project?.id, scenePlan.id);
    chunkAnnotations.clear();
    for (const [idx, anns] of loaded) {
      const filtered = anns.filter((a) => !dismissed.has(a.fingerprint));
      if (filtered.length > 0) chunkAnnotations.set(idx, filtered);
    }

    orchestrator = createReviewOrchestrator(
      bible,
      scenePlan,
      () => dismissed,
      llmReviewClient,
      (chunkIndex, anns, reviewedText) => {
        if (disposed) return;
        const currentChunk = store.activeSceneChunks[chunkIndex];
        if (currentChunk && getCanonicalText(currentChunk) !== reviewedText) return;
        chunkAnnotations.set(chunkIndex, anns);
        if (scenePlan) saveAnnotations(store.project?.id, scenePlan.id, new Map(chunkAnnotations));
      },
      (reviewing) => {
        if (disposed) return;
        reviewingChunks.clear();
        for (const idx of reviewing) reviewingChunks.add(idx);
      },
      store.voiceGuide?.editingInstructions || undefined,
    );
  });

  // Auto-review scheduling effect. Does NOT clear autoReviewTimeout in
  // cleanup; the orthogonal unmount-only effect below handles teardown.
  $effect(() => {
    const count = store.activeSceneChunks.length;
    const sceneId = store.activeScenePlan?.id;
    const generating = store.isGenerating;
    if (disposed) return;
    if (!sceneId || count === 0 || count <= prevChunkCount || generating) {
      if (!generating) prevChunkCount = count;
      return;
    }
    prevChunkCount = count;
    const orch = untrack(() => orchestrator);
    if (!orch) return;
    const chunks = untrack(() => store.activeSceneChunks);
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = setTimeout(() => {
      if (disposed) return;
      const views: ChunkView[] = chunks
        .map((c, i) => ({ chunk: c, index: i }))
        .filter(({ chunk }) => chunk.status !== "accepted")
        .map(({ chunk, index }) => ({
          index,
          text: getCanonicalText(chunk),
          sceneId,
        }));
      if (views.length > 0) orch.requestReview(views);
    }, 1500);
  });

  // Unmount-only cleanup for autoReviewTimeout (belt-and-braces alongside dispose()).
  $effect(() => {
    return () => {
      if (autoReviewTimeout !== undefined) {
        clearTimeout(autoReviewTimeout);
        autoReviewTimeout = undefined;
      }
    };
  });

  // Handler — handleUpdateChunk is implemented here (needed by the controller
  // unit test to pin the editDebounceTimers leak). Remaining handlers are
  // stubs until Task 5b/5c.
  function handleUpdateChunk(index: number, changes: Partial<Chunk>): void {
    if (disposed) return;
    const sceneId = store.activeScenePlan?.id;
    if (!sceneId) return;
    store.updateChunkForScene(sceneId, index, changes);
    if (changes.editedText !== undefined || changes.humanNotes !== undefined) {
      const key = `${sceneId}:${index}`;
      const existing = editDebounceTimers.get(key);
      if (existing) clearTimeout(existing);
      editDebounceTimers.set(
        key,
        setTimeout(() => {
          if (disposed) return;
          commands.persistChunk(sceneId, index);
          editDebounceTimers.delete(key);

          // After persistChunk, track significant edits for CIPHER
          const chunk = store.activeSceneChunks[index];
          if (chunk?.generatedText && chunk.editedText && store.project) {
            if (shouldTriggerCipher(chunk.generatedText, chunk.editedText)) {
              apiStoreSignificantEdit(store.project.id, chunk.id, chunk.generatedText, chunk.editedText)
                .then((count) => {
                  if (disposed) return;
                  if (count >= 10) {
                    console.log(`[cipher] ${count} significant edits — triggering batch CIPHER`);
                    apiFireBatchCipher(store.project!.id)
                      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: verbatim port of existing nested CIPHER callback chain
                      .then(({ ring1Injection }) => {
                        if (disposed) return;
                        if (ring1Injection && store.voiceGuide) {
                          store.setVoiceGuide({ ...store.voiceGuide, ring1Injection });
                          console.log("[cipher] Voice re-distilled with new CIPHER preferences");
                        }
                      })
                      .catch((err) => console.warn("[cipher] Batch inference failed:", err));
                  }
                })
                .catch((err) => console.warn("[cipher] Edit tracking failed:", err));
            }
          }
        }, 500),
      );
    } else {
      commands.persistChunk(sceneId, index);
    }
  }

  function handleReviewChunk(_index: number): void {
    throw new Error("handleReviewChunk not yet moved — see Task 5c");
  }
  function handleDismissAnnotation(_annotationId: string): void {
    throw new Error("handleDismissAnnotation not yet moved — see Task 5c");
  }
  async function handleRequestSuggestion(_annotationId: string, _feedback: string): Promise<string | null> {
    throw new Error("handleRequestSuggestion not yet moved — see Task 5c");
  }
  async function handleRemoveChunk(index: number): Promise<void> {
    if (disposed) return;
    const sceneId = store.activeScenePlan?.id;
    if (!sceneId) return;
    await commands.removeChunk(sceneId, index);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: verbatim port of existing destroy handler with multiple cancellation steps
  async function handleDestroyChunk(index: number): Promise<void> {
    if (disposed) return;
    const sceneId = store.activeScenePlan?.id;
    if (!sceneId) return;
    const chunks = store.activeSceneChunks;
    const isLast = index === chunks.length - 1;

    if (!isLast) {
      const count = chunks.length - index;
      const ok = window.confirm(
        `Delete chunk ${index + 1} and ${count - 1} later chunk${count - 1 > 1 ? "s" : ""} that depend on it?`,
      );
      if (!ok) return;
    }

    // ── Cancel everything that references chunk indices ──

    // 1. Stop autopilot — it would generate into a broken state
    if (store.isAutopilot) store.cancelAutopilot();

    // 2. Cancel pending auto-review (against the old chunk array)
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = undefined;

    // 3. Cancel in-flight LLM reviews and clear reviewing indicators
    orchestrator?.cancelAll();

    // 4. Flush edit debounce timers for destroyed indices
    for (let i = index; i < chunks.length; i++) {
      const key = `${sceneId}:${i}`;
      const timer = editDebounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        editDebounceTimers.delete(key);
      }
    }

    // 5. Clear persisted annotations (indices are now stale)
    saveAnnotations(store.project?.id, sceneId, new Map());
    chunkAnnotations.clear();

    // ── Remove chunks from end backward to avoid index shifting ──
    for (let i = chunks.length - 1; i >= index; i--) {
      if (disposed) return;
      await commands.removeChunk(sceneId, i);
    }

    // 6. Force orchestrator recreation with clean internal state.
    if (disposed) return;
    orchestratorVersion++;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    orchestrator?.cancelAll();
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = undefined;
    for (const timer of editDebounceTimers.values()) clearTimeout(timer);
    editDebounceTimers.clear();
  }

  return {
    get chunkAnnotations() {
      return chunkAnnotations;
    },
    get reviewingChunks() {
      return reviewingChunks;
    },
    handleReviewChunk,
    handleDismissAnnotation,
    handleRequestSuggestion,
    handleUpdateChunk,
    handleRemoveChunk,
    handleDestroyChunk,
    dispose,
  };
}
