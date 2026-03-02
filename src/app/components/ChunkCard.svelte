<script lang="ts">
import type { EditorialAnnotation } from "../../review/types.js";
import type { Chunk } from "../../types/index.js";
import { Badge, Button, TextArea } from "../primitives/index.js";
import AnnotatedEditor from "./AnnotatedEditor.svelte";

let {
  chunk,
  index,
  isLast,
  annotations = [],
  isReviewing = false,
  onUpdate,
  onRemove,
  onDestroy,
  onAcceptSuggestion,
  onDismissAnnotation,
  onRequestSuggestion,
  onReview,
}: {
  chunk: Chunk;
  index: number;
  isLast: boolean;
  annotations?: EditorialAnnotation[];
  isReviewing?: boolean;
  onUpdate: (index: number, changes: Partial<Chunk>) => void;
  onRemove: (index: number) => void;
  onDestroy?: (index: number) => void;
  onAcceptSuggestion?: (annotationId: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
  onRequestSuggestion?: (id: string, feedback: string) => Promise<string | null>;
  onReview?: (index: number) => void;
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

<div class="chunk-card" class:is-reviewing={isReviewing}>
  <div class="chunk-card-header">
    <div class="header-left">
      <span>Chunk {index + 1}</span>
      {#if onDestroy}
        <button class="destroy-btn" onclick={() => onDestroy(index)} title="Delete chunk{isLast ? '' : ' and all after it'}">
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </div>
    <div class="header-right">
      {#if isReviewing}
        <span class="reviewing-indicator">
          <span class="reviewing-waves-clip">
            <svg class="reviewing-waves" viewBox="0 0 28 10" xmlns="http://www.w3.org/2000/svg">
              <path class="wave wave-1" d="M-12 5 Q-9 1.2 -6 5 Q-3 8.8 0 5 Q3 1.2 6 5 Q9 8.8 12 5 Q15 1.2 18 5 Q21 8.8 24 5 Q27 1.2 30 5 Q33 8.8 36 5 Q39 1.2 42 5" fill="none" stroke="var(--accent)" stroke-width="1.4"/>
              <path class="wave wave-2" d="M-12 5 Q-9 1.2 -6 5 Q-3 8.8 0 5 Q3 1.2 6 5 Q9 8.8 12 5 Q15 1.2 18 5 Q21 8.8 24 5 Q27 1.2 30 5 Q33 8.8 36 5 Q39 1.2 42 5" fill="none" stroke="var(--accent)" stroke-width="1.1" opacity="0.45"/>
            </svg>
          </span>
          Reviewing...
        </span>
      {/if}
      <Badge variant={chunk.status}>{chunk.status}</Badge>
    </div>
  </div>
  <div class="chunk-card-body" class:reviewing-pulse={isReviewing}>
    {#if editing}
      <TextArea bind:value={editText} autosize />
    {:else}
      <AnnotatedEditor
        text={chunk.editedText ?? chunk.generatedText}
        {annotations}
        readonly={true}
        onTextChange={(newText) => onUpdate(index, { editedText: newText, status: "edited" })}
        onAcceptSuggestion={onAcceptSuggestion}
        onDismissAnnotation={onDismissAnnotation}
        {onRequestSuggestion}
      />
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
    {#if onReview && chunk.status !== "accepted"}
      <Button onclick={() => onReview(index)} disabled={isReviewing}>
        {isReviewing ? "Reviewing..." : "Review"}
      </Button>
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
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .chunk-card.is-reviewing {
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
    box-shadow:
      0 0 10px color-mix(in srgb, var(--accent) 20%, transparent),
      inset 0 0 30px color-mix(in srgb, var(--accent) 4%, transparent);
  }
  .chunk-card.is-reviewing .chunk-card-header {
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .chunk-card-header {
    position: sticky;
    top: 0;
    z-index: 10;
    /* Negative margins pull the header over the card's border so it sits
       flush against the scroll container top when stuck. The header's own
       border and radius replace the card's top edge visually. */
    margin: -1px -1px 0;
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    background: var(--bg-card);
    font-size: 11px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0);
    transition: box-shadow 0.15s, border-color 0.3s;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .destroy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s, background 0.12s;
  }
  .destroy-btn svg {
    width: 10px;
    height: 10px;
  }
  .chunk-card:hover .destroy-btn {
    opacity: 1;
  }
  .destroy-btn:hover {
    opacity: 1;
    color: var(--danger, #ef4444);
    background: color-mix(in srgb, var(--danger, #ef4444) 15%, transparent);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .reviewing-indicator {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--accent);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 2px 8px 2px 5px;
    border-radius: 10px;
  }

  /* ── Dual-wave animation ─────────────────────
     Two sine waves oscillate translateX at different periods
     (2.2s vs 3.5s). Since both motions are sinusoidal (ease-in-out)
     the phase differential between them is a beat pattern —
     itself sinusoidal — exactly as requested.
  */
  .reviewing-waves-clip {
    display: inline-block;
    width: 28px;
    height: 10px;
    overflow: hidden;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .reviewing-waves {
    display: block;
    width: 28px;
    height: 10px;
  }
  .wave-1 {
    animation: wave-drift-1 2.2s ease-in-out infinite;
  }
  .wave-2 {
    animation: wave-drift-2 3.5s ease-in-out infinite;
  }
  @keyframes wave-drift-1 {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(-7px); }
  }
  @keyframes wave-drift-2 {
    0%, 100% { transform: translateX(2px); }
    50% { transform: translateX(-9px); }
  }

  .chunk-card-body {
    padding: 10px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    position: relative;
    overflow: hidden;
  }
  .chunk-card-body.reviewing-pulse {
    animation: pulse-opacity 2.4s ease-in-out infinite;
  }
  .chunk-card-body.reviewing-pulse::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 35%;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    border-radius: 2px;
    animation: scan-line 2s ease-in-out infinite;
  }
  @keyframes pulse-opacity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes scan-line {
    0% { left: -35%; }
    100% { left: 100%; }
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
