<script lang="ts">
let {
  options,
  value,
  onchange,
  name,
  direction = "row",
}: {
  options: { value: string; label: string }[];
  value: string;
  onchange: (value: string) => void;
  name: string;
  direction?: "row" | "column";
} = $props();
</script>

<div class="radio-group radio-group-{direction}" role="radiogroup">
  {#each options as opt (opt.value)}
    <label class="radio-option" class:radio-option-selected={value === opt.value}>
      <input
        type="radio"
        {name}
        value={opt.value}
        checked={value === opt.value}
        onchange={() => onchange(opt.value)}
      />
      <span class="radio-label">{opt.label}</span>
    </label>
  {/each}
</div>

<style>
  .radio-group { display: flex; gap: 4px; flex-wrap: wrap; }
  .radio-group-column { flex-direction: column; }
  .radio-option {
    display: flex; align-items: center; gap: 4px; cursor: pointer;
    font-size: 11px; color: var(--text-secondary);
    padding: 3px 8px; border: 1px solid var(--border);
    border-radius: var(--radius-sm); transition: all 0.15s;
  }
  .radio-option:hover { border-color: var(--accent-dim); }
  .radio-option-selected {
    border-color: var(--accent); color: var(--accent);
    background: rgba(0, 212, 255, 0.08);
  }
  .radio-option input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .radio-option:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .radio-label { font-family: var(--font-mono); }
</style>
