<script lang="ts">
import type { Snippet } from "svelte";

let { children }: { children: Snippet } = $props();
</script>

<table class="table">
  {@render children()}
</table>

<style>
  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
    font-family: var(--font-mono);
  }
  .table :global(thead tr) {
    border-bottom: 1px solid var(--border-strong);
    opacity: 0.7;
  }
  .table :global(th) { padding: 6px 12px; }
  .table :global(tbody tr) { border-bottom: 1px solid var(--border-subtle); }
  .table :global(td) { padding: 6px 12px; }
</style>
