<script lang="ts">
import type { Snippet } from "svelte";

let {
  value,
  onchange,
  children,
}: {
  value: string;
  onchange?: (e: Event) => void;
  children: Snippet;
} = $props();
</script>

<select class="select" {value} {onchange}>
  {@render children()}
</select>

<style>
  .select {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 2px 6px;
  }
</style>
