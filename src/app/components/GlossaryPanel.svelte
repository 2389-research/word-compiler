<script lang="ts">
import { Input, Modal } from "../primitives/index.js";
import { FIELD_GLOSSARY } from "./field-glossary.js";

let open = $state(false);
let query = $state("");
let searchEl: HTMLDivElement | undefined = $state();

const allEntries = Object.entries(FIELD_GLOSSARY).sort(([, a], [, b]) => a.technical.localeCompare(b.technical));

let filteredEntries = $derived(
  query.trim() === ""
    ? allEntries
    : allEntries.filter(
        ([, entry]) =>
          entry.technical.toLowerCase().includes(query.toLowerCase()) ||
          entry.plain.toLowerCase().includes(query.toLowerCase()) ||
          entry.tooltip.toLowerCase().includes(query.toLowerCase()),
      ),
);

$effect(() => {
  function handler(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      open = !open;
      if (open) query = "";
    }
  }
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
});

$effect(() => {
  if (open) setTimeout(() => searchEl?.querySelector("input")?.focus(), 0);
});
</script>

<Modal {open} onClose={() => { open = false; }}>
  {#snippet header()}
    <div class="glossary-header">
      <span class="glossary-title">Glossary</span>
      <span class="glossary-shortcut">Ctrl+K</span>
    </div>
  {/snippet}

  <div class="glossary-search" bind:this={searchEl}>
    <Input bind:value={query} placeholder="Search terms..." />
  </div>

  <div class="glossary-results">
    {#each filteredEntries as [id, entry] (id)}
      <div class="glossary-entry">
        <div class="glossary-entry-header">
          <span class="glossary-technical">{entry.technical}</span>
          <span class="glossary-plain">{entry.plain}</span>
        </div>
        <p class="glossary-tooltip">{entry.tooltip}</p>
        {#if entry.whyItMatters}
          <p class="glossary-why"><strong>Why it matters:</strong> {entry.whyItMatters}</p>
        {/if}
        {#if entry.examples?.length}
          <div class="glossary-examples">
            {#each entry.examples as example}
              <span class="glossary-example">{example}</span>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <p class="glossary-empty">No terms match "{query}"</p>
    {/each}
  </div>
</Modal>

<style>
  .glossary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .glossary-title { font-size: 14px; }
  .glossary-shortcut {
    font-size: 10px;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
  }
  .glossary-search { margin-bottom: 12px; }
  .glossary-results {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 50vh;
    overflow-y: auto;
  }
  .glossary-entry {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
  }
  .glossary-entry-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }
  .glossary-technical {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .glossary-plain {
    font-size: 10px;
    color: var(--accent-dim);
  }
  .glossary-tooltip {
    font-size: 11px;
    color: var(--text-secondary);
    margin: 0 0 4px;
    line-height: 1.4;
  }
  .glossary-why {
    font-size: 10px;
    color: var(--text-muted);
    margin: 0 0 4px;
    line-height: 1.4;
  }
  .glossary-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .glossary-example {
    font-size: 9px;
    padding: 2px 6px;
    background: var(--bg-input);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .glossary-empty {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding: 20px;
  }
</style>
