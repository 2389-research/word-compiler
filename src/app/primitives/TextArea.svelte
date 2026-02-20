<script lang="ts">
let {
  value = $bindable(""),
  placeholder,
  rows,
  variant = "default",
  resize = "vertical",
  oninput,
}: {
  value?: string;
  placeholder?: string;
  rows?: number;
  variant?: "default" | "compact";
  resize?: "vertical" | "none" | "both";
  oninput?: (e: Event) => void;
} = $props();
</script>

<textarea
  class="textarea textarea-{variant}"
  bind:value
  {placeholder}
  {rows}
  style:resize
  {oninput}
></textarea>

<style>
  .textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 10px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    line-height: 1.6;
  }
  .textarea::placeholder { color: var(--text-muted); }
  .textarea-default { min-height: 200px; }
  .textarea-compact {
    min-height: 32px;
    font-size: 11px;
    padding: 6px 8px;
  }
</style>
