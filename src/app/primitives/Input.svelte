<script lang="ts">
let {
  type = "text",
  value = $bindable(""),
  placeholder,
  oninput,
  onkeydown,
}: {
  type?: string;
  value?: string;
  placeholder?: string;
  oninput?: (e: Event) => void;
  onkeydown?: (e: KeyboardEvent) => void;
} = $props();
</script>

<input class="input" {type} bind:value {placeholder} {oninput} {onkeydown} />

<style>
  .input {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }
  .input::placeholder { color: var(--text-muted); }
</style>
