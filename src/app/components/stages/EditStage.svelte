<script lang="ts">
import type { RefinementRequest, RefinementResult } from "../../../review/refineTypes.js";
import { getCanonicalText } from "../../../types/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import ProseEditor from "../ProseEditor.svelte";
import SceneSequencer from "../SceneSequencer.svelte";

let {
  store,
  commands,
  onRequestRefinement,
}: {
  store: ProjectStore;
  commands: Commands;
  onRequestRefinement: (request: RefinementRequest) => Promise<RefinementResult | null>;
} = $props();

let activeChunks = $derived(store.activeSceneChunks);
let sceneId = $derived(store.activeScenePlan?.id ?? "");
let sceneTitle = $derived(store.activeScenePlan?.title ?? "No section selected");

let wordCount = $derived(
  activeChunks.reduce((sum, c) => sum + getCanonicalText(c).split(/\s+/).filter(Boolean).length, 0),
);
</script>

<div class="edit-stage">
  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
  />

  <div class="edit-toolbar">
    <span class="edit-scene-title">{sceneTitle}</span>
    <span class="edit-word-count">{wordCount.toLocaleString()} words</span>
    <div class="edit-toolbar-spacer"></div>
    <span class="edit-hint">Select text to refine</span>
  </div>

  <div class="edit-content">
    {#if activeChunks.length > 0 && sceneId}
      <ProseEditor
        chunks={activeChunks}
        {sceneId}
        {commands}
        {onRequestRefinement}
      />
    {:else}
      <div class="edit-empty">
        No prose generated for this section yet. Go back to the Draft stage to generate content.
      </div>
    {/if}
  </div>
</div>

<style>
  .edit-stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .edit-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .edit-scene-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .edit-word-count {
    font-size: 11px;
    color: var(--text-muted);
  }

  .edit-toolbar-spacer {
    flex: 1;
  }

  .edit-hint {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .edit-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .edit-empty {
    padding: 48px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
