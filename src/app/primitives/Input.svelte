<script lang="ts">
import { getContext } from "svelte";
import { focusOnMount } from "./actions.js";
import { FORM_FIELD_CONTEXT_KEY, type FormFieldContext } from "./formFieldContext.js";

let {
  id,
  type = "text",
  value = $bindable(""),
  placeholder,
  autofocus = false,
  oninput,
  onkeydown,
  onblur,
}: {
  id?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  autofocus?: boolean;
  oninput?: (e: Event) => void;
  onkeydown?: (e: KeyboardEvent) => void;
  onblur?: (e: FocusEvent) => void;
} = $props();

const ffCtx = getContext<FormFieldContext | undefined>(FORM_FIELD_CONTEXT_KEY);
const resolvedId = $derived(id ?? ffCtx?.inputId);
</script>

<input class="input" id={resolvedId} {type} bind:value {placeholder} {oninput} {onkeydown} {onblur} use:focusOnMount={autofocus} />

<style>
  .input {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 8px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }
  .input::placeholder { color: var(--text-muted); }
</style>
