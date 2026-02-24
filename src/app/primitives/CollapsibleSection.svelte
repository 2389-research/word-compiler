<script lang="ts">
import type { Snippet } from "svelte";

type Priority = "essential" | "helpful" | "advanced";

let {
  summary,
  open = false,
  priority,
  sectionId,
  badge,
  children,
}: {
  summary: string;
  open?: boolean;
  priority?: Priority;
  sectionId?: string;
  badge?: string;
  children: Snippet;
} = $props();

function loadPersistedState(): boolean | null {
  if (!sectionId) return null;
  try {
    const stored = localStorage.getItem(`collapsible:${sectionId}`);
    if (stored !== null) return stored === "true";
  } catch {
    // localStorage unavailable
  }
  return null;
}

function persistState(value: boolean) {
  if (!sectionId) return;
  try {
    localStorage.setItem(`collapsible:${sectionId}`, String(value));
  } catch {
    // localStorage unavailable
  }
}

// Resolve initial open state: persisted > priority-based > prop
function resolveInitialOpen(): boolean {
  const persisted = loadPersistedState();
  if (persisted !== null) return persisted;
  if (priority === "essential") return true;
  if (priority) return false;
  return open;
}

let isOpen = $state(resolveInitialOpen());

// Re-resolve persisted state when sectionId changes (e.g. list reordering reuses this instance)
$effect(() => {
  void sectionId;
  isOpen = resolveInitialOpen();
});

function updateOpen(value: boolean) {
  isOpen = value;
  persistState(isOpen);
}

function onToggle(e: Event) {
  const details = e.currentTarget as HTMLDetailsElement;
  updateOpen(details.open);
}

/** Programmatic control for expand-all / collapse-all */
export function setOpen(value: boolean) {
  updateOpen(value);
}
</script>

<details class="collapsible" data-priority={priority ?? undefined} open={isOpen} ontoggle={onToggle}>
  <summary class="collapsible-summary">
    <span class="collapsible-label">{summary}</span>
    {#if badge}
      <span class="collapsible-badge">{badge}</span>
    {/if}
  </summary>
  <div class="collapsible-content">{@render children()}</div>
</details>

<style>
  .collapsible { margin-top: 8px; }
  .collapsible-summary {
    font-size: 10px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    list-style: none;
  }
  .collapsible-summary::-webkit-details-marker { display: none; }
  .collapsible-summary::before {
    content: "\25B8";
    display: inline-block;
    transition: transform 0.15s ease;
    font-size: 9px;
  }
  .collapsible[open] > .collapsible-summary::before {
    transform: rotate(90deg);
  }
  .collapsible-label { flex: 1; }
  .collapsible-badge {
    font-size: 9px;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }
  .collapsible-content { padding: 4px 0; }

  /* Priority-based styling */
  .collapsible[data-priority="essential"] > .collapsible-summary {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .collapsible[data-priority="helpful"] > .collapsible-summary {
    color: var(--text-muted);
  }
  .collapsible[data-priority="advanced"] > .collapsible-summary {
    color: var(--text-muted);
    font-style: italic;
  }
</style>
