<script lang="ts">
import type { Chunk, SceneStatus } from "../../types/index.js";
import { Badge } from "../primitives/index.js";
import type { SceneEntry } from "../store/project.svelte.js";

let {
  scenes,
  activeSceneIndex,
  sceneChunks,
  onSelectScene,
  onAddScene,
}: {
  scenes: SceneEntry[];
  activeSceneIndex: number;
  sceneChunks: Record<string, Chunk[]>;
  onSelectScene: (index: number) => void;
  onAddScene?: () => void;
} = $props();

const STATUS_LABELS: Record<SceneStatus, string> = {
  planned: "PLANNED",
  drafting: "DRAFTING",
  complete: "COMPLETE",
};

const STATUS_VARIANTS: Record<SceneStatus, "pending" | "edited" | "accepted"> = {
  planned: "pending",
  drafting: "edited",
  complete: "accepted",
};
</script>

{#if scenes.length > 0}
  <div class="scene-sequencer">
    {#each scenes as entry, i (entry.plan.id)}
      {@const chunks = sceneChunks[entry.plan.id] ?? []}
      <button
        type="button"
        class="scene-card {i === activeSceneIndex ? 'scene-card-active' : ''}"
        onclick={() => onSelectScene(i)}
      >
        <div class="scene-card-title">{entry.plan.title || `Section ${i + 1}`}</div>
        <div class="scene-card-meta">
          <Badge variant={STATUS_VARIANTS[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
          <span class="scene-card-chunks">{chunks.length}/{entry.plan.chunkCount}</span>
        </div>
      </button>
    {/each}
    {#if onAddScene}
      <button type="button" class="scene-card scene-card-add" onclick={onAddScene} title="Add new section">
        <span class="scene-card-add-icon">+</span>
      </button>
    {/if}
  </div>
{:else if onAddScene}
  <div class="scene-sequencer">
    <button type="button" class="scene-card scene-card-add" onclick={onAddScene} title="Add new section">
      <span class="scene-card-add-icon">+</span>
      <span class="scene-card-add-label">New Section</span>
    </button>
  </div>
{/if}

<style>
  .scene-sequencer {
    display: flex; gap: 4px; padding: 6px 8px;
    background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    overflow-x: auto; flex-shrink: 0;
  }
  .scene-card {
    display: flex; flex-direction: column; gap: 4px; padding: 6px 12px;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md);
    min-width: 120px; text-align: left; cursor: pointer; transition: all 0.15s;
    font-family: var(--font-mono); font-size: inherit; color: inherit;
  }
  .scene-card:hover { border-color: var(--accent-dim); }
  .scene-card-active { border-color: var(--accent); background: rgba(0, 212, 255, 0.08); }
  .scene-card-title {
    font-size: 11px; color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .scene-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .scene-card-chunks { font-size: 10px; color: var(--text-muted); }
  .scene-card-add {
    border-style: dashed; display: flex; align-items: center; justify-content: center;
    gap: 4px; color: var(--text-muted);
  }
  .scene-card-add:hover { color: var(--accent); border-color: var(--accent); }
  .scene-card-add-icon { font-size: 16px; line-height: 1; }
  .scene-card-add-label { font-size: 10px; }
</style>
