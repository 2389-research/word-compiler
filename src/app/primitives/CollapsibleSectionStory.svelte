<script lang="ts">
import CollapsibleSection from "./CollapsibleSection.svelte";

let {
  summary = "Details",
  content = "Content here",
  open = false,
}: {
  summary?: string;
  content?: string;
  open?: boolean;
} = $props();
</script>

<CollapsibleSection {summary} {open}>
  <p>{content}</p>
</CollapsibleSection>
