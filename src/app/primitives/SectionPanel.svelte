<script lang="ts">
import type { Snippet } from "svelte";

let {
  title,
  badge,
  children,
}: {
  title: string;
  badge?: Snippet;
  children: Snippet;
} = $props();
</script>

<div class="section-panel">
  <div class="section-panel-header">
    <span>{title}</span>
    {#if badge}{@render badge()}{/if}
  </div>
  {@render children()}
</div>

<style>
  .section-panel { margin-bottom: 12px; }
  .section-panel-header {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }
</style>
