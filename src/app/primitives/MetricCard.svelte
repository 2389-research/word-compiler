<script lang="ts">
let {
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
} = $props();
</script>

<div class="metric">
  <div class="metric-label">{label}</div>
  <div class="metric-value" style={valueColor ? `color: ${valueColor}` : undefined}>{value}</div>
</div>

<style>
  .metric { padding: 6px 8px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
  .metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
  .metric-value { font-size: 16px; color: var(--text-primary); }
</style>
