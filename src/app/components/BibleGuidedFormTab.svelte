<script lang="ts">
import { applyGenreTemplate, GENRE_TEMPLATES } from "../../bootstrap/genres.js";
import type { Bible, CharacterDossier, Location } from "../../types/index.js";
import { createEmptyBible, createEmptyCharacterDossier, generateId } from "../../types/index.js";
import {
  Button,
  CardList,
  CollapsibleSection,
  ExamplesDrawer,
  FormField,
  Input,
  RadioGroup,
  Select,
  Stepper,
  TagInput,
} from "../primitives/index.js";
import CharacterFormFields from "./CharacterFormFields.svelte";
import { getExamples } from "./field-examples.js";
import LocationFormFields from "./LocationFormFields.svelte";

export type FormFooterState = {
  currentStep: string;
  isFirstStep: boolean;
  isLastStep: boolean;
};

let {
  initialBible,
  open,
  onSave,
  footerState = $bindable({ currentStep: "foundations", isFirstStep: true, isLastStep: false }),
}: {
  initialBible: Bible;
  open: boolean;
  onSave: (bible: Bible) => Promise<void>;
  footerState?: FormFooterState;
} = $props();

const stepDefs = [
  { id: "foundations", label: "Foundations" },
  { id: "characters", label: "Author Voice" },
  { id: "locations", label: "Locations" },
  { id: "style", label: "Style Guide" },
  { id: "review", label: "Review" },
];

let currentStep = $state("foundations");
let completedSteps = $state<string[]>([]);
let bible = $state<Bible>(createEmptyBible(""));
let formBodyEl: HTMLDivElement | undefined = $state();

$effect(() => {
  if (open) {
    bible = $state.snapshot(initialBible);
    currentStep = "foundations";
    completedSteps = [];
  }
});

$effect(() => {
  const idx = stepDefs.findIndex((s) => s.id === currentStep);
  footerState = {
    currentStep,
    isFirstStep: idx === 0,
    isLastStep: idx === stepDefs.length - 1,
  };
});

// ─── Form navigation ────────────────────────────
function goToStep(stepId: string) {
  const currentIdx = stepDefs.findIndex((s) => s.id === currentStep);
  const targetIdx = stepDefs.findIndex((s) => s.id === stepId);
  if (targetIdx > currentIdx && !completedSteps.includes(currentStep)) {
    completedSteps = [...completedSteps, currentStep];
  }
  currentStep = stepId;
}

export function next() {
  const idx = stepDefs.findIndex((s) => s.id === currentStep);
  if (idx < stepDefs.length - 1) {
    goToStep(stepDefs[idx + 1]!.id);
  }
}

export function prev() {
  const idx = stepDefs.findIndex((s) => s.id === currentStep);
  if (idx > 0) {
    currentStep = stepDefs[idx - 1]!.id;
  }
}

export async function save() {
  await onSave(bible);
}

// ─── Expand / Collapse all ─────────────────────
function setAllSections(open: boolean) {
  formBodyEl?.querySelectorAll("details.collapsible").forEach((d) => {
    const details = d as HTMLDetailsElement;
    if (details.open !== open) {
      details.open = open;
      details.dispatchEvent(new Event("toggle"));
    }
  });
}

function onFormKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "e") {
    e.preventDefault();
    if (e.shiftKey) setAllSections(false);
    else setAllSections(true);
  }
}

// ─── Character helpers ──────────────────────────
function addCharacter() {
  bible = {
    ...bible,
    characters: [...bible.characters, createEmptyCharacterDossier("")],
  };
}

function removeCharacter(index: number) {
  bible = { ...bible, characters: bible.characters.filter((_, i) => i !== index) };
}

function updateCharacter(index: number, changes: Partial<CharacterDossier>) {
  bible = {
    ...bible,
    characters: bible.characters.map((c, i) => (i === index ? { ...c, ...changes } : c)),
  };
}

// ─── Location helpers ───────────────────────────
function addLocation() {
  const loc: Location = {
    id: generateId(),
    name: "",
    description: null,
    sensoryPalette: {
      sounds: [],
      smells: [],
      textures: [],
      lightQuality: null,
      atmosphere: null,
      prohibitedDefaults: [],
    },
  };
  bible = { ...bible, locations: [...bible.locations, loc] };
}

function removeLocation(index: number) {
  bible = { ...bible, locations: bible.locations.filter((_, i) => i !== index) };
}

function updateLocation(index: number, changes: Partial<Location>) {
  bible = {
    ...bible,
    locations: bible.locations.map((l, i) => (i === index ? { ...l, ...changes } : l)),
  };
}

// ─── Style helpers ──────────────────────────────
function addKillEntry() {
  bible = {
    ...bible,
    styleGuide: {
      ...bible.styleGuide,
      killList: [...bible.styleGuide.killList, { pattern: "", type: "exact" }],
    },
  };
}

function removeKillEntry(index: number) {
  bible = {
    ...bible,
    styleGuide: {
      ...bible.styleGuide,
      killList: bible.styleGuide.killList.filter((_, i) => i !== index),
    },
  };
}

function addVocabPref() {
  bible = {
    ...bible,
    styleGuide: {
      ...bible.styleGuide,
      vocabularyPreferences: [...bible.styleGuide.vocabularyPreferences, { preferred: "", insteadOf: "" }],
    },
  };
}

function removeVocabPref(index: number) {
  bible = {
    ...bible,
    styleGuide: {
      ...bible.styleGuide,
      vocabularyPreferences: bible.styleGuide.vocabularyPreferences.filter((_, i) => i !== index),
    },
  };
}
</script>

<div class="genre-selector">
  <FormField label="Genre Template">
    <Select
      value=""
      onchange={(e) => {
        const id = (e.target as HTMLSelectElement).value;
        const tmpl = GENRE_TEMPLATES.find((t) => t.id === id);
        if (tmpl) bible = applyGenreTemplate(bible, tmpl);
      }}
    >
      <option value="" disabled>Select a genre to pre-fill defaults...</option>
      {#each GENRE_TEMPLATES as tmpl (tmpl.id)}
        <option value={tmpl.id}>{tmpl.name} — {tmpl.description}</option>
      {/each}
    </Select>
  </FormField>
</div>
<Stepper steps={stepDefs} {currentStep} {completedSteps} onStepClick={goToStep} />

{#if currentStep !== "review"}
  <div class="step-controls">
    <Button variant="ghost" size="sm" onclick={() => setAllSections(true)}>Expand All</Button>
    <Button variant="ghost" size="sm" onclick={() => setAllSections(false)}>Collapse All</Button>
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="form-body" bind:this={formBodyEl} onkeydown={onFormKeydown}>
  {#if currentStep === "foundations"}
    <div class="form-step">
      <FormField label="POV Default" fieldId="povDefault">
        <RadioGroup name="povDefault" value={bible.narrativeRules.pov.default} options={[
          { value: "first", label: "First" },
          { value: "close-third", label: "Close Third" },
          { value: "distant-third", label: "Distant Third" },
          { value: "omniscient", label: "Omniscient" },
        ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, default: v as any } } }; }} />
      </FormField>

      <CollapsibleSection summary="POV Fine-Tuning" priority="helpful" sectionId="bible-foundations-povTuning">
        <div class="form-step">
          <FormField label="POV Distance" fieldId="povDistance">
            <RadioGroup name="povDist" value={bible.narrativeRules.pov.distance} options={[
              { value: "intimate", label: "Intimate" },
              { value: "close", label: "Close" },
              { value: "moderate", label: "Moderate" },
              { value: "distant", label: "Distant" },
            ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, distance: v as any } } }; }} />
          </FormField>
          <FormField label="POV Interiority" fieldId="povInteriority">
            <RadioGroup name="povInt" value={bible.narrativeRules.pov.interiority} options={[
              { value: "stream", label: "Stream" },
              { value: "filtered", label: "Filtered" },
              { value: "behavioral-only", label: "Behavioral Only" },
            ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, interiority: v as any } } }; }} />
          </FormField>
          <FormField label="POV Reliability" fieldId="povReliability">
            <RadioGroup name="povRel" value={bible.narrativeRules.pov.reliability} options={[
              { value: "reliable", label: "Reliable" },
              { value: "unreliable", label: "Unreliable" },
            ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, reliability: v as any } } }; }} />
          </FormField>
        </div>
      </CollapsibleSection>
    </div>

  {:else if currentStep === "characters"}
    <CardList
      items={bible.characters}
      addLabel="Add Voice Profile"
      emptyMessage="No author voice yet. Add one to get started."
      onAdd={addCharacter}
      onRemove={removeCharacter}
    >
      {#snippet renderItem(char, i)}
        <CharacterFormFields character={char} onUpdate={(changes) => updateCharacter(i, changes)} />
      {/snippet}
    </CardList>

  {:else if currentStep === "locations"}
    <CardList
      items={bible.locations}
      addLabel="Add Location"
      emptyMessage="No locations yet. Add one to get started."
      onAdd={addLocation}
      onRemove={removeLocation}
    >
      {#snippet renderItem(loc, i)}
        <LocationFormFields location={loc} onUpdate={(changes) => updateLocation(i, changes)} />
      {/snippet}
    </CardList>

  {:else if currentStep === "style"}
    <div class="form-step">
      <CollapsibleSection summary="Avoid List" priority="essential" sectionId="bible-style-avoidList">
        <ExamplesDrawer fieldId="killList" examples={getExamples("killList")} />
        <CardList
          items={bible.styleGuide.killList}
          addLabel="Add Entry"
          emptyMessage="No avoid list entries."
          onAdd={addKillEntry}
          onRemove={removeKillEntry}
        >
          {#snippet renderItem(entry, i)}
            <div class="kill-row">
              <Input value={entry.pattern} oninput={(e) => {
                const updated = [...bible.styleGuide.killList];
                updated[i] = { ...entry, pattern: (e.target as HTMLInputElement).value };
                bible = { ...bible, styleGuide: { ...bible.styleGuide, killList: updated } };
              }} placeholder="Banned phrase or pattern" />
              <RadioGroup name={`killType${i}`} value={entry.type} options={[
                { value: "exact", label: "Exact" },
                { value: "structural", label: "Structural" },
              ]} onchange={(v) => {
                const updated = [...bible.styleGuide.killList];
                updated[i] = { ...entry, type: v as "exact" | "structural" };
                bible = { ...bible, styleGuide: { ...bible.styleGuide, killList: updated } };
              }} />
            </div>
          {/snippet}
        </CardList>
      </CollapsibleSection>

      <CollapsibleSection summary="Metaphor Control" priority="helpful" sectionId="bible-style-metaphors">
        <div class="form-step">
          <FormField label="Approved Metaphoric Domains" fieldId="approvedMetaphoricDomains">
            <TagInput
              tags={bible.styleGuide.metaphoricRegister?.approvedDomains ?? []}
              onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, metaphoricRegister: { approvedDomains: v, prohibitedDomains: bible.styleGuide.metaphoricRegister?.prohibitedDomains ?? [] } } }; }}
              placeholder="e.g. machinery, water, decay..."
            />
            <ExamplesDrawer fieldId="approvedMetaphoricDomains" examples={getExamples("approvedMetaphoricDomains")} />
          </FormField>
          <FormField label="Prohibited Metaphoric Domains" fieldId="prohibitedMetaphoricDomains">
            <TagInput
              tags={bible.styleGuide.metaphoricRegister?.prohibitedDomains ?? []}
              onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, metaphoricRegister: { approvedDomains: bible.styleGuide.metaphoricRegister?.approvedDomains ?? [], prohibitedDomains: v } } }; }}
              placeholder="e.g. flowers, sunshine..."
            />
          </FormField>
        </div>
      </CollapsibleSection>

      <CollapsibleSection summary="Vocabulary Preferences" priority="advanced" sectionId="bible-style-vocabPrefs">
        <CardList
          items={bible.styleGuide.vocabularyPreferences}
          addLabel="Add Preference"
          emptyMessage="No vocabulary preferences."
          onAdd={addVocabPref}
          onRemove={removeVocabPref}
        >
          {#snippet renderItem(pref, i)}
            <div class="vocab-row">
              <Input value={pref.preferred} oninput={(e) => {
                const updated = [...bible.styleGuide.vocabularyPreferences];
                updated[i] = { ...pref, preferred: (e.target as HTMLInputElement).value };
                bible = { ...bible, styleGuide: { ...bible.styleGuide, vocabularyPreferences: updated } };
              }} placeholder="Preferred term" />
              <span class="vocab-arrow">instead of</span>
              <Input value={pref.insteadOf} oninput={(e) => {
                const updated = [...bible.styleGuide.vocabularyPreferences];
                updated[i] = { ...pref, insteadOf: (e.target as HTMLInputElement).value };
                bible = { ...bible, styleGuide: { ...bible.styleGuide, vocabularyPreferences: updated } };
              }} placeholder="Avoid this term" />
            </div>
          {/snippet}
        </CardList>
      </CollapsibleSection>

      <CollapsibleSection summary="Structural Bans" priority="advanced" sectionId="bible-style-structuralBans">
        <div class="form-step">
          <FormField label="Structural Bans" fieldId="structuralBans">
            <TagInput
              tags={bible.styleGuide.structuralBans}
              onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, structuralBans: v } }; }}
              placeholder="e.g. rhetorical questions, em-dash fragments..."
            />
          </FormField>
        </div>
      </CollapsibleSection>
    </div>

  {:else if currentStep === "review"}
    <div class="form-step">
      <div class="review-summary">
        <div class="review-stat">Characters: {bible.characters.length}</div>
        <div class="review-stat">Locations: {bible.locations.length}</div>
        <div class="review-stat">Avoid List: {bible.styleGuide.killList.length} entries</div>
        <div class="review-stat">POV: {bible.narrativeRules.pov.default} / {bible.narrativeRules.pov.distance}</div>
      </div>
      <pre class="json-preview">{JSON.stringify(bible, null, 2)}</pre>
    </div>
  {/if}
</div>

<style>
  .genre-selector { margin-bottom: 8px; }
  .step-controls {
    display: flex;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }
  .form-body { padding: 8px 0; }
  .form-step { display: flex; flex-direction: column; gap: 10px; }
  .kill-row { display: flex; flex-direction: column; gap: 4px; }
  .vocab-row { display: flex; align-items: center; gap: 6px; }
  .vocab-arrow { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
  .review-summary {
    display: flex; gap: 16px; padding: 8px; background: var(--bg-secondary);
    border-radius: var(--radius-md); margin-bottom: 8px;
  }
  .review-stat { font-size: 11px; color: var(--text-secondary); }
  .json-preview {
    font-family: var(--font-mono); font-size: 10px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px;
    overflow: auto; max-height: 400px; white-space: pre-wrap; color: var(--text-primary);
  }
</style>
