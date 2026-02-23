<script lang="ts">
import { applyGenreTemplate, GENRE_TEMPLATES } from "../../bootstrap/genres.js";
import type { Bible, CharacterDossier, Location } from "../../types/index.js";
import { createEmptyBible, createEmptyCharacterDossier, generateId } from "../../types/index.js";
import {
  CardList,
  CollapsibleSection,
  FormField,
  Input,
  NumberRange,
  RadioGroup,
  Select,
  Stepper,
  TagInput,
  TextArea,
} from "../primitives/index.js";

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
  { id: "characters", label: "Characters" },
  { id: "locations", label: "Locations" },
  { id: "style", label: "Style Guide" },
  { id: "review", label: "Review" },
];

let currentStep = $state("foundations");
let completedSteps = $state<string[]>([]);
let bible = $state<Bible>(createEmptyBible(""));

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

<div class="form-body">
  {#if currentStep === "foundations"}
    <div class="form-step">
      <FormField label="POV Default">
        <RadioGroup name="povDefault" value={bible.narrativeRules.pov.default} options={[
          { value: "first", label: "First" },
          { value: "close-third", label: "Close Third" },
          { value: "distant-third", label: "Distant Third" },
          { value: "omniscient", label: "Omniscient" },
        ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, default: v as any } } }; }} />
      </FormField>
      <FormField label="POV Distance">
        <RadioGroup name="povDist" value={bible.narrativeRules.pov.distance} options={[
          { value: "intimate", label: "Intimate" },
          { value: "close", label: "Close" },
          { value: "moderate", label: "Moderate" },
          { value: "distant", label: "Distant" },
        ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, distance: v as any } } }; }} />
      </FormField>
      <FormField label="POV Interiority">
        <RadioGroup name="povInt" value={bible.narrativeRules.pov.interiority} options={[
          { value: "stream", label: "Stream" },
          { value: "filtered", label: "Filtered" },
          { value: "behavioral-only", label: "Behavioral Only" },
        ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, interiority: v as any } } }; }} />
      </FormField>
      <FormField label="POV Reliability">
        <RadioGroup name="povRel" value={bible.narrativeRules.pov.reliability} options={[
          { value: "reliable", label: "Reliable" },
          { value: "unreliable", label: "Unreliable" },
        ]} onchange={(v) => { bible = { ...bible, narrativeRules: { ...bible.narrativeRules, pov: { ...bible.narrativeRules.pov, reliability: v as any } } }; }} />
      </FormField>
    </div>

  {:else if currentStep === "characters"}
    <CardList
      items={bible.characters}
      addLabel="Add Character"
      emptyMessage="No characters yet. Add one to get started."
      onAdd={addCharacter}
      onRemove={removeCharacter}
    >
      {#snippet renderItem(char, i)}
        <div class="char-card">
          <FormField label="Name" required>
            <Input value={char.name} oninput={(e) => updateCharacter(i, { name: (e.target as HTMLInputElement).value })} placeholder="Character name" />
          </FormField>
          <FormField label="Role">
            <RadioGroup name={`charRole${i}`} value={char.role} options={[
              { value: "protagonist", label: "Protagonist" },
              { value: "antagonist", label: "Antagonist" },
              { value: "supporting", label: "Supporting" },
              { value: "minor", label: "Minor" },
            ]} onchange={(v) => updateCharacter(i, { role: v as any })} />
          </FormField>
          <FormField label="Physical Description">
            <TextArea value={char.physicalDescription ?? ""} variant="compact" rows={2} oninput={(e) => updateCharacter(i, { physicalDescription: (e.target as HTMLTextAreaElement).value || null })} placeholder="What does the reader SEE?" />
          </FormField>
          <FormField label="Backstory">
            <TextArea value={char.backstory ?? ""} variant="compact" rows={2} oninput={(e) => updateCharacter(i, { backstory: (e.target as HTMLTextAreaElement).value || null })} placeholder="Brief but specific" />
          </FormField>

          <CollapsibleSection summary="Voice">
            <div class="char-section">
              <FormField label="Vocabulary Notes">
                <TextArea value={char.voice.vocabularyNotes ?? ""} variant="compact" rows={2} oninput={(e) => updateCharacter(i, { voice: { ...char.voice, vocabularyNotes: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
              <FormField label="Verbal Tics">
                <TagInput tags={char.voice.verbalTics} onchange={(v) => updateCharacter(i, { voice: { ...char.voice, verbalTics: v } })} placeholder="um, you know..." />
              </FormField>
              <FormField label="Metaphoric Register">
                <Input value={char.voice.metaphoricRegister ?? ""} oninput={(e) => updateCharacter(i, { voice: { ...char.voice, metaphoricRegister: (e.target as HTMLInputElement).value || null } })} />
              </FormField>
              <FormField label="Prohibited Language">
                <TagInput tags={char.voice.prohibitedLanguage} onchange={(v) => updateCharacter(i, { voice: { ...char.voice, prohibitedLanguage: v } })} placeholder="Words this character would never use..." />
              </FormField>
              <FormField label="Dialogue Samples">
                <TagInput tags={char.voice.dialogueSamples} onchange={(v) => updateCharacter(i, { voice: { ...char.voice, dialogueSamples: v } })} placeholder="Example dialogue lines..." />
              </FormField>
              <FormField label="Sentence Length Range">
                <NumberRange
                  value={char.voice.sentenceLengthRange ?? [5, 25]}
                  onchange={(v) => updateCharacter(i, { voice: { ...char.voice, sentenceLengthRange: v } })}
                  labels={["min", "max"]}
                />
              </FormField>
            </div>
          </CollapsibleSection>

          <CollapsibleSection summary="Behavior">
            <div class="char-section">
              <FormField label="Stress Response">
                <TextArea value={char.behavior?.stressResponse ?? ""} variant="compact" rows={1} oninput={(e) => updateCharacter(i, { behavior: { ...(char.behavior ?? {}), stressResponse: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
              <FormField label="Social Posture">
                <TextArea value={char.behavior?.socialPosture ?? ""} variant="compact" rows={1} oninput={(e) => updateCharacter(i, { behavior: { ...(char.behavior ?? {}), socialPosture: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
              <FormField label="Notices First">
                <TextArea value={char.behavior?.noticesFirst ?? ""} variant="compact" rows={1} oninput={(e) => updateCharacter(i, { behavior: { ...(char.behavior ?? {}), noticesFirst: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
              <FormField label="Lying Style">
                <TextArea value={char.behavior?.lyingStyle ?? ""} variant="compact" rows={1} oninput={(e) => updateCharacter(i, { behavior: { ...(char.behavior ?? {}), lyingStyle: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
              <FormField label="Emotion Physicality">
                <TextArea value={char.behavior?.emotionPhysicality ?? ""} variant="compact" rows={1} oninput={(e) => updateCharacter(i, { behavior: { ...(char.behavior ?? {}), emotionPhysicality: (e.target as HTMLTextAreaElement).value || null } })} />
              </FormField>
            </div>
          </CollapsibleSection>
        </div>
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
        <div class="loc-card">
          <FormField label="Name" required>
            <Input value={loc.name} oninput={(e) => updateLocation(i, { name: (e.target as HTMLInputElement).value })} placeholder="Location name" />
          </FormField>
          <FormField label="Description">
            <TextArea value={loc.description ?? ""} variant="compact" rows={2} oninput={(e) => updateLocation(i, { description: (e.target as HTMLTextAreaElement).value || null })} />
          </FormField>

          <CollapsibleSection summary="Sensory Palette">
            <div class="loc-section">
              <FormField label="Sounds">
                <TagInput tags={loc.sensoryPalette.sounds} onchange={(v) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, sounds: v } })} placeholder="Specific sounds..." />
              </FormField>
              <FormField label="Smells">
                <TagInput tags={loc.sensoryPalette.smells} onchange={(v) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, smells: v } })} placeholder="Specific smells..." />
              </FormField>
              <FormField label="Textures">
                <TagInput tags={loc.sensoryPalette.textures} onchange={(v) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, textures: v } })} placeholder="What do hands touch here..." />
              </FormField>
              <FormField label="Light Quality">
                <Input value={loc.sensoryPalette.lightQuality ?? ""} oninput={(e) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, lightQuality: (e.target as HTMLInputElement).value || null } })} placeholder="What does the light do?" />
              </FormField>
              <FormField label="Atmosphere">
                <Input value={loc.sensoryPalette.atmosphere ?? ""} oninput={(e) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, atmosphere: (e.target as HTMLInputElement).value || null } })} />
              </FormField>
              <FormField label="Prohibited Defaults">
                <TagInput tags={loc.sensoryPalette.prohibitedDefaults} onchange={(v) => updateLocation(i, { sensoryPalette: { ...loc.sensoryPalette, prohibitedDefaults: v } })} placeholder="Generic sensory details to avoid..." />
              </FormField>
            </div>
          </CollapsibleSection>
        </div>
      {/snippet}
    </CardList>

  {:else if currentStep === "style"}
    <div class="form-step">
      <FormField label="Approved Metaphoric Domains">
        <TagInput
          tags={bible.styleGuide.metaphoricRegister?.approvedDomains ?? []}
          onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, metaphoricRegister: { approvedDomains: v, prohibitedDomains: bible.styleGuide.metaphoricRegister?.prohibitedDomains ?? [] } } }; }}
          placeholder="e.g. machinery, water, decay..."
        />
      </FormField>
      <FormField label="Prohibited Metaphoric Domains">
        <TagInput
          tags={bible.styleGuide.metaphoricRegister?.prohibitedDomains ?? []}
          onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, metaphoricRegister: { approvedDomains: bible.styleGuide.metaphoricRegister?.approvedDomains ?? [], prohibitedDomains: v } } }; }}
          placeholder="e.g. flowers, sunshine..."
        />
      </FormField>

      <CollapsibleSection summary="Avoid List">
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

      <CollapsibleSection summary="Vocabulary Preferences">
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

      <FormField label="Structural Bans">
        <TagInput
          tags={bible.styleGuide.structuralBans}
          onchange={(v) => { bible = { ...bible, styleGuide: { ...bible.styleGuide, structuralBans: v } }; }}
          placeholder="e.g. rhetorical questions, em-dash fragments..."
        />
      </FormField>
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
  .form-body { padding: 8px 0; }
  .form-step { display: flex; flex-direction: column; gap: 10px; }
  .char-card, .loc-card { display: flex; flex-direction: column; gap: 8px; }
  .char-section, .loc-section { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
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
