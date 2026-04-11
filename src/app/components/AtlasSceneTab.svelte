<script lang="ts">
import type { ReaderState, ScenePlan } from "../../types/index.js";
import {
  Badge,
  Button,
  CollapsibleSection,
  Input,
  NumberRange,
  RadioGroup,
  TagInput,
  TextArea,
} from "../primitives/index.js";
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

let plan = $derived(store.activeScenePlan);

let povName = $derived.by(() => {
  if (!plan?.povCharacterId || !store.bible) return null;
  return store.bible.characters.find((c) => c.id === plan.povCharacterId)?.name ?? null;
});

let locationName = $derived.by(() => {
  if (!plan?.locationId || !store.bible) return null;
  return store.bible.locations.find((l) => l.id === plan.locationId)?.name ?? null;
});

function hasReaderState(rs: ReaderState | null): boolean {
  if (!rs) return false;
  return rs.knows.length > 0 || rs.suspects.length > 0 || rs.wrongAbout.length > 0 || rs.activeTensions.length > 0;
}

// ─── Inline editing ──────────────────────────────
let editing = $state(false);
let draft = $state<ScenePlan | null>(null);
let saving = $state(false);

function startEdit() {
  if (!plan) return;
  editing = true;
  draft = JSON.parse(JSON.stringify(plan));
}

function cancelEdit() {
  editing = false;
  draft = null;
}

async function saveEdit() {
  if (!draft) return;
  saving = true;
  await commands.updateScenePlan(draft);
  saving = false;
  editing = false;
  draft = null;
}

function updateDraft(changes: Partial<ScenePlan>) {
  if (draft) draft = { ...draft, ...changes };
}
</script>

{#if !plan}
  <div class="atlas-empty">
    <p>Select a section from the sequencer to view its plan here.</p>
  </div>
{:else if editing && draft}
  <div class="scene-tab edit-card">
    <div class="atlas-fields">
      <div class="atlas-field">
        <span class="atlas-label">Title</span>
        <Input value={draft.title} oninput={(e) => updateDraft({ title: (e.target as HTMLInputElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Author Voice</span>
        {#if store.bible && store.bible.characters.length > 0}
          <select class="select" value={draft.povCharacterId} onchange={(e) => updateDraft({ povCharacterId: (e.target as HTMLSelectElement).value })}>
            <option value="">Select character...</option>
            {#each store.bible.characters as char (char.id)}
              <option value={char.id}>{char.name} ({char.role})</option>
            {/each}
          </select>
        {:else}
          <Input value={draft.povCharacterId} oninput={(e) => updateDraft({ povCharacterId: (e.target as HTMLInputElement).value })} />
        {/if}
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Perspective Distance</span>
        <RadioGroup name="editPovDistance" value={draft.povDistance} options={[
          { value: "intimate", label: "Intimate" },
          { value: "close", label: "Close" },
          { value: "moderate", label: "Moderate" },
          { value: "distant", label: "Distant" },
        ]} onchange={(v) => updateDraft({ povDistance: v as ScenePlan["povDistance"] })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Density</span>
        <RadioGroup name="editDensity" value={draft.density} options={[
          { value: "sparse", label: "Sparse" },
          { value: "moderate", label: "Moderate" },
          { value: "dense", label: "Dense" },
        ]} onchange={(v) => updateDraft({ density: v as ScenePlan["density"] })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Location</span>
        {#if store.bible && store.bible.locations.length > 0}
          <select class="select" value={draft.locationId ?? ""} onchange={(e) => updateDraft({ locationId: (e.target as HTMLSelectElement).value || null })}>
            <option value="">No location</option>
            {#each store.bible.locations as loc (loc.id)}
              <option value={loc.id}>{loc.name}</option>
            {/each}
          </select>
        {:else}
          <Input value={draft.locationId ?? ""} oninput={(e) => updateDraft({ locationId: (e.target as HTMLInputElement).value || null })} />
        {/if}
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Narrative Goal</span>
        <TextArea value={draft.narrativeGoal} variant="compact" rows={2} oninput={(e) => updateDraft({ narrativeGoal: (e.target as HTMLTextAreaElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Emotional Beat</span>
        <TextArea value={draft.emotionalBeat} variant="compact" rows={2} oninput={(e) => updateDraft({ emotionalBeat: (e.target as HTMLTextAreaElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Reader Effect</span>
        <TextArea value={draft.readerEffect} variant="compact" rows={2} oninput={(e) => updateDraft({ readerEffect: (e.target as HTMLTextAreaElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Failure Mode to Avoid</span>
        <TextArea value={draft.failureModeToAvoid} variant="compact" rows={2} oninput={(e) => updateDraft({ failureModeToAvoid: (e.target as HTMLTextAreaElement).value })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Pacing</span>
        <Input value={draft.pacing ?? ""} oninput={(e) => updateDraft({ pacing: (e.target as HTMLInputElement).value || null })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Sensory Notes</span>
        <TextArea value={draft.sensoryNotes ?? ""} variant="compact" rows={2} oninput={(e) => updateDraft({ sensoryNotes: (e.target as HTMLTextAreaElement).value || null })} />
      </div>

      <div class="atlas-field">
        <span class="atlas-label">Prohibitions</span>
        <TagInput tags={draft.sceneSpecificProhibitions} onchange={(v) => updateDraft({ sceneSpecificProhibitions: v })} placeholder="Add prohibition..." />
      </div>
    </div>

    <CollapsibleSection summary="Subtext" priority="helpful" sectionId={`atlas-scene-subtext-edit-${draft.id}`}>
      <div class="atlas-fields">
        <div class="atlas-field">
          <span class="atlas-label">Surface Conversation</span>
          <TextArea value={draft.subtext?.surfaceConversation ?? ""} variant="compact" rows={2} oninput={(e) => updateDraft({ subtext: { surfaceConversation: (e.target as HTMLTextAreaElement).value, actualConversation: draft!.subtext?.actualConversation ?? "", enforcementRule: draft!.subtext?.enforcementRule ?? "" } })} />
        </div>
        <div class="atlas-field">
          <span class="atlas-label">Actual Conversation</span>
          <TextArea value={draft.subtext?.actualConversation ?? ""} variant="compact" rows={2} oninput={(e) => updateDraft({ subtext: { surfaceConversation: draft!.subtext?.surfaceConversation ?? "", actualConversation: (e.target as HTMLTextAreaElement).value, enforcementRule: draft!.subtext?.enforcementRule ?? "" } })} />
        </div>
        <div class="atlas-field">
          <span class="atlas-label">Enforcement Rule</span>
          <TextArea value={draft.subtext?.enforcementRule ?? ""} variant="compact" rows={2} oninput={(e) => updateDraft({ subtext: { surfaceConversation: draft!.subtext?.surfaceConversation ?? "", actualConversation: draft!.subtext?.actualConversation ?? "", enforcementRule: (e.target as HTMLTextAreaElement).value } })} />
        </div>
      </div>
    </CollapsibleSection>

    <CollapsibleSection summary="Reader State" priority="helpful" sectionId={`atlas-scene-reader-edit-${draft.id}`}>
      <ReaderStateFields
        state={draft.readerStateEntering}
        label="Reader State Entering"
        onUpdate={(rs) => updateDraft({ readerStateEntering: rs })}
      />
      <ReaderStateFields
        state={draft.readerStateExiting}
        label="Reader State Exiting"
        onUpdate={(rs) => updateDraft({ readerStateExiting: rs })}
      />
    </CollapsibleSection>

    <CollapsibleSection summary="Structure" priority="helpful" sectionId={`atlas-scene-structure-edit-${draft.id}`}>
      <div class="atlas-fields">
        <div class="atlas-field">
          <span class="atlas-label">Estimated Word Count</span>
          <NumberRange value={draft.estimatedWordCount} onchange={(v) => updateDraft({ estimatedWordCount: v })} labels={["min", "max"]} />
        </div>
        <div class="atlas-field">
          <span class="atlas-label">Chunk Count</span>
          <Input type="number" value={String(draft.chunkCount)} oninput={(e) => updateDraft({ chunkCount: Number((e.target as HTMLInputElement).value) || 3 })} />
        </div>
        <div class="atlas-field">
          <span class="atlas-label">Chunk Descriptions</span>
          <TagInput tags={draft.chunkDescriptions} onchange={(v) => updateDraft({ chunkDescriptions: v })} placeholder="Add chunk description..." />
        </div>
      </div>
    </CollapsibleSection>

    <div class="edit-actions">
      <Button size="sm" onclick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      <Button size="sm" variant="ghost" onclick={cancelEdit} disabled={saving}>Cancel</Button>
    </div>
  </div>
{:else}
  <div class="scene-tab">
    <div class="scene-header">
      <h3 class="scene-title">{plan.title || "Untitled Section"}</h3>
      <button class="edit-btn" onclick={startEdit} title="Edit section plan">edit</button>
    </div>

    <div class="scene-meta">
      {#if povName}
        <Badge>Voice: {povName}</Badge>
      {:else if plan.povCharacterId}
        <Badge variant="warning">Voice: {plan.povCharacterId} (not in brief)</Badge>
      {/if}
      <Badge>{plan.povDistance}</Badge>
      <Badge>{plan.density}</Badge>
      {#if locationName}
        <Badge>@ {locationName}</Badge>
      {:else if plan.locationId}
        <Badge variant="warning">@ {plan.locationId} (not in brief)</Badge>
      {/if}
    </div>

    <div class="atlas-fields">
      {#if plan.narrativeGoal}
        <div class="atlas-field">
          <span class="atlas-label">Narrative Goal</span>
          <p class="atlas-value">{plan.narrativeGoal}</p>
        </div>
      {/if}
      {#if plan.emotionalBeat}
        <div class="atlas-field">
          <span class="atlas-label">Emotional Beat</span>
          <p class="atlas-value">{plan.emotionalBeat}</p>
        </div>
      {/if}
      {#if plan.readerEffect}
        <div class="atlas-field">
          <span class="atlas-label">Reader Effect</span>
          <p class="atlas-value">{plan.readerEffect}</p>
        </div>
      {/if}
      {#if plan.failureModeToAvoid}
        <div class="atlas-field">
          <span class="atlas-label">Failure Mode to Avoid</span>
          <p class="atlas-value">{plan.failureModeToAvoid}</p>
        </div>
      {/if}
      {#if plan.pacing}
        <div class="atlas-field">
          <span class="atlas-label">Pacing</span>
          <p class="atlas-value">{plan.pacing}</p>
        </div>
      {/if}
      {#if plan.sensoryNotes}
        <div class="atlas-field">
          <span class="atlas-label">Sensory Notes</span>
          <p class="atlas-value">{plan.sensoryNotes}</p>
        </div>
      {/if}
    </div>

    {#if plan.subtext}
      <CollapsibleSection summary="Subtext" priority="helpful" sectionId={`atlas-scene-subtext-${plan.id}`}>
        <div class="atlas-fields">
          <div class="atlas-field">
            <span class="atlas-label">Surface Conversation</span>
            <p class="atlas-value">{plan.subtext.surfaceConversation}</p>
          </div>
          <div class="atlas-field">
            <span class="atlas-label">Actual Conversation</span>
            <p class="atlas-value">{plan.subtext.actualConversation}</p>
          </div>
          <div class="atlas-field">
            <span class="atlas-label">Enforcement Rule</span>
            <p class="atlas-value">{plan.subtext.enforcementRule}</p>
          </div>
        </div>
      </CollapsibleSection>
    {/if}

    {#if hasReaderState(plan.readerStateEntering) || hasReaderState(plan.readerStateExiting)}
      <CollapsibleSection summary="Reader State" priority="helpful" sectionId={`atlas-scene-reader-${plan.id}`}>
        <div class="atlas-fields">
          {#if hasReaderState(plan.readerStateEntering)}
            <div class="reader-state-section">
              <span class="atlas-label">Entering</span>
              <ReaderStateCard state={plan.readerStateEntering} />
            </div>
          {/if}
          {#if hasReaderState(plan.readerStateExiting)}
            <div class="reader-state-section">
              <span class="atlas-label">Exiting</span>
              <ReaderStateCard state={plan.readerStateExiting} />
            </div>
          {/if}
        </div>
      </CollapsibleSection>
    {/if}

    <CollapsibleSection summary="Structure" priority="helpful" sectionId={`atlas-scene-structure-${plan.id}`}>
      <div class="atlas-fields">
        <div class="atlas-field">
          <span class="atlas-label">Estimated Words</span>
          <p class="atlas-value">{plan.estimatedWordCount[0]}–{plan.estimatedWordCount[1]}</p>
        </div>
        <div class="atlas-field">
          <span class="atlas-label">Chunks</span>
          <p class="atlas-value">{plan.chunkCount}</p>
        </div>
        {#if plan.chunkDescriptions.length > 0}
          <div class="atlas-field">
            <span class="atlas-label">Chunk Descriptions</span>
            <ol class="chunk-list">
              {#each plan.chunkDescriptions as desc, i (i)}
                <li class="chunk-item">{desc}</li>
              {/each}
            </ol>
          </div>
        {/if}
      </div>
    </CollapsibleSection>

    {#if plan.sceneSpecificProhibitions.length > 0}
      <div class="atlas-field" style="margin-top: 8px;">
        <span class="atlas-label">Prohibitions</span>
        <div class="atlas-pills">
          {#each plan.sceneSpecificProhibitions as p (p)}
            <span class="atlas-pill atlas-pill-warn">{p}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if plan.anchorLines.length > 0}
      <div class="atlas-field" style="margin-top: 8px;">
        <span class="atlas-label">Anchor Lines</span>
        {#each plan.anchorLines as anchor (anchor.text)}
          <div class="anchor-line">
            <blockquote class="anchor-text">"{anchor.text}"</blockquote>
            <span class="anchor-meta">{anchor.placement}{#if anchor.verbatim} · verbatim{/if}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .scene-tab { display: flex; flex-direction: column; gap: 4px; }
  .scene-header { display: flex; align-items: center; gap: 6px; }
  .scene-title { font-size: 13px; color: var(--text-primary); margin: 0 0 4px; font-weight: 500; flex: 1; }
  .scene-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
  .chunk-list { margin: 2px 0 0; padding-left: 18px; font-size: 11px; color: var(--text-primary); line-height: 1.6; }
  .chunk-item { margin-bottom: 2px; }
  .reader-state-section { display: flex; flex-direction: column; gap: 4px; }
  .anchor-line { margin-top: 4px; }
  .anchor-text {
    font-size: 11px; color: var(--text-secondary); font-style: italic;
    margin: 0; padding-left: 8px; border-left: 2px solid var(--border); line-height: 1.5;
  }
  .anchor-meta { font-size: 9px; color: var(--text-muted); margin-left: 10px; }
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
  .select {
    font-family: var(--font-mono); font-size: 11px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-primary); padding: 4px 8px; width: 100%;
  }
</style>
