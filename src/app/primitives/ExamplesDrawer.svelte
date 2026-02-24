<script lang="ts">
import { trackExampleApply, trackExampleView, trackGenreFilter } from "../analytics.js";
import type { FieldExample } from "../components/field-examples.js";

let {
  fieldId,
  examples,
  onApplyTemplate,
}: {
  fieldId: string;
  examples: FieldExample[];
  onApplyTemplate?: (content: string) => void;
} = $props();

let expanded = $state(false);
let selectedGenre = $state<string | null>(null);

const allGenres = $derived([...new Set(examples.flatMap((ex) => ex.genreTags ?? []))].sort());

let filteredExamples = $derived(
  selectedGenre ? examples.filter((ex) => ex.genreTags?.includes(selectedGenre)) : examples,
);

function toggleExpanded() {
  expanded = !expanded;
  if (expanded) trackExampleView(fieldId);
}

function selectGenre(genre: string | null) {
  selectedGenre = genre;
  if (genre) trackGenreFilter(fieldId, genre);
}

function applyTemplate(example: FieldExample) {
  trackExampleApply(fieldId, example.title);
  onApplyTemplate?.(example.content);
}
</script>

{#if examples.length > 0}
  <div class="examples-drawer">
    <button
      type="button"
      class="examples-trigger"
      onclick={toggleExpanded}
    >
      <span class="examples-trigger-icon">{expanded ? "▾" : "▸"}</span>
      <span class="examples-trigger-text">
        {expanded ? "Hide" : "Show"} Examples ({examples.length})
      </span>
    </button>

    {#if expanded}
      <div class="examples-content">
        {#if allGenres.length > 1}
          <div class="genre-filters">
            <button
              type="button"
              class="genre-filter"
              class:genre-filter-active={selectedGenre === null}
              onclick={() => selectGenre(null)}
            >All</button>
            {#each allGenres as genre (genre)}
              <button
                type="button"
                class="genre-filter"
                class:genre-filter-active={selectedGenre === genre}
                onclick={() => selectGenre(genre)}
              >{genre}</button>
            {/each}
          </div>
        {/if}

        <div class="examples-list">
          {#each filteredExamples as example (example.title)}
            <div class="example-card" data-type={example.type}>
              <div class="example-card-header">
                <span class="example-type-badge">{example.type.replace(/_/g, " ")}</span>
                <span class="example-title">{example.title}</span>
              </div>
              <pre class="example-content">{example.content}</pre>
              <p class="example-explanation">{example.explanation}</p>
              {#if onApplyTemplate && example.type !== "pitfall"}
                <button
                  type="button"
                  class="example-apply"
                  onclick={() => applyTemplate(example)}
                >Use as Template</button>
              {/if}
            </div>
          {:else}
            <p class="examples-empty">No examples match "{selectedGenre}" genre.</p>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .examples-drawer {
    margin-top: 4px;
    border-radius: var(--radius-md);
  }
  .examples-trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border: none;
    background: none;
    color: var(--accent-dim);
    font-size: 10px;
    cursor: pointer;
    font-family: var(--font-mono);
  }
  .examples-trigger:hover {
    color: var(--accent);
  }
  .examples-trigger-icon {
    font-size: 8px;
  }
  .examples-content {
    padding: 6px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .genre-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .genre-filter {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 9px;
    cursor: pointer;
    text-transform: capitalize;
  }
  .genre-filter:hover {
    border-color: var(--accent-dim);
    color: var(--text-secondary);
  }
  .genre-filter-active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--bg-input);
  }
  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 300px;
    overflow-y: auto;
  }
  .example-card {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
  }
  .example-card[data-type="pitfall"] {
    border-left: 2px solid var(--warning);
  }
  .example-card[data-type="good_better_best"] {
    border-left: 2px solid var(--accent);
  }
  .example-card[data-type="technique"] {
    border-left: 2px solid var(--success);
  }
  .example-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .example-type-badge {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    background: var(--bg-input);
    color: var(--text-muted);
  }
  .example-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .example-content {
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    margin: 4px 0;
    padding: 6px;
    background: var(--bg-input);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }
  .example-explanation {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 4px 0 0;
    font-style: italic;
  }
  .example-apply {
    margin-top: 4px;
    padding: 2px 8px;
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent-dim);
    font-size: 9px;
    cursor: pointer;
  }
  .example-apply:hover {
    background: var(--accent-dim);
    color: var(--bg-primary);
  }
  .examples-empty {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
    padding: 12px;
  }
</style>
