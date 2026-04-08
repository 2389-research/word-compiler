<script lang="ts">
import { checkAuditResolutionGate, checkSceneCompletionGate } from "../../gates/index.js";
import type { EditorialAnnotation } from "../../review/types.js";
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
  chunkAnnotations = new Map(),
  reviewingChunks = new Set(),
  isAuditing = false,
  onGenerate,
  onCancelGeneration,
  onUpdateChunk,
  onRemoveChunk,
  onDestroyChunk,
  onRunAudit,
  onRunDeepAudit,
  onCompleteScene,
  onAutopilot,
  onCancelAutopilot,
  onOpenIRInspector,
  onExtractIR,
  onReviewChunk,
  onAcceptSuggestion,
  onDismissAnnotation,
  onRequestSuggestion,
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
  chunkAnnotations?: Map<number, EditorialAnnotation[]>;
  reviewingChunks?: Set<number>;
  isAuditing?: boolean;
  onGenerate: () => void;
  onCancelGeneration: () => void;
  onUpdateChunk: (index: number, changes: Partial<Chunk>) => void;
  onRemoveChunk: (index: number) => void;
  onDestroyChunk?: (index: number) => void;
  onRunAudit: () => void;
  onRunDeepAudit?: () => void;
  onCompleteScene: () => void;
  onAutopilot: () => void;
  onCancelAutopilot: () => void;
  onOpenIRInspector: () => void;
  onExtractIR: () => void;
  onReviewChunk?: (index: number) => void;
  onAcceptSuggestion?: (annotationId: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
  onRequestSuggestion?: (id: string, feedback: string) => Promise<string | null>;
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

<Pane title="Drafting Desk" contentClass="drafting-desk-content">
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
      <Button onclick={onRunAudit} disabled={chunks.length === 0 || isAuditing}>Run Audit</Button>
      <span class="info-tip">
        <svg class="info-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 7v4M8 5.5v-.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="info-tip-text">Scans for kill list violations, sentence rhythm issues, paragraph length, and computes prose metrics. Instant &mdash; no LLM call.</span>
      </span>
      {#if onRunDeepAudit}
        <Button onclick={onRunDeepAudit} disabled={chunks.length === 0 || isAuditing}>
          {#if isAuditing}<Spinner size="sm" /> Auditing...{:else}Deep Audit{/if}
        </Button>
        <button type="button" class="info-tip" aria-describedby="deep-audit-tip">
          <svg class="info-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 7v4M8 5.5v-.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span id="deep-audit-tip" class="info-tip-text" role="tooltip">Sends prose to Claude to check whether the writing states what should remain implicit. Requires a section plan with subtext defined.</span>
        </button>
      {/if}
      {#if sceneStatus !== "complete"}
        {#if isAutopilot}
          <Button variant="danger" onclick={onCancelAutopilot}>
            Cancel Autopilot ({chunks.length}/{maxChunks})
          </Button>
        {:else if isGenerating}
          <Button variant="danger" onclick={onCancelGeneration}>
            Cancel Generation
          </Button>
        {:else}
          <Button
            variant="primary"
            onclick={onGenerate}
            disabled={!canGenerateNext}
            title={gateMessages.length > 0 ? gateMessages.join("\n") : undefined}
          >
            {#if atChunkLimit}All chunks generated{:else}Generate Chunk {chunks.length + 1}{/if}
          </Button>
          {#if canGenerateNext && chunks.length === 0}
            <Button onclick={onAutopilot} title="Generate all chunks, auto-accept, and complete section">
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
          title={!canComplete ? [...(completionGate?.messages ?? []), ...auditGate.messages].join("\n") : "Mark section as complete"}
        >
          Complete Section
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
      <div class="empty-state">Load a brief and section plan, then generate your first chunk.</div>
    {/if}

    {#each chunks as chunk, i (chunk.id)}
      <ChunkCard
        {chunk}
        index={i}
        isLast={i === chunks.length - 1}
        annotations={chunkAnnotations.get(i) ?? []}
        isReviewing={reviewingChunks.has(i)}
        onUpdate={onUpdateChunk}
        onRemove={onRemoveChunk}
        onDestroy={onDestroyChunk}
        {onAcceptSuggestion}
        {onDismissAnnotation}
        {onRequestSuggestion}
        onReview={onReviewChunk}
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
  :global(.drafting-desk-content) {
    padding-top: 0 !important;
  }
  .gate-messages { padding: 6px 8px; margin-bottom: 8px; }
  .empty-state { color: var(--text-muted); padding: 20px; text-align: center; }
  .loading-indicator {
    display: flex; align-items: center; gap: 8px; padding: 12px;
    color: var(--accent); font-size: 12px;
  }
  .info-tip {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
  }
  .info-svg {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    transition: color 0.12s;
  }
  .info-tip:hover .info-svg {
    color: var(--accent);
  }
  .info-tip-text {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 240px;
    padding: 8px 10px;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-md, 6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.5;
    z-index: 200;
    pointer-events: none;
    white-space: normal;
  }
  .info-tip:hover .info-tip-text,
  .info-tip:focus-visible .info-tip-text {
    display: block;
  }
</style>
