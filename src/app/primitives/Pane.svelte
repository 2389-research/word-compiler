<script lang="ts">
import type { Snippet } from "svelte";

let {
  title,
  headerRight,
  children,
  contentClass,
  extraClass,
}: {
  title: string;
  headerRight?: Snippet;
  children: Snippet;
  contentClass?: string;
  extraClass?: string;
} = $props();
</script>

<div class="pane {extraClass ?? ''}">
  <div class="pane-header">
    <span>{title}</span>
    {#if headerRight}{@render headerRight()}{/if}
  </div>
  <div class="pane-content {contentClass ?? ''}">
    {@render children()}
  </div>
</div>

<style>
  .pane {
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }
  .pane-header {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .pane-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
</style>
