<script lang="ts">
import { Button } from "./index.js";
import Pane from "./Pane.svelte";

let {
  title = "Panel Title",
  content = "Panel content goes here.",
  showHeaderRight = false,
  extraClass,
}: {
  title?: string;
  content?: string;
  showHeaderRight?: boolean;
  extraClass?: string;
} = $props();
</script>

{#if showHeaderRight}
  <Pane {title} {extraClass}>
    {#snippet headerRight()}
      <Button size="sm">Action</Button>
    {/snippet}
    <p>{content}</p>
  </Pane>
{:else}
  <Pane {title} {extraClass}>
    <p>{content}</p>
  </Pane>
{/if}
