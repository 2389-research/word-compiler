<script lang="ts">
import type { RefinementChip, RefinementVariant } from "../../review/refineTypes.js";
import { REFINEMENT_CHIP_LABELS, REFINEMENT_CHIPS } from "../../review/refineTypes.js";
import { Badge, Button, Spinner } from "../primitives/index.js";

let {
  selectedText,
  loading = false,
  variants = [],
  position,
  onRefine,
  onCut,
  onAcceptVariant,
  onKeepOriginal,
  onCancel,
}: {
  selectedText: string;
  loading?: boolean;
  variants?: RefinementVariant[];
  position: { top: number; left: number; anchorBottom?: number };
  onRefine: (instruction: string, chips: RefinementChip[]) => void;
  onCut: () => void;
  onAcceptVariant: (variant: RefinementVariant) => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
} = $props();

let instruction = $state("");
let activeChips = $state<Set<RefinementChip>>(new Set());
let showAllVariants = $state(false);
let popoverEl: HTMLDivElement;
let flippedTop = $state<number | null>(null);

// Viewport flip: reposition above selection if popover overflows bottom
$effect(() => {
  const _trigger = position;
  flippedTop = null;

  requestAnimationFrame(() => {
    if (!popoverEl) return;
    const rect = popoverEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (rect.bottom > viewportHeight - 8 && position.anchorBottom != null) {
      flippedTop = position.anchorBottom - rect.height - 4;
    }
  });
});

function toggleChip(chip: RefinementChip) {
  const next = new Set(activeChips);
  if (chip === "cut_this") {
    // "Cut this" is special — immediate action, no LLM call
    onCut();
    return;
  }
  if (next.has(chip)) {
    next.delete(chip);
  } else {
    next.add(chip);
  }
  activeChips = next;
}

function handleRefine() {
  onRefine(instruction, [...activeChips]);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleRefine();
  }
  if (e.key === "Escape") {
    e.preventDefault();
    onCancel();
  }
}

let displayedVariants = $derived(showAllVariants ? variants : variants.slice(0, 1));
let hasMoreVariants = $derived(variants.length > 1 && !showAllVariants);
let hasResults = $derived(variants.length > 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={popoverEl}
  class="refinement-popover"
  style:top={(flippedTop ?? position.top) + "px"}
  style:left={position.left + "px"}
  onclick={(e) => e.stopPropagation()}
  onkeydown={handleKeydown}
>
  {#if loading}
    <div class="popover-loading">
      <Spinner />
      <span>Generating variants...</span>
    </div>
  {:else if hasResults}
    <div class="popover-variants">
      {#each displayedVariants as variant, i (i)}
        <div class="variant-card">
          <div class="variant-header">
            <span class="variant-label">Variant {i + 1}</span>
            {#if !variant.killListClean}
              <Badge variant="warning" title={variant.killListViolations.join("; ")}>Kill list</Badge>
            {/if}
          </div>
          <div class="variant-text">{variant.text}</div>
          <div class="variant-rationale">{variant.rationale}</div>
          <div class="variant-actions">
            <Button size="sm" variant="primary" onclick={() => onAcceptVariant(variant)}>Accept</Button>
          </div>
        </div>
      {/each}
      {#if hasMoreVariants}
        <Button size="sm" variant="ghost" onclick={() => { showAllVariants = true; }}>
          {variants.length - 1} more variant{variants.length - 1 !== 1 ? "s" : ""}
        </Button>
      {/if}
      <div class="variant-footer">
        <Button size="sm" onclick={onKeepOriginal}>Keep Original</Button>
      </div>
    </div>
  {:else}
    <div class="popover-input">
      <div class="selected-preview">
        "{selectedText.length > 80 ? `${selectedText.slice(0, 80)}...` : selectedText}"
      </div>

      <div class="chip-grid">
        {#each REFINEMENT_CHIPS as chip (chip)}
          <button
            type="button"
            class="chip"
            class:chip-active={activeChips.has(chip)}
            class:chip-cut={chip === "cut_this"}
            onclick={() => toggleChip(chip)}
          >
            {REFINEMENT_CHIP_LABELS[chip]}
          </button>
        {/each}
      </div>

      <input
        class="instruction-input"
        type="text"
        placeholder="What's wrong? (optional)"
        bind:value={instruction}
        onkeydown={handleKeydown}
      />

      <div class="popover-actions">
        <Button size="sm" variant="primary" onclick={handleRefine}>Refine</Button>
        <Button size="sm" variant="ghost" onclick={onCancel}>Cancel</Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .refinement-popover {
    position: absolute;
    z-index: 100;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-md, 6px);
    padding: 10px;
    max-width: 420px;
    min-width: 280px;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-size: 12px;
    line-height: 1.4;
  }

  .popover-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 4px;
    color: var(--text-secondary);
  }

  .selected-preview {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 8px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .chip {
    padding: 3px 8px;
    font-size: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.12s;
    font-family: var(--font-mono);
  }

  .chip:hover {
    border-color: var(--accent-dim);
    color: var(--text-primary);
  }

  .chip-active {
    background: color-mix(in srgb, var(--accent) 20%, var(--bg-secondary));
    border-color: var(--accent);
    color: var(--accent);
  }

  .chip-cut {
    border-color: var(--error, #ef4444);
    color: var(--error, #ef4444);
  }

  .chip-cut:hover {
    background: color-mix(in srgb, var(--error, #ef4444) 15%, var(--bg-secondary));
  }

  .instruction-input {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    font-family: var(--font-mono);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    outline: none;
    margin-bottom: 8px;
    box-sizing: border-box;
  }

  .instruction-input:focus {
    border-color: var(--accent);
  }

  .popover-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .popover-variants {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 50vh;
    overflow-y: auto;
  }

  .variant-card {
    padding: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .variant-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .variant-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .variant-text {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .variant-rationale {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 6px;
  }

  .variant-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .variant-footer {
    display: flex;
    justify-content: center;
  }
</style>
