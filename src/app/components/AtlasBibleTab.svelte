<script lang="ts">
import type { CharacterDossier, Location } from "../../types/index.js";
import { createEmptyCharacterDossier, createEmptyLocation } from "../../types/index.js";
import { Badge, Button, CollapsibleSection, TruncatedProse } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import CharacterCard from "./CharacterCard.svelte";
import CharacterFormFields from "./CharacterFormFields.svelte";
import LocationCard from "./LocationCard.svelte";
import LocationFormFields from "./LocationFormFields.svelte";

let {
  store,
  commands,
  onBootstrap,
  onAuthor,
}: {
  store: ProjectStore;
  commands: Commands;
  onBootstrap: () => void;
  onAuthor?: () => void;
} = $props();

let bible = $derived(store.bible);

// ─── Search / filter ─────────────────────────────
let searchQuery = $state("");
let query = $derived(searchQuery.trim().toLowerCase());

let filteredChars = $derived.by(() => {
  if (!bible || !query) return bible?.characters ?? [];
  return bible.characters.filter((c) => c.name.toLowerCase().includes(query) || c.role.toLowerCase().includes(query));
});

let filteredLocs = $derived.by(() => {
  if (!bible || !query) return bible?.locations ?? [];
  return bible.locations.filter((l) => l.name.toLowerCase().includes(query));
});

// ─── Expand / collapse all ───────────────────────
let charsRef = $state<ReturnType<typeof CollapsibleSection> | undefined>();
let locsRef = $state<ReturnType<typeof CollapsibleSection> | undefined>();
let styleRef = $state<ReturnType<typeof CollapsibleSection> | undefined>();
let narrativeRef = $state<ReturnType<typeof CollapsibleSection> | undefined>();

function expandAll() {
  charsRef?.setOpen(true);
  locsRef?.setOpen(true);
  styleRef?.setOpen(true);
  narrativeRef?.setOpen(true);
}

function collapseAll() {
  charsRef?.setOpen(false);
  locsRef?.setOpen(false);
  styleRef?.setOpen(false);
  narrativeRef?.setOpen(false);
}

// ─── Inline editing state ─────────────────────────
let editingCharId = $state<string | null>(null);
let editingLocId = $state<string | null>(null);
let charDraft = $state<CharacterDossier | null>(null);
let locDraft = $state<Location | null>(null);
let saving = $state(false);

function startEditChar(char: CharacterDossier) {
  editingCharId = char.id;
  charDraft = JSON.parse(JSON.stringify(char));
}

function cancelEditChar() {
  editingCharId = null;
  charDraft = null;
}

async function saveEditChar() {
  if (!bible || !charDraft) return;
  saving = true;
  const updated = {
    ...bible,
    characters: bible.characters.map((c) => (c.id === editingCharId ? charDraft! : c)),
  };
  await commands.saveBible(updated);
  saving = false;
  editingCharId = null;
  charDraft = null;
}

function updateCharDraft(changes: Partial<CharacterDossier>) {
  if (charDraft) charDraft = { ...charDraft, ...changes };
}

function updateLocDraft(changes: Partial<Location>) {
  if (locDraft) locDraft = { ...locDraft, ...changes };
}

function startEditLoc(loc: Location) {
  editingLocId = loc.id;
  locDraft = JSON.parse(JSON.stringify(loc));
}

function cancelEditLoc() {
  editingLocId = null;
  locDraft = null;
}

async function saveEditLoc() {
  if (!bible || !locDraft) return;
  saving = true;
  const updated = {
    ...bible,
    locations: bible.locations.map((l) => (l.id === editingLocId ? locDraft! : l)),
  };
  await commands.saveBible(updated);
  saving = false;
  editingLocId = null;
  locDraft = null;
}

// ─── Add new entities ────────────────────────────
async function addCharacter() {
  if (!bible) return;
  const newChar = createEmptyCharacterDossier("New Character");
  const updated = { ...bible, characters: [...bible.characters, newChar] };
  saving = true;
  await commands.saveBible(updated);
  saving = false;
  startEditChar(newChar);
}

async function addLocation() {
  if (!bible) return;
  const newLoc = createEmptyLocation("New Location");
  const updated = { ...bible, locations: [...bible.locations, newLoc] };
  saving = true;
  await commands.saveBible(updated);
  saving = false;
  startEditLoc(newLoc);
}

// Style Guide summary badge
let styleBadge = $derived.by(() => {
  if (!bible) return "";
  const sg = bible.styleGuide;
  const bans = sg.killList.length;
  const domains =
    (sg.metaphoricRegister?.approvedDomains.length ?? 0) + (sg.metaphoricRegister?.prohibitedDomains.length ?? 0);
  const prefs = sg.vocabularyPreferences.length;
  const parts: string[] = [];
  if (bans > 0) parts.push(`${bans} ban${bans !== 1 ? "s" : ""}`);
  if (domains > 0) parts.push(`${domains} domain${domains !== 1 ? "s" : ""}`);
  if (prefs > 0) parts.push(`${prefs} pref${prefs !== 1 ? "s" : ""}`);
  return parts.join(" · ") || undefined;
});

// Narrative Rules summary badge
let narrativeBadge = $derived.by(() => {
  if (!bible) return "";
  const nr = bible.narrativeRules;
  return [nr.pov.default, nr.pov.interiority, nr.pov.reliability].join(" · ");
});

function hasStyleData(): boolean {
  if (!bible) return false;
  const sg = bible.styleGuide;
  return !!(
    sg.killList.length > 0 ||
    sg.metaphoricRegister ||
    sg.vocabularyPreferences.length > 0 ||
    sg.structuralBans.length > 0 ||
    sg.sentenceArchitecture ||
    sg.paragraphPolicy ||
    sg.negativeExemplars.length > 0 ||
    sg.positiveExemplars.length > 0
  );
}

function hasNarrativeData(): boolean {
  if (!bible) return false;
  const nr = bible.narrativeRules;
  return !!(nr.pov || nr.subtextPolicy || nr.expositionPolicy || nr.sceneEndingPolicy || nr.setups.length > 0);
}
</script>

{#if !bible}
  <div class="atlas-empty">
    <p>No essay brief yet.</p>
    <div class="atlas-empty-actions">
      {#if onAuthor}
        <Button onclick={onAuthor}>Create Brief</Button>
      {/if}
      <Button onclick={onBootstrap}>Bootstrap from Description</Button>
    </div>
  </div>
{:else}
  <div class="bible-tab">
    <div class="bible-toolbar">
      {#if bible.characters.length + bible.locations.length > 3}
        <div class="search-bar">
          <input
            class="search-input"
            type="text"
            placeholder="Filter entries..."
            bind:value={searchQuery}
          />
          {#if query}
            <button class="search-clear" onclick={() => (searchQuery = "")}>x</button>
          {/if}
        </div>
      {/if}
      <div class="fold-btns">
        <button class="fold-btn" onclick={expandAll} title="Expand all sections">+</button>
        <button class="fold-btn" onclick={collapseAll} title="Collapse all sections">&minus;</button>
      </div>
    </div>

    <CollapsibleSection bind:this={charsRef} summary="Author Voice" priority="essential" sectionId="atlas-bible-characters" badge={query ? `${filteredChars.length}/${bible.characters.length}` : `${bible.characters.length}`}>
      {#each filteredChars as char (char.id)}
        {#if editingCharId === char.id && charDraft}
          <div class="edit-card">
            <CharacterFormFields character={charDraft} onUpdate={updateCharDraft} />
            <div class="edit-actions">
              <Button size="sm" onclick={saveEditChar} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button size="sm" variant="ghost" onclick={cancelEditChar} disabled={saving}>Cancel</Button>
            </div>
          </div>
        {:else}
          <div class="card-with-edit">
            <CharacterCard character={char} />
            {#if editingCharId === null}
              <button class="edit-btn" onclick={() => startEditChar(char)} title="Edit character">edit</button>
            {/if}
          </div>
        {/if}
      {/each}
      {#if editingCharId === null}
        <button class="add-entity-btn" onclick={addCharacter} disabled={saving}>+ Add Voice Profile</button>
      {/if}
    </CollapsibleSection>

    <CollapsibleSection bind:this={locsRef} summary="Locations" priority="essential" sectionId="atlas-bible-locations" badge={query ? `${filteredLocs.length}/${bible.locations.length}` : `${bible.locations.length}`}>
      {#each filteredLocs as loc (loc.id)}
        {#if editingLocId === loc.id && locDraft}
          <div class="edit-card">
            <LocationFormFields location={locDraft} onUpdate={updateLocDraft} />
            <div class="edit-actions">
              <Button size="sm" onclick={saveEditLoc} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button size="sm" variant="ghost" onclick={cancelEditLoc} disabled={saving}>Cancel</Button>
            </div>
          </div>
        {:else}
          <div class="card-with-edit">
            <LocationCard location={loc} />
            {#if editingLocId === null}
              <button class="edit-btn" onclick={() => startEditLoc(loc)} title="Edit location">edit</button>
            {/if}
          </div>
        {/if}
      {/each}
      {#if editingLocId === null}
        <button class="add-entity-btn" onclick={addLocation} disabled={saving}>+ Add Location</button>
      {/if}
    </CollapsibleSection>

    {#if query && filteredChars.length === 0 && filteredLocs.length === 0}
      <div class="search-empty">No characters or locations matching "{searchQuery.trim()}"</div>
    {/if}

    {#if hasStyleData()}
      <CollapsibleSection bind:this={styleRef} summary="Style Guide" priority="helpful" sectionId="atlas-bible-style" badge={styleBadge}>
        <div class="atlas-fields">
          {#if bible.styleGuide.killList.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Kill List</span>
              <ul class="kill-list">
                {#each bible.styleGuide.killList as entry (entry.pattern)}
                  {@const parts = entry.pattern.split(/\s*[—–]\s*/)}
                  <li class="kill-entry">
                    <div class="kill-main">
                      <span class="kill-pattern">{parts[0]}</span>
                      <span class="kill-type">{entry.type === "structural" ? "struct" : entry.type}</span>
                    </div>
                    {#if parts.length > 1}
                      <span class="kill-annotation">{parts.slice(1).join(" — ")}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if bible.styleGuide.metaphoricRegister}
            {#if bible.styleGuide.metaphoricRegister.approvedDomains.length > 0}
              <div class="atlas-field">
                <span class="atlas-label">Approved Metaphoric Domains</span>
                <div class="atlas-pills">
                  {#each bible.styleGuide.metaphoricRegister.approvedDomains as d (d)}
                    <span class="atlas-pill">{d}</span>
                  {/each}
                </div>
              </div>
            {/if}
            {#if bible.styleGuide.metaphoricRegister.prohibitedDomains.length > 0}
              <div class="atlas-field">
                <span class="atlas-label">Prohibited Metaphoric Domains</span>
                <div class="atlas-pills">
                  {#each bible.styleGuide.metaphoricRegister.prohibitedDomains as d (d)}
                    <span class="atlas-pill atlas-pill-warn">{d}</span>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}

          {#if bible.styleGuide.vocabularyPreferences.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Vocabulary Preferences</span>
              <div class="vocab-pairs">
                {#each bible.styleGuide.vocabularyPreferences as pref (pref.preferred)}
                  <div class="vocab-pair">
                    <span class="vocab-preferred">{pref.preferred}</span>
                    <span class="vocab-arrow">instead of</span>
                    <span class="vocab-instead">{pref.insteadOf}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if bible.styleGuide.structuralBans.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Structural Bans</span>
              <div class="atlas-pills">
                {#each bible.styleGuide.structuralBans as ban (ban)}
                  <span class="atlas-pill atlas-pill-warn">{ban}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if bible.styleGuide.sentenceArchitecture}
            <div class="atlas-field">
              <span class="atlas-label">Sentence Architecture</span>
              {#if bible.styleGuide.sentenceArchitecture.targetVariance}
                <p class="atlas-value">Variance: {bible.styleGuide.sentenceArchitecture.targetVariance}</p>
              {/if}
              {#if bible.styleGuide.sentenceArchitecture.fragmentPolicy}
                <p class="atlas-value">Fragments: {bible.styleGuide.sentenceArchitecture.fragmentPolicy}</p>
              {/if}
              {#if bible.styleGuide.sentenceArchitecture.notes}
                <p class="atlas-value">{bible.styleGuide.sentenceArchitecture.notes}</p>
              {/if}
            </div>
          {/if}

          {#if bible.styleGuide.paragraphPolicy}
            <div class="atlas-field">
              <span class="atlas-label">Paragraph Policy</span>
              {#if bible.styleGuide.paragraphPolicy.maxSentences}
                <p class="atlas-value">Max sentences: {bible.styleGuide.paragraphPolicy.maxSentences}</p>
              {/if}
              {#if bible.styleGuide.paragraphPolicy.singleSentenceFrequency}
                <p class="atlas-value">Single-sentence: {bible.styleGuide.paragraphPolicy.singleSentenceFrequency}</p>
              {/if}
              {#if bible.styleGuide.paragraphPolicy.notes}
                <p class="atlas-value">{bible.styleGuide.paragraphPolicy.notes}</p>
              {/if}
            </div>
          {/if}

          {#if bible.styleGuide.positiveExemplars.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Positive Exemplars</span>
              {#each bible.styleGuide.positiveExemplars as ex (ex.text)}
                <blockquote class="exemplar">
                  <p class="exemplar-text">"{ex.text}"</p>
                  <p class="exemplar-annotation">{ex.annotation}{#if ex.source} — {ex.source}{/if}</p>
                </blockquote>
              {/each}
            </div>
          {/if}

          {#if bible.styleGuide.negativeExemplars.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Negative Exemplars</span>
              {#each bible.styleGuide.negativeExemplars as ex (ex.text)}
                <blockquote class="exemplar exemplar-negative">
                  <p class="exemplar-text">"{ex.text}"</p>
                  <p class="exemplar-annotation">{ex.annotation}{#if ex.source} — {ex.source}{/if}</p>
                </blockquote>
              {/each}
            </div>
          {/if}
        </div>
      </CollapsibleSection>
    {/if}

    {#if hasNarrativeData()}
      <CollapsibleSection bind:this={narrativeRef} summary="Narrative Rules" priority="helpful" sectionId="atlas-bible-narrative" badge={narrativeBadge}>
        <div class="atlas-fields">
          <div class="atlas-field">
            <span class="atlas-label">POV</span>
            <div class="pov-line">
              <Badge>{bible.narrativeRules.pov.default}</Badge>
              <Badge>{bible.narrativeRules.pov.distance}</Badge>
              <Badge>{bible.narrativeRules.pov.interiority}</Badge>
              <Badge>{bible.narrativeRules.pov.reliability}</Badge>
            </div>
            {#if bible.narrativeRules.pov.notes}
              <div class="atlas-value"><TruncatedProse text={bible.narrativeRules.pov.notes} /></div>
            {/if}
          </div>

          {#if bible.narrativeRules.subtextPolicy}
            <div class="atlas-field">
              <span class="atlas-label">Subtext Policy</span>
              <div class="atlas-value"><TruncatedProse text={bible.narrativeRules.subtextPolicy} /></div>
            </div>
          {/if}

          {#if bible.narrativeRules.expositionPolicy}
            <div class="atlas-field">
              <span class="atlas-label">Exposition Policy</span>
              <div class="atlas-value"><TruncatedProse text={bible.narrativeRules.expositionPolicy} /></div>
            </div>
          {/if}

          {#if bible.narrativeRules.sceneEndingPolicy}
            <div class="atlas-field">
              <span class="atlas-label">Section Ending Policy</span>
              <div class="atlas-value"><TruncatedProse text={bible.narrativeRules.sceneEndingPolicy} /></div>
            </div>
          {/if}

          {#if bible.narrativeRules.setups.length > 0}
            <div class="atlas-field">
              <span class="atlas-label">Setups & Payoffs</span>
              {#each bible.narrativeRules.setups as setup (setup.id)}
                <div class="setup-entry">
                  <span class="setup-desc">{setup.description}</span>
                  <Badge variant={setup.status === "paid-off" ? "accepted" : setup.status === "dangling" ? "warning" : "default"}>{setup.status}</Badge>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </CollapsibleSection>
    {/if}
  </div>
{/if}

<style>
  .atlas-empty-actions { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
  .bible-tab { display: flex; flex-direction: column; gap: 4px; }
  .bible-toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 2px; }
  .search-bar { position: relative; flex: 1; }
  .search-input {
    width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-size: 11px;
    background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-primary); padding: 4px 24px 4px 8px;
  }
  .search-input::placeholder { color: var(--text-muted); }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .search-clear {
    position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 10px; padding: 2px 4px; line-height: 1;
  }
  .search-clear:hover { color: var(--text-primary); }
  .search-empty { text-align: center; font-size: 10px; color: var(--text-muted); padding: 12px 0; }
  .fold-btns { display: flex; gap: 2px; flex-shrink: 0; }
  .fold-btn {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-muted); font-size: 11px; width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    line-height: 1; padding: 0;
  }
  .fold-btn:hover { color: var(--accent); border-color: var(--accent); }
  .kill-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .kill-entry {
    padding: 4px 8px; border-left: 2px solid color-mix(in srgb, var(--warning) 40%, transparent);
    background: color-mix(in srgb, var(--warning) 4%, transparent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  .kill-main { display: flex; align-items: baseline; gap: 6px; }
  .kill-pattern { font-size: 11px; color: var(--warning); flex: 1; line-height: 1.4; }
  .kill-type {
    font-size: 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    background: var(--bg-secondary); padding: 1px 4px; border-radius: var(--radius-sm);
    flex-shrink: 0;
  }
  .kill-annotation { font-size: 10px; color: var(--text-muted); line-height: 1.4; margin-top: 2px; display: block; }
  .vocab-pairs { display: flex; flex-direction: column; gap: 2px; }
  .vocab-pair { font-size: 11px; display: flex; align-items: center; gap: 4px; }
  .vocab-preferred { color: var(--text-primary); font-weight: 500; }
  .vocab-arrow { color: var(--text-muted); font-size: 9px; }
  .vocab-instead { color: var(--text-muted); text-decoration: line-through; }
  .pov-line { display: flex; gap: 4px; flex-wrap: wrap; }
  .exemplar {
    margin: 4px 0; padding: 4px 8px; border-left: 2px solid var(--border);
    font-size: 11px; line-height: 1.5;
  }
  .exemplar-negative { border-left-color: var(--warning); }
  .exemplar-text { color: var(--text-secondary); font-style: italic; margin: 0; }
  .exemplar-annotation { color: var(--text-muted); font-size: 10px; margin: 2px 0 0; }
  .setup-entry { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 4px; }
  .setup-desc { color: var(--text-primary); flex: 1; }
  .card-with-edit { position: relative; }
  .edit-btn {
    position: absolute; top: 2px; right: 2px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-muted); font-size: 9px; padding: 1px 6px; cursor: pointer;
  }
  .edit-btn:hover { color: var(--accent); border-color: var(--accent); }
  .edit-card {
    border: 1px solid var(--accent-dim, var(--accent)); border-radius: var(--radius-sm);
    padding: 8px; background: color-mix(in srgb, var(--accent) 3%, transparent);
  }
  .edit-actions { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; }
  .add-entity-btn {
    width: 100%; padding: 6px; margin-top: 4px;
    background: var(--bg-secondary); border: 1px dashed var(--border); border-radius: var(--radius-sm);
    color: var(--text-muted); font-size: 10px; cursor: pointer; font-family: var(--font-mono);
  }
  .add-entity-btn:hover { color: var(--accent); border-color: var(--accent); }
  .add-entity-btn:disabled { opacity: 0.5; cursor: default; }
</style>
