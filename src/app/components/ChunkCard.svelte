<script lang="ts">
import type { Chunk } from "../../types/index.js";
import { Badge, Button, TextArea } from "../primitives/index.js";

let {
  chunk,
  index,
  isLast,
  onUpdate,
  onRemove,
}: {
  chunk: Chunk;
  index: number;
  isLast: boolean;
  onUpdate: (index: number, changes: Partial<Chunk>) => void;
  onRemove: (index: number) => void;
} = $props();

let editing = $state(false);
// Local editing state — initializes from chunk but is user-editable during edit mode
let editText = $state("");
let localNotes = $state("");

// Sync from props when not actively editing
$effect(() => {
  if (!editing) {
    editText = chunk.editedText ?? chunk.generatedText;
  }
});
$effect(() => {
  localNotes = chunk.humanNotes ?? "";
});

// Alias for template usage
let notes = $derived(localNotes);

function handleAccept() {
  onUpdate(index, { status: "accepted", humanNotes: notes || null });
}

function handleEdit() {
  if (editing) {
    onUpdate(index, { status: "edited", editedText: editText, humanNotes: notes || null });
    editing = false;
  } else {
    editing = true;
  }
}

function handleReject() {
  onUpdate(index, { status: "rejected" });
}
</script>

<div class="chunk-card">
  <div class="chunk-card-header">
    <span>Chunk {index + 1}</span>
    <Badge variant={chunk.status}>{chunk.status}</Badge>
  </div>
  <div class="chunk-card-body">
    {#if editing}
      <TextArea bind:value={editText} variant="compact" resize="vertical" />
    {:else}
      {chunk.editedText ?? chunk.generatedText}
    {/if}
  </div>
  <div class="chunk-card-actions">
    <Button onclick={handleAccept} disabled={chunk.status === "accepted"}>Accept</Button>
    <Button onclick={handleEdit}>{editing ? "Save Edit" : "Edit"}</Button>
    <Button
      variant="danger"
      onclick={handleReject}
      disabled={chunk.status === "rejected" || !isLast}
      title={!isLast ? "Can only reject the last chunk — later chunks depend on this one" : undefined}
    >
      Reject
    </Button>
    {#if chunk.status === "rejected"}
      <Button onclick={() => onRemove(index)}>Remove & Retry</Button>
    {/if}
    <div class="spacer"></div>
    <span class="chunk-meta">{chunk.model} | t={chunk.temperature}</span>
  </div>
  <div class="chunk-notes-wrapper">
    <TextArea
      bind:value={notes}
      variant="compact"
      placeholder="Notes for next chunk (micro-directive)..."
      oninput={() => onUpdate(index, { humanNotes: notes || null })}
    />
  </div>
</div>

<style>
  .chunk-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    background: var(--bg-card);
  }
  .chunk-card-header {
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
  }
  .chunk-card-body {
    padding: 10px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    max-height: 300px;
    overflow-y: auto;
  }
  .chunk-card-actions {
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .spacer { flex: 1; }
  .chunk-meta { font-size: 10px; color: var(--text-muted); }
  .chunk-notes-wrapper { padding: 6px 10px; }
</style>
