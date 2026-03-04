<script lang="ts">
import { SEVERITY_CSS_COLORS } from "../../review/constants.js";
import type { EditorialAnnotation } from "../../review/types.js";
import { Button, Spinner } from "../primitives/index.js";

let {
  annotation,
  position,
  onAccept,
  onDismiss,
  onRequestSuggestion,
}: {
  annotation: EditorialAnnotation;
  position: { top: number; left: number; anchorBottom: number };
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onRequestSuggestion?: (id: string, feedback: string) => Promise<string | null>;
} = $props();

let feedback = $state("");
let isGenerating = $state(false);
let error = $state<string | null>(null);

async function handleRequestSuggestion() {
  if (!onRequestSuggestion || !feedback.trim()) return;
  isGenerating = true;
  error = null;
  try {
    const result = await onRequestSuggestion(annotation.id, feedback.trim());
    if (result === null) {
      error = "Failed to generate suggestion. Try different direction.";
    }
    // On success, the parent updates the annotation with a suggestion,
    // which flows down via props — the template re-renders to show Apply.
  } catch (err) {
    error = err instanceof Error ? err.message : "Suggestion generation failed.";
  } finally {
    isGenerating = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleRequestSuggestion();
  }
}

function handleRetry() {
  error = null;
}

let color = $derived(SEVERITY_CSS_COLORS[annotation.severity] ?? SEVERITY_CSS_COLORS.info);
let tooltipEl: HTMLDivElement;
let finalTop = $state(0);
let finalLeft = $state(0);

$effect(() => {
  const pos = position;
  // Start at the default position (below squiggle)
  finalTop = pos.top;
  finalLeft = pos.left;

  requestAnimationFrame(() => {
    if (!tooltipEl) return;
    const rect = tooltipEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    let top = pos.top;
    let left = pos.left;

    // Vertical: flip above squiggle if overflows bottom
    if (top + rect.height > vh - 8) {
      top = pos.anchorBottom - rect.height - 4;
    }
    // Clamp to viewport top
    if (top < 8) top = 8;

    // Horizontal: shift left if overflows right
    if (left + rect.width > vw - 8) {
      left = vw - rect.width - 8;
    }
    // Clamp to viewport left
    if (left < 8) left = 8;

    finalTop = top;
    finalLeft = left;
  });
});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={tooltipEl}
  class="annotation-tooltip"
  style:top={finalTop + "px"}
  style:left={finalLeft + "px"}
  onclick={(e) => e.stopPropagation()}
>
  <div class="tooltip-header">
    <span class="tooltip-category" style:color>{annotation.severity}</span>
    <span class="tooltip-scope">{annotation.category.replace(/_/g, " ")}</span>
  </div>
  <div class="tooltip-message">{annotation.message}</div>
  {#if annotation.suggestion}
    <div class="tooltip-suggestion">
      <span class="suggestion-label">Suggestion:</span> {annotation.suggestion}
    </div>
    <div class="tooltip-actions">
      <Button onclick={() => onAccept(annotation.id)}>Apply</Button>
      <Button onclick={() => onDismiss(annotation.id)}>Dismiss</Button>
    </div>
  {:else if isGenerating}
    <div class="tooltip-generating">
      <Spinner size="sm" /> Generating suggestion...
    </div>
  {:else if error}
    <div class="tooltip-error">{error}</div>
    <div class="tooltip-actions">
      <Button onclick={handleRetry}>Retry</Button>
      <Button onclick={() => onDismiss(annotation.id)}>Dismiss</Button>
    </div>
  {:else if onRequestSuggestion}
    <div class="tooltip-feedback">
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        class="feedback-textarea"
        bind:value={feedback}
        placeholder="Describe your creative direction (e.g. 'more subtle, use body language')..."
        onkeydown={handleKeydown}
        autofocus
      ></textarea>
    </div>
    <div class="tooltip-actions">
      <Button onclick={handleRequestSuggestion} disabled={!feedback.trim()}>Get Suggestion</Button>
      <Button onclick={() => onDismiss(annotation.id)}>Dismiss</Button>
    </div>
  {:else}
    <div class="tooltip-actions">
      <Button onclick={() => onDismiss(annotation.id)}>Dismiss</Button>
    </div>
  {/if}
</div>

<style>
  .annotation-tooltip {
    position: fixed;
    z-index: 1000;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-md, 6px);
    padding: 10px 12px;
    width: 400px;
    max-width: calc(100vw - 16px);
    max-height: 50vh;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.5;
  }
  .tooltip-header {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .tooltip-scope {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 11px;
  }
  .tooltip-message {
    margin-bottom: 8px;
    color: var(--text-primary, #ccc);
  }
  .tooltip-suggestion {
    margin-bottom: 8px;
    padding: 6px 8px;
    background: var(--bg-secondary, #2a2a3a);
    border-radius: var(--radius-sm, 3px);
    font-style: italic;
    color: var(--text-secondary, #aaa);
  }
  .suggestion-label {
    font-style: normal;
    font-weight: 600;
    color: var(--text-muted);
  }
  .tooltip-generating {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    color: var(--accent);
    font-size: 11px;
  }
  .tooltip-error {
    margin-bottom: 8px;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--danger, #ef4444) 12%, transparent);
    border-radius: var(--radius-sm, 3px);
    color: var(--danger, #ef4444);
    font-size: 11px;
  }
  .tooltip-feedback {
    margin-bottom: 8px;
  }
  .feedback-textarea {
    width: 100%;
    min-height: 48px;
    max-height: 120px;
    padding: 6px 8px;
    background: var(--bg-secondary, #2a2a3a);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-sm, 3px);
    color: var(--text-primary, #ccc);
    font-family: inherit;
    font-size: 12px;
    line-height: 1.4;
    resize: vertical;
  }
  .feedback-textarea::placeholder {
    color: var(--text-muted);
  }
  .feedback-textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .tooltip-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    padding-top: 4px;
    border-top: 1px solid var(--border, #333);
  }
</style>
