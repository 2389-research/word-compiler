<script lang="ts">
import type { NarrativeIR } from "../../../types/index.js";
import { getCanonicalText } from "../../../types/index.js";
import { Badge, Button } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import IRInspector from "../IRInspector.svelte";

let {
  store,
  commands,
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  onExtractIR: (sceneId?: string) => void;
} = $props();

let selectedSceneId = $state<string | null>(null);

let sceneSummaries = $derived(
  store.scenes.map((s) => {
    const chunks = store.sceneChunks[s.plan.id] ?? [];
    const wordCount = chunks.reduce((sum, c) => sum + getCanonicalText(c).split(/\s+/).filter(Boolean).length, 0);
    const unresolvedFlags = store.auditFlags.filter((f) => f.sceneId === s.plan.id && !f.resolved);
    return {
      id: s.plan.id,
      title: s.plan.title,
      status: s.status,
      sceneOrder: s.sceneOrder,
      chunkCount: chunks.length,
      targetChunks: s.plan.chunkCount,
      wordCount,
      unresolvedFlags: unresolvedFlags.length,
      hasIR: !!store.sceneIRs[s.plan.id],
    };
  }),
);

let inspectedIR = $derived.by(() => {
  if (!selectedSceneId) return null;
  return store.sceneIRs[selectedSceneId] ?? null;
});

let inspectedTitle = $derived.by(() => {
  if (!selectedSceneId) return "No scene";
  return store.scenes.find((s) => s.plan.id === selectedSceneId)?.plan.title ?? "Unknown";
});

let inspectedCanExtract = $derived.by(() => {
  if (!selectedSceneId) return false;
  return store.scenes.find((s) => s.plan.id === selectedSceneId)?.status === "complete";
});

async function handleComplete(sceneId: string) {
  const result = await commands.completeScene(sceneId);
  if (result.ok) onExtractIR(sceneId);
}

function handleReopen(sceneId: string) {
  store.updateSceneStatus(sceneId, "drafting");
}

async function handleVerifyIR() {
  if (selectedSceneId) await commands.verifySceneIR(selectedSceneId);
}

async function handleUpdateIR(ir: NarrativeIR) {
  if (selectedSceneId) await commands.saveSceneIR(selectedSceneId, ir);
}
</script>

<div class="complete-stage">
  <div class="complete-header">
    <h2 class="complete-title">Section Completion</h2>
    <p class="complete-subtitle">Review section status, inspect records, and mark sections as complete.</p>
  </div>

  <div class="scene-grid">
    {#each sceneSummaries as scene (scene.id)}
      <div class="scene-card" class:scene-card-complete={scene.status === "complete"} class:scene-card-selected={selectedSceneId === scene.id}>
        <div class="scene-card-header">
          <span class="scene-card-title">{scene.title}</span>
          <Badge variant={scene.status === "complete" ? "accepted" : scene.status === "drafting" ? "default" : "warning"}>
            {scene.status}
          </Badge>
        </div>
        <div class="scene-card-stats">
          <span>Chunks: {scene.chunkCount}/{scene.targetChunks}</span>
          <span>{scene.wordCount.toLocaleString()} words</span>
          {#if scene.unresolvedFlags > 0}
            <Badge variant="warning">{scene.unresolvedFlags} flag{scene.unresolvedFlags !== 1 ? "s" : ""}</Badge>
          {/if}
          {#if scene.hasIR}
            <Badge variant="accepted">IR</Badge>
          {/if}
        </div>
        <div class="scene-card-actions">
          {#if scene.status === "complete"}
            <Button size="sm" variant="ghost" onclick={() => handleReopen(scene.id)}>Reopen to Draft</Button>
          {:else if scene.status === "drafting"}
            <Button size="sm" variant="primary" onclick={() => handleComplete(scene.id)}>Mark Complete</Button>
          {/if}
          <Button size="sm" onclick={() => { selectedSceneId = selectedSceneId === scene.id ? null : scene.id; }}>
            {selectedSceneId === scene.id ? "Hide IR" : "Inspect IR"}
          </Button>
        </div>
      </div>
    {/each}
  </div>

  {#if sceneSummaries.length === 0}
    <div class="complete-empty">No sections yet. Create sections in the Plan stage.</div>
  {/if}

  {#if selectedSceneId}
    <div class="ir-inspector-section">
      <IRInspector
        ir={inspectedIR}
        sceneTitle={inspectedTitle}
        isExtracting={store.isExtractingIR}
        canExtract={inspectedCanExtract}
        onExtract={() => onExtractIR(selectedSceneId ?? undefined)}
        onVerify={handleVerifyIR}
        onUpdate={handleUpdateIR}
        onClose={() => { selectedSceneId = null; }}
      />
    </div>
  {/if}
</div>

<style>
  .complete-stage {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .complete-header {
    max-width: 800px;
    margin: 0 auto 20px;
  }

  .complete-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .complete-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .scene-grid {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .scene-card {
    padding: 12px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .scene-card-complete {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  }

  .scene-card-selected {
    border-color: var(--accent);
  }

  .scene-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .scene-card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .scene-card-stats {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-muted);
    align-items: center;
  }

  .scene-card-actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .complete-empty {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  .ir-inspector-section {
    max-width: 800px;
    margin: 16px auto 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
</style>
