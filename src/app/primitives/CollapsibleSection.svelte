<script lang="ts">
import type { Snippet } from "svelte";

let {
  summary,
  open = false,
  children,
}: {
  summary: string;
  open?: boolean;
  children: Snippet;
} = $props();
</script>

<details class="collapsible" {open}>
  <summary class="collapsible-summary">{summary}</summary>
  <div class="collapsible-content">{@render children()}</div>
</details>

<style>
  .collapsible { margin-top: 8px; }
  .collapsible-summary { font-size: 10px; color: var(--text-muted); cursor: pointer; }
  .collapsible-content { padding: 4px 0; }
</style>
