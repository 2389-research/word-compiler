<script lang="ts">
import { getContext } from "svelte";
import { FORM_FIELD_CONTEXT_KEY, type FormFieldContext } from "./formFieldContext.js";

let {
  tags,
  onchange,
  placeholder = "Add tag...",
}: {
  tags: string[];
  onchange: (tags: string[]) => void;
  placeholder?: string;
} = $props();

const ffCtx = getContext<FormFieldContext | undefined>(FORM_FIELD_CONTEXT_KEY);

let inputValue = $state("");

function addTag(raw: string) {
  const tag = raw.trim();
  if (tag && !tags.includes(tag)) {
    onchange([...tags, tag]);
  }
  inputValue = "";
}

function removeTag(index: number) {
  onchange(tags.filter((_, i) => i !== index));
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag(inputValue);
  } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
    removeTag(tags.length - 1);
  }
}

function handleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (val.includes(",")) {
    const parts = val.split(",");
    for (const part of parts.slice(0, -1)) {
      addTag(part);
    }
    inputValue = parts[parts.length - 1]?.trim() ?? "";
  } else {
    inputValue = val;
  }
}
</script>

<div class="tag-input-wrap">
  {#each tags as tag, i (tag + i)}
    <span class="tag-pill">
      <span class="tag-text">{tag}</span>
      <button type="button" class="tag-remove" onclick={() => removeTag(i)} aria-label="Remove {tag}">x</button>
    </span>
  {/each}
  <input
    class="tag-input"
    id={ffCtx?.inputId}
    aria-labelledby={ffCtx?.labelId}
    type="text"
    value={inputValue}
    {placeholder}
    oninput={handleInput}
    onkeydown={handleKeydown}
  />
</div>

<style>
  .tag-input-wrap {
    display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 6px;
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: var(--radius-sm); min-height: 28px; align-items: center;
  }
  .tag-pill {
    display: inline-flex; align-items: center; gap: 2px;
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 1px 6px;
    font-size: 11px; color: var(--text-primary); font-family: var(--font-mono);
  }
  .tag-remove {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 10px; padding: 0 2px; font-family: var(--font-mono);
    line-height: 1;
  }
  .tag-remove:hover { color: var(--error); }
  .tag-input {
    border: none; background: transparent;
    font-family: var(--font-mono); font-size: 11px;
    color: var(--text-primary); flex: 1; min-width: 80px;
  }
  .tag-input:focus {
    outline: none;
  }
  .tag-input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  .tag-input::placeholder { color: var(--text-muted); }
</style>
