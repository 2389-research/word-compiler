<script lang="ts">
import type { Snippet } from "svelte";

let {
  variant = "default",
  size = "md",
  disabled = false,
  type = "button",
  title,
  onclick,
  children,
}: {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  onclick?: (e: MouseEvent) => void;
  children: Snippet;
} = $props();
</script>

<button
  class="btn btn-{variant} btn-{size}"
  {type}
  {disabled}
  {title}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    font-family: var(--font-mono);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Sizes */
  .btn-sm { font-size: 10px; padding: 2px 8px; }
  .btn-md { font-size: 11px; padding: 4px 10px; }

  /* Default */
  .btn-default {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }
  .btn-default:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Primary */
  .btn-primary {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent);
    color: var(--bg-primary);
  }

  /* Danger */
  .btn-danger {
    background: var(--bg-secondary);
    border: 1px solid var(--error);
    color: var(--error);
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--error);
    color: white;
  }

  /* Ghost */
  .btn-ghost {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
  }
  .btn-ghost:hover:not(:disabled) {
    color: var(--text-primary);
  }
</style>
