<script lang="ts">
import type { Snippet } from "svelte";

let {
  open,
  onClose,
  width = "default",
  header,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  width?: "default" | "wide";
  header: Snippet;
  children: Snippet;
  footer?: Snippet;
} = $props();

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") onClose();
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
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal modal-{width}">
      <div class="modal-header">{@render header()}</div>
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
    max-height: 80vh;
    display: flex;
    flex-direction: column;
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
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
