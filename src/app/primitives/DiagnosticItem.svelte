<script lang="ts">
import type { Snippet } from "svelte";

let {
  severity,
  code,
  message,
  actions,
}: {
  severity: "critical" | "error" | "warning" | "info";
  code?: string;
  message: string;
  actions?: Snippet;
} = $props();
</script>

<div class="diagnostic diagnostic-{severity}">
  <div class="diagnostic-body">
    {#if code}<span class="diagnostic-code">{code}</span>{/if}
    <span>{message}</span>
  </div>
  {#if actions}
    <div class="diagnostic-actions">{@render actions()}</div>
  {/if}
</div>

<style>
  .diagnostic {
    padding: 4px 8px;
    margin-bottom: 4px;
    border-radius: var(--radius-sm);
    font-size: 11px;
  }
  .diagnostic-body { display: flex; gap: 8px; align-items: flex-start; }
  .diagnostic-critical { background: var(--severity-critical-bg); border-left: 3px solid var(--error); }
  .diagnostic-error { background: var(--severity-error-bg); border-left: 3px solid var(--error); }
  .diagnostic-warning { background: var(--severity-warning-bg); border-left: 3px solid var(--warning); }
  .diagnostic-info { background: var(--severity-info-bg); border-left: 3px solid var(--info); }
  .diagnostic-code { font-weight: bold; min-width: 140px; flex-shrink: 0; }
  .diagnostic-actions { margin-top: 6px; display: flex; gap: 4px; align-items: center; }
  .diagnostic-actions :global(.input) { flex: 1; font-size: 10px; padding: 3px 6px; }
</style>
