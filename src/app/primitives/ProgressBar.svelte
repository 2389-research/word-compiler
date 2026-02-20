<script lang="ts">
let {
  value,
  variant = "default",
  label,
  showOverflow = false,
  overflowPct = 0,
}: {
  value: number;
  variant?: "default" | "error";
  label?: string;
  showOverflow?: boolean;
  overflowPct?: number;
} = $props();

let clampedWidth = $derived(Math.min(Math.max(value, 1), 100));
</script>

{#if label}
  <div class="progress-label">{label}</div>
{/if}
<div class="progress-track">
  <div class="progress-fill" class:progress-error={variant === "error"} style="width: {clampedWidth}%"></div>
  {#if showOverflow && overflowPct > 0}
    <div class="progress-overflow" style="width: {Math.min(overflowPct, 20)}%"></div>
  {/if}
</div>

<style>
  .progress-label { font-size: 9px; color: var(--text-muted); margin-bottom: 2px; }
  .progress-track { height: 6px; background: var(--bg-secondary); border-radius: var(--radius-sm); overflow: hidden; margin: 4px 0; position: relative; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--ring1-color), var(--ring2-color), var(--ring3-color)); border-radius: var(--radius-sm); transition: width 0.3s ease; min-width: 2px; }
  .progress-error { background: var(--error); }
  .progress-overflow { position: absolute; right: 0; top: 0; height: 100%; background: repeating-linear-gradient(45deg, var(--error), var(--error) 2px, transparent 2px, transparent 6px); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
</style>
