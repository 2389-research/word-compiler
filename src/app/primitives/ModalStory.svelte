<script lang="ts">
import Button from "./Button.svelte";
import Modal from "./Modal.svelte";

let {
  open = true,
  width = "default",
}: {
  open?: boolean;
  width?: "default" | "wide";
} = $props();

function noop() {}
</script>

<Modal {open} onClose={noop} {width}>
  {#snippet header()}Example Modal{/snippet}

  <p>This is the modal body content. It supports arbitrary Svelte content.</p>

  {#snippet footer()}
    <Button onclick={noop}>Cancel</Button>
    <Button variant="primary" onclick={noop}>Confirm</Button>
  {/snippet}
</Modal>
