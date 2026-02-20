<script lang="ts">
import Select from "./Select.svelte";

let {
  value = "",
}: {
  value?: string;
} = $props();
</script>

<Select {value}>
  <option value="claude-sonnet-4">Claude Sonnet 4</option>
  <option value="claude-opus-4">Claude Opus 4</option>
</Select>
