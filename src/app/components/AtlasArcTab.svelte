<script lang="ts">
import type { ChapterArc, ReaderState } from "../../types/index.js";
import { Button, CollapsibleSection, Input, TextArea } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import ReaderStateCard from "./ReaderStateCard.svelte";
import ReaderStateFields from "./ReaderStateFields.svelte";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let arc = $derived(store.chapterArc);

function hasReaderState(rs: ReaderState | null | undefined): boolean {
  if (!rs) return false;
  return rs.knows.length > 0 || rs.suspects.length > 0 || rs.wrongAbout.length > 0 || rs.activeTensions.length > 0;
}

// ─── Inline editing ──────────────────────────────
let editing = $state(false);
let draft = $state<ChapterArc | null>(null);
let saving = $state(false);

function startEdit() {
  if (!arc) return;
  editing = true;
  draft = JSON.parse(JSON.stringify(arc));
}

function cancelEdit() {
  editing = false;
  draft = null;
}

async function saveEdit() {
  if (!draft) return;
  saving = true;
  await commands.updateChapterArc(draft);
  saving = false;
  editing = false;
  draft = null;
}

function updateDraft(changes: Partial<ChapterArc>) {
  if (draft) draft = { ...draft, ...changes };
}
</script>

{#if !arc}
  <div class="atlas-empty">
    <p>No essay arc defined yet.</p>
  </div>
{:else if editing && draft}
  <div class="arc-tab edit-card">
    <div class="atlas-fields">
      <div class="atlas-field">
        <span class="atlas-label">Working Title</span>
        <Input value={draft.workingTitle} oninput={(e) => updateDraft({ workingTitle: (e.target as HTMLInputElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Chapter Number</span>
        <Input type="number" value={String(draft.chapterNumber)} oninput={(e) => updateDraft({ chapterNumber: Number((e.target as HTMLInputElement).value) || 1 })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Narrative Function</span>
        <TextArea value={draft.narrativeFunction} variant="compact" rows={2} oninput={(e) => updateDraft({ narrativeFunction: (e.target as HTMLTextAreaElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Dominant Register</span>
        <Input value={draft.dominantRegister} oninput={(e) => updateDraft({ dominantRegister: (e.target as HTMLInputElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Pacing Target</span>
        <Input value={draft.pacingTarget} oninput={(e) => updateDraft({ pacingTarget: (e.target as HTMLInputElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Ending Posture</span>
        <TextArea value={draft.endingPosture} variant="compact" rows={2} oninput={(e) => updateDraft({ endingPosture: (e.target as HTMLTextAreaElement).value })} />
      </div>
    </div>

    <CollapsibleSection summary="Reader State Entering" priority="helpful" sectionId={`atlas-arc-rs-enter-edit-${draft.id}`}>
      <ReaderStateFields
        state={draft.readerStateEntering}
        label="Entering"
        onUpdate={(rs) => updateDraft({ readerStateEntering: rs })}
      />
    </CollapsibleSection>

    <CollapsibleSection summary="Reader State Exiting" priority="helpful" sectionId={`atlas-arc-rs-exit-edit-${draft.id}`}>
      <ReaderStateFields
        state={draft.readerStateExiting}
        label="Exiting"
        onUpdate={(rs) => updateDraft({ readerStateExiting: rs })}
      />
    </CollapsibleSection>

    <div class="edit-actions">
      <Button size="sm" onclick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      <Button size="sm" variant="ghost" onclick={cancelEdit} disabled={saving}>Cancel</Button>
    </div>
  </div>
{:else}
  <div class="arc-tab">
    <div class="arc-header">
      <h3 class="arc-title">
        {arc.workingTitle || "Untitled Chapter"}
        <span class="arc-chapter">Ch. {arc.chapterNumber}</span>
      </h3>
      <button class="edit-btn" onclick={startEdit} title="Edit essay arc">edit</button>
    </div>

    <div class="atlas-fields">
      {#if arc.narrativeFunction}
        <div class="atlas-field">
          <span class="atlas-label">Narrative Function</span>
          <p class="atlas-value">{arc.narrativeFunction}</p>
        </div>
      {/if}
      {#if arc.dominantRegister}
        <div class="atlas-field">
          <span class="atlas-label">Dominant Register</span>
          <p class="atlas-value">{arc.dominantRegister}</p>
        </div>
      {/if}
      {#if arc.pacingTarget}
        <div class="atlas-field">
          <span class="atlas-label">Pacing Target</span>
          <p class="atlas-value">{arc.pacingTarget}</p>
        </div>
      {/if}
      {#if arc.endingPosture}
        <div class="atlas-field">
          <span class="atlas-label">Ending Posture</span>
          <p class="atlas-value">{arc.endingPosture}</p>
        </div>
      {/if}
    </div>

    {#if hasReaderState(arc.readerStateEntering)}
      <CollapsibleSection summary="Reader State Entering" priority="helpful" sectionId={`atlas-arc-rs-enter-${arc.id}`}>
        <ReaderStateCard state={arc.readerStateEntering} />
      </CollapsibleSection>
    {/if}

    {#if hasReaderState(arc.readerStateExiting)}
      <CollapsibleSection summary="Reader State Exiting" priority="helpful" sectionId={`atlas-arc-rs-exit-${arc.id}`}>
        <ReaderStateCard state={arc.readerStateExiting} />
      </CollapsibleSection>
    {/if}
  </div>
{/if}

<style>
  .arc-tab { display: flex; flex-direction: column; gap: 4px; }
  .arc-header { display: flex; align-items: center; gap: 6px; }
  .arc-title { font-size: 13px; color: var(--text-primary); margin: 0 0 8px; font-weight: 500; flex: 1; }
  .arc-chapter { font-size: 10px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }
  .edit-btn {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-muted); font-size: 9px; padding: 1px 6px; cursor: pointer;
  }
  .edit-btn:hover { color: var(--accent); border-color: var(--accent); }
  .edit-card {
    border: 1px solid var(--accent-dim, var(--accent)); border-radius: var(--radius-sm);
    padding: 8px; background: color-mix(in srgb, var(--accent) 3%, transparent);
  }
  .edit-actions { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; }
</style>
