<script lang="ts">
import Badge from "./Badge.svelte";

let {
  variant = "default",
  text = "",
}: {
  variant?: "default" | "pending" | "accepted" | "edited" | "rejected" | "warning";
  text?: string;
} = $props();
</script>

<Badge {variant}>{text}</Badge>
