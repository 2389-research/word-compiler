<script lang="ts">
import { type Snippet, setContext } from "svelte";
import { FIELD_GLOSSARY } from "../components/field-glossary.js";
import { hasHoverCapability, onHoverChange } from "./actions.js";
import { FORM_FIELD_CONTEXT_KEY, type FormFieldContext } from "./formFieldContext.js";

let {
  label,
  fieldId,
  hint,
  error,
  required = false,
  children,
}: {
  label?: string;
  fieldId?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: Snippet;
} = $props();

// Unique per-instance ids so multiple FormFields reusing the same glossary
// fieldId (e.g. one per character) still get distinct DOM ids.
const uid = `ff-${Math.random().toString(36).slice(2, 10)}`;
const inputId = uid;
const labelId = `${uid}-label`;

// Child primitives (Input / TextArea / Select / RadioGroup / TagInput) read
// these via getContext to wire explicit label-for / aria-labelledby without
// requiring every call site to thread ids manually.
setContext<FormFieldContext>(FORM_FIELD_CONTEXT_KEY, { inputId, labelId });

let glossary = $derived(fieldId ? FIELD_GLOSSARY[fieldId as keyof typeof FIELD_GLOSSARY] : undefined);
let displayLabel = $derived(label ?? glossary?.technical ?? fieldId ?? "");
let plainLabel = $derived(glossary?.plain);
let tooltip = $derived(glossary?.tooltip);

let showTooltip = $state(false);
let tooltipId = $derived(fieldId ? `tooltip-${fieldId}` : undefined);

let hasHover = $state(hasHoverCapability());

$effect(() => {
  return onHoverChange(() => {
    hasHover = hasHoverCapability();
  });
});
</script>

<div class="form-field" class:form-field-error={!!error}>
  <label class="form-field-label" id={labelId} for={inputId}>
    {displayLabel}{#if required}<span class="form-field-required">*</span>{/if}
    {#if plainLabel}
      <span class="form-field-plain">({plainLabel})</span>
    {/if}
    {#if tooltip}
      <button
        type="button"
        class="form-field-tooltip-trigger"
        aria-label="More information about {displayLabel}"
        aria-describedby={showTooltip && tooltipId ? tooltipId : undefined}
        onmouseenter={() => { if (hasHover) showTooltip = true; }}
        onmouseleave={() => { if (hasHover) showTooltip = false; }}
        onclick={() => { if (!hasHover) showTooltip = !showTooltip; }}
        onfocus={() => { if (hasHover) showTooltip = true; }}
        onblur={() => { showTooltip = false; }}
      >?</button>
      {#if showTooltip}
        <span class="form-field-tooltip" role="tooltip" id={tooltipId}>{tooltip}</span>
      {/if}
    {/if}
  </label>
  {#if hint}
    <span class="form-field-hint">{hint}</span>
  {/if}
  <div class="form-field-input">{@render children?.()}</div>
  {#if error}
    <span class="form-field-error-msg">{error}</span>
  {/if}
</div>

<style>
  .form-field { display: flex; flex-direction: column; gap: 3px; }
  .form-field-label {
    font-size: 11px; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.05em;
    display: flex; align-items: center; gap: 4px;
    position: relative;
  }
  .form-field-required { color: var(--error); margin-left: 2px; }
  .form-field-plain {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: none;
    letter-spacing: normal;
    font-weight: normal;
  }
  .form-field-tooltip-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 9px;
    cursor: help;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }
  .form-field-tooltip-trigger:hover,
  .form-field-tooltip-trigger:focus {
    border-color: var(--accent);
    color: var(--accent);
  }
  .form-field-tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 50;
    margin-top: 4px;
    padding: 6px 8px;
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-primary);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    max-width: 280px;
    text-transform: none;
    letter-spacing: normal;
    font-weight: normal;
    white-space: normal;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .form-field-hint { font-size: 10px; color: var(--text-muted); }
  .form-field-input { display: flex; flex-direction: column; }
  .form-field-error-msg { font-size: 10px; color: var(--error); }
</style>
