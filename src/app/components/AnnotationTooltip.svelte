<script lang="ts">
import { SEVERITY_CSS_COLORS } from "../../review/constants.js";
import type { EditorialAnnotation } from "../../review/types.js";
import { Button } from "../primitives/index.js";

let {
  annotation,
  position,
  onAccept,
  onDismiss,
}: {
  annotation: EditorialAnnotation;
  position: { top: number; left: number };
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
} = $props();

let color = $derived(SEVERITY_CSS_COLORS[annotation.severity] ?? SEVERITY_CSS_COLORS.info);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="annotation-tooltip"
  style:top="{position.top}px"
  style:left="{position.left}px"
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
  {/if}
  <div class="tooltip-actions">
    {#if annotation.suggestion}
      <Button onclick={() => onAccept(annotation.id)}>Apply</Button>
    {/if}
    <Button onclick={() => onDismiss(annotation.id)}>Dismiss</Button>
  </div>
</div>

<style>
  .annotation-tooltip {
    position: absolute;
    z-index: 100;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-md, 6px);
    padding: 8px 10px;
    max-width: 340px;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-size: 12px;
    line-height: 1.4;
  }
  .tooltip-header {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 4px;
    font-weight: 600;
    text-transform: capitalize;
  }
  .tooltip-scope {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 11px;
  }
  .tooltip-message {
    margin-bottom: 6px;
    color: var(--text-primary, #ccc);
  }
  .tooltip-suggestion {
    margin-bottom: 6px;
    padding: 4px 6px;
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
  .tooltip-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
</style>
