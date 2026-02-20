<script lang="ts">
import Button from "./Button.svelte";

let {
  items,
  active,
  onSelect,
}: {
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
} = $props();
</script>

<div class="tabs" role="tablist">
  {#each items as item (item.id)}
    <Button
      variant="ghost"
      size="sm"
      onclick={() => onSelect(item.id)}
      aria-selected={item.id === active}
    >
      <span class="tab-label" class:tab-active={item.id === active}>{item.label}</span>
    </Button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab-label { transition: color 0.15s; }
  .tab-active { color: var(--accent); }
</style>
