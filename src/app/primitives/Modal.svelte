<script lang="ts">
import type { Snippet } from "svelte";
import { tick } from "svelte";

let {
  open,
  onClose,
  width = "default",
  labelledBy,
  header,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  width?: "default" | "wide";
  labelledBy?: string;
  header: Snippet;
  children: Snippet;
  footer?: Snippet;
} = $props();

let dialogEl = $state<HTMLDivElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
let headerId = `modal-header-${Math.random().toString(36).slice(2, 9)}`;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(): HTMLElement[] {
  if (!dialogEl) return [];
  return Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}

$effect(() => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null;
    tick().then(() => {
      const focusable = getFocusable();
      (focusable[0] ?? dialogEl)?.focus();
    });
  } else if (previouslyFocused) {
    previouslyFocused.focus();
    previouslyFocused = null;
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    onClose();
    return;
  }
  if (e.key !== "Tab") return;

  const focusable = getFocusable();
  if (focusable.length === 0) {
    e.preventDefault();
    dialogEl?.focus();
    return;
  }
  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) onClose();
}
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
  >
    <div
      bind:this={dialogEl}
      class="modal modal-{width}"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? headerId}
      tabindex="-1"
    >
      <div class="modal-header" id={headerId}>{@render header()}</div>
      <div class="modal-body">{@render children()}</div>
      {#if footer}
        <div class="modal-footer">{@render footer()}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    max-height: 80dvh;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
  }
  .modal:focus {
    outline: none;
  }
  .modal:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .modal-default { width: 600px; }
  .modal-wide { width: 700px; }
  .modal-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    color: var(--accent);
  }
  .modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }
  .modal-footer {
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
