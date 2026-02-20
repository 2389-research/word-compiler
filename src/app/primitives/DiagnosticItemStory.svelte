<script lang="ts">
import DiagnosticItem from "./DiagnosticItem.svelte";
import { Button } from "./index.js";

let {
  severity = "error",
  code,
  message = "Something went wrong",
  showActions = false,
}: {
  severity?: "critical" | "error" | "warning" | "info";
  code?: string;
  message?: string;
  showActions?: boolean;
} = $props();
</script>

{#if showActions}
  <DiagnosticItem {severity} {code} {message}>
    {#snippet actions()}
      <Button size="sm">Resolve</Button>
      <Button size="sm">Dismiss</Button>
    {/snippet}
  </DiagnosticItem>
{:else}
  <DiagnosticItem {severity} {code} {message} />
{/if}
