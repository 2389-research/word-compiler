<script lang="ts">
import SectionPanel from "./SectionPanel.svelte";

let {
  title = "Section Title",
  badgeText = "",
  content = "Section content goes here.",
}: {
  title?: string;
  badgeText?: string;
  content?: string;
} = $props();
</script>

{#if badgeText}
  <SectionPanel {title}>
    {#snippet badge()}<span>{badgeText}</span>{/snippet}
    <p>{content}</p>
  </SectionPanel>
{:else}
  <SectionPanel {title}>
    <p>{content}</p>
  </SectionPanel>
{/if}
