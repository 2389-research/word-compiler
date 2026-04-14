<script lang="ts">
import { getContext, type Snippet } from "svelte";
import { FORM_FIELD_CONTEXT_KEY, type FormFieldContext } from "./formFieldContext.js";

let {
  id,
  value,
  onchange,
  children,
}: {
  id?: string;
  value: string;
  onchange?: (e: Event) => void;
  children: Snippet;
} = $props();

const ffCtx = getContext<FormFieldContext | undefined>(FORM_FIELD_CONTEXT_KEY);
const resolvedId = $derived(id ?? ffCtx?.inputId);
</script>

<select class="select" id={resolvedId} {value} {onchange}>
  {@render children()}
</select>

<style>
  .select {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 2px 6px;
  }
</style>
