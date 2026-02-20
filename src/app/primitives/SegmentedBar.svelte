<script lang="ts">
interface Segment {
  label: string;
  flex: number;
  variant: string;
  flagged?: boolean;
  starved?: boolean;
}

let {
  segments,
  height = 22,
}: {
  segments: Segment[];
  height?: number;
} = $props();
</script>

<div class="segmented-bar" style="height: {height}px">
  {#each segments as seg, i}
    <div
      class="segment segment-{seg.variant}"
      class:segment-flagged={seg.flagged}
      class:segment-starved={seg.starved}
      style="flex: {seg.flex}"
    >{seg.label}</div>
  {/each}
</div>

<style>
  .segmented-bar { display: flex; gap: 2px; border-radius: var(--radius-sm); overflow: hidden; margin: 4px 0 8px; }
  .segment { display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; text-transform: uppercase; letter-spacing: 0.05em; min-width: 40px; }
  .segment-r1 { background: var(--ring1-color); }
  .segment-r2 { background: var(--ring2-color); }
  .segment-r3 { background: var(--ring3-color); }
  .segment-empty { background: var(--bg-secondary); color: var(--text-muted); border: 1px dashed var(--border); font-style: italic; }
  .segment-actionable { background: var(--success); }
  .segment-noise { background: var(--warning); }
  .segment-flagged { background: repeating-linear-gradient(45deg, var(--error), var(--error) 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px); outline: 2px solid var(--error); outline-offset: -1px; }
  .segment-starved { background: repeating-linear-gradient(45deg, var(--warning), var(--warning) 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px); outline: 2px solid var(--warning); outline-offset: -1px; }
</style>
