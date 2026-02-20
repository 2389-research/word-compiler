<script lang="ts">
import { checkAuditResolutionGate, checkSceneCompletionGate } from "../../gates/index.js";
import type { AuditFlag, Chunk, NarrativeIR, ScenePlan, SceneStatus } from "../../types/index.js";
import { Badge, Button, DiagnosticItem, Pane, Spinner } from "../primitives/index.js";
import ChunkCard from "./ChunkCard.svelte";

let {
  chunks,
  scenePlan,
  sceneStatus,
  isGenerating,
  canGenerate,
  gateMessages,
  auditFlags,
  sceneIR,
  isExtractingIR,
  onGenerate,
  onUpdateChunk,
  onRemoveChunk,
  onRunAudit,
  onRunDeepAudit,
  onCompleteScene,
  onAutopilot,
  onCancelAutopilot,
  onOpenIRInspector,
  onExtractIR,
  isAutopilot = false,
}: {
  chunks: Chunk[];
  scenePlan: ScenePlan | null;
  sceneStatus: SceneStatus | null;
  isGenerating: boolean;
  isAutopilot: boolean;
  canGenerate: boolean;
  gateMessages: string[];
  auditFlags: AuditFlag[];
  sceneIR: NarrativeIR | null;
  isExtractingIR: boolean;
  onGenerate: () => void;
  onUpdateChunk: (index: number, changes: Partial<Chunk>) => void;
  onRemoveChunk: (index: number) => void;
  onRunAudit: () => void;
  onRunDeepAudit?: () => void;
  onCompleteScene: () => void;
  onAutopilot: () => void;
  onCancelAutopilot: () => void;
  onOpenIRInspector: () => void;
  onExtractIR: () => void;
} = $props();

let maxChunks = $derived(scenePlan?.chunkCount ?? Infinity);
let atChunkLimit = $derived(chunks.length >= maxChunks);
let canGenerateNext = $derived(canGenerate && !isGenerating && gateMessages.length === 0 && !atChunkLimit);
let completionGate = $derived(scenePlan ? checkSceneCompletionGate(chunks, scenePlan) : null);
let auditGate = $derived(checkAuditResolutionGate(auditFlags));
let canComplete = $derived(sceneStatus === "drafting" && completionGate?.passed && auditGate.passed);

// Auto-scroll to bottom during streaming
let bottomSentinel: HTMLDivElement;

$effect(() => {
  // Track last chunk's text length so this fires on each stream token
  const lastChunk = chunks[chunks.length - 1];
  const _len = lastChunk?.generatedText?.length ?? 0;

  if (isGenerating && bottomSentinel) {
    bottomSentinel.scrollIntoView({ block: "end" });
  }
});
</script>

<Pane title="Drafting Desk">
  {#snippet headerRight()}
    <div class="pane-actions">
      {#if sceneStatus === "complete"}
        <Badge variant="accepted">COMPLETE</Badge>
        {#if sceneIR}
          <Button onclick={onOpenIRInspector} title="View/edit IR">IR {sceneIR.verified ? "✓" : "?"}</Button>
        {:else}
          <Button onclick={onExtractIR} disabled={isExtractingIR} title="Extract scene blueprint">
            {#if isExtractingIR}<Spinner size="sm" /> Extracting...{:else}Extract Blueprint{/if}
          </Button>
        {/if}
      {/if}
      <Button onclick={onRunAudit} disabled={chunks.length === 0}>Run Audit</Button>
      {#if onRunDeepAudit}
        <Button onclick={onRunDeepAudit} disabled={chunks.length === 0} title="LLM-assisted subtext compliance check">Deep Audit</Button>
      {/if}
      {#if sceneStatus !== "complete"}
        {#if isAutopilot}
          <Button variant="danger" onclick={onCancelAutopilot}>
            Cancel Autopilot ({chunks.length}/{maxChunks})
          </Button>
        {:else}
          <Button
            variant="primary"
            onclick={onGenerate}
            disabled={!canGenerateNext}
            title={gateMessages.length > 0 ? gateMessages.join("\n") : undefined}
          >
            {#if isGenerating}Generating...{:else if atChunkLimit}All chunks generated{:else}Generate Chunk {chunks.length + 1}{/if}
          </Button>
          {#if canGenerateNext && chunks.length === 0}
            <Button onclick={onAutopilot} title="Generate all chunks, auto-accept, and complete scene">
              Autopilot
            </Button>
          {/if}
        {/if}
      {/if}
      {#if atChunkLimit && sceneStatus !== "complete" && !isAutopilot}
        <Button
          variant="primary"
          onclick={onCompleteScene}
          disabled={!canComplete}
          title={!canComplete ? [...(completionGate?.messages ?? []), ...auditGate.messages].join("\n") : "Mark scene as complete"}
        >
          Complete Scene
        </Button>
      {/if}
    </div>
  {/snippet}
    {#if gateMessages.length > 0 && !isGenerating}
      <div class="gate-messages">
        {#each gateMessages as msg, i}
          <DiagnosticItem severity="warning" message={msg} />
        {/each}
      </div>
    {/if}

    {#if chunks.length === 0 && !isGenerating && gateMessages.length === 0}
      <div class="empty-state">Load a Bible and Scene Plan, then generate your first chunk.</div>
    {/if}

    {#each chunks as chunk, i (chunk.id)}
      <ChunkCard
        {chunk}
        index={i}
        isLast={i === chunks.length - 1}
        onUpdate={onUpdateChunk}
        onRemove={onRemoveChunk}
      />
    {/each}

    {#if isGenerating}
      <div class="loading-indicator">
        <Spinner />
        Generating chunk {chunks.length}{scenePlan?.chunkDescriptions[chunks.length - 1] ? `: ${scenePlan.chunkDescriptions[chunks.length - 1]}` : ""}...
      </div>
    {/if}
    <div bind:this={bottomSentinel}></div>
</Pane>

<style>
  .gate-messages { padding: 6px 8px; margin-bottom: 8px; }
  .empty-state { color: var(--text-muted); padding: 20px; text-align: center; }
  .loading-indicator {
    display: flex; align-items: center; gap: 8px; padding: 12px;
    color: var(--accent); font-size: 12px;
  }
</style>
