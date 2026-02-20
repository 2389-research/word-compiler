<script lang="ts">
import Button from "./Button.svelte";

let {
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
} = $props();
</script>

<div class="error-banner" role="alert">
  <span class="error-message">{message}</span>
  {#if onDismiss}
    <Button size="sm" onclick={onDismiss}>dismiss</Button>
  {/if}
</div>

<style>
  .error-banner {
    padding: 8px 12px;
    background: var(--severity-critical-bg);
    border: 1px solid var(--error);
    border-radius: var(--radius-md);
    color: var(--error);
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .error-message { flex: 1; }
</style>
