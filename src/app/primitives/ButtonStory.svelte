<script lang="ts">
import Button from "./Button.svelte";

let {
  variant = "default",
  size = "md",
  disabled = false,
  text = "",
}: {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  text?: string;
} = $props();
</script>

<Button {variant} {size} {disabled}>{text}</Button>
