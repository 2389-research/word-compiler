<script lang="ts">
import type { CharacterDossier, Location, ScenePlan } from "../../types/index.js";
import { createEmptyScenePlan } from "../../types/index.js";
import {
  CardList,
  CollapsibleSection,
  FormField,
  Input,
  NumberRange,
  RadioGroup,
  TagInput,
  TextArea,
} from "../primitives/index.js";

export type FormFooterState = {
  formStep: string;
  isFirstStep: boolean;
  isLastStep: boolean;
};

let {
  characters,
  locations,
  projectId,
  open,
  onSave,
  footerState = $bindable({ formStep: "core", isFirstStep: true, isLastStep: false }),
}: {
  characters: CharacterDossier[];
  locations: Location[];
  projectId: string;
  open: boolean;
  onSave: (plan: ScenePlan) => Promise<void>;
  footerState?: FormFooterState;
} = $props();

// ─── Form state ─────────────────────────────────
let formStep = $state("core");
const formSteps = [
  { id: "core", label: "Core Identity" },
  { id: "reader", label: "Reader Knowledge" },
  { id: "texture", label: "Texture" },
  { id: "structure", label: "Structure" },
];

let formPlan = $state<ScenePlan>(createEmptyScenePlan(""));

// Re-init when modal opens
$effect(() => {
  if (open) {
    formPlan = createEmptyScenePlan(projectId);
    formStep = "core";
  }
});

// ─── Keep footer state in sync for parent ───────
$effect(() => {
  footerState = {
    formStep,
    isFirstStep: formStep === "core",
    isLastStep: formStep === "structure",
  };
});

// ─── Handlers ───────────────────────────────────
function updatePlan(changes: Partial<ScenePlan>) {
  formPlan = { ...formPlan, ...changes };
}

function nextFormStep() {
  const idx = formSteps.findIndex((s) => s.id === formStep);
  if (idx < formSteps.length - 1) {
    formStep = formSteps[idx + 1]!.id;
  }
}

function prevFormStep() {
  const idx = formSteps.findIndex((s) => s.id === formStep);
  if (idx > 0) {
    formStep = formSteps[idx - 1]!.id;
  }
}

async function saveFormPlan() {
  await onSave(formPlan);
  formPlan = createEmptyScenePlan(projectId);
  formStep = "core";
}

// ─── Exported methods for parent footer ─────────
export function next() {
  nextFormStep();
}

export function prev() {
  prevFormStep();
}

export function save() {
  saveFormPlan();
}
</script>

<div class="guided-form">
  {#if formStep === "core"}
    <div class="form-step">
      <FormField label="Title" required>
        <Input bind:value={formPlan.title} placeholder="Scene title" />
      </FormField>
      <FormField label="POV Character">
        {#if characters.length > 0}
          <select class="select" value={formPlan.povCharacterId} onchange={(e) => updatePlan({ povCharacterId: (e.target as HTMLSelectElement).value })}>
            <option value="">Select character...</option>
            {#each characters as char (char.id)}
              <option value={char.id}>{char.name} ({char.role})</option>
            {/each}
          </select>
        {:else}
          <Input bind:value={formPlan.povCharacterId} placeholder="Character ID or name" />
        {/if}
      </FormField>
      <FormField label="POV Distance">
        <RadioGroup name="formPovDistance" value={formPlan.povDistance} options={[
          { value: "intimate", label: "Intimate" },
          { value: "close", label: "Close" },
          { value: "moderate", label: "Moderate" },
          { value: "distant", label: "Distant" },
        ]} onchange={(v) => updatePlan({ povDistance: v as "intimate" | "close" | "moderate" | "distant" })} />
      </FormField>
      <FormField label="Narrative Goal" required hint="What must this scene accomplish?">
        <TextArea value={formPlan.narrativeGoal} variant="compact" rows={2} oninput={(e) => updatePlan({ narrativeGoal: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
      <FormField label="Emotional Beat" hint="What should the reader feel?">
        <TextArea value={formPlan.emotionalBeat} variant="compact" rows={2} oninput={(e) => updatePlan({ emotionalBeat: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
      <FormField label="Reader Effect" hint="What shifts in the reader's understanding?">
        <TextArea value={formPlan.readerEffect} variant="compact" rows={2} oninput={(e) => updatePlan({ readerEffect: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
      <FormField label="Failure Mode to Avoid">
        <TextArea value={formPlan.failureModeToAvoid} variant="compact" rows={2} oninput={(e) => updatePlan({ failureModeToAvoid: (e.target as HTMLTextAreaElement).value })} />
      </FormField>
    </div>

  {:else if formStep === "reader"}
    <div class="form-step">
      <fieldset class="form-fieldset">
        <legend>Reader State Entering</legend>
        <FormField label="Knows">
          <TagInput tags={formPlan.readerStateEntering?.knows ?? []} onchange={(v) => updatePlan({ readerStateEntering: { ...formPlan.readerStateEntering ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, knows: v } })} />
        </FormField>
        <FormField label="Suspects">
          <TagInput tags={formPlan.readerStateEntering?.suspects ?? []} onchange={(v) => updatePlan({ readerStateEntering: { ...formPlan.readerStateEntering ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, suspects: v } })} />
        </FormField>
        <FormField label="Wrong About">
          <TagInput tags={formPlan.readerStateEntering?.wrongAbout ?? []} onchange={(v) => updatePlan({ readerStateEntering: { ...formPlan.readerStateEntering ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, wrongAbout: v } })} />
        </FormField>
        <FormField label="Active Tensions">
          <TagInput tags={formPlan.readerStateEntering?.activeTensions ?? []} onchange={(v) => updatePlan({ readerStateEntering: { ...formPlan.readerStateEntering ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, activeTensions: v } })} />
        </FormField>
      </fieldset>
      <fieldset class="form-fieldset">
        <legend>Reader State Exiting</legend>
        <FormField label="Knows">
          <TagInput tags={formPlan.readerStateExiting?.knows ?? []} onchange={(v) => updatePlan({ readerStateExiting: { ...formPlan.readerStateExiting ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, knows: v } })} />
        </FormField>
        <FormField label="Suspects">
          <TagInput tags={formPlan.readerStateExiting?.suspects ?? []} onchange={(v) => updatePlan({ readerStateExiting: { ...formPlan.readerStateExiting ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, suspects: v } })} />
        </FormField>
        <FormField label="Wrong About">
          <TagInput tags={formPlan.readerStateExiting?.wrongAbout ?? []} onchange={(v) => updatePlan({ readerStateExiting: { ...formPlan.readerStateExiting ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, wrongAbout: v } })} />
        </FormField>
        <FormField label="Active Tensions">
          <TagInput tags={formPlan.readerStateExiting?.activeTensions ?? []} onchange={(v) => updatePlan({ readerStateExiting: { ...formPlan.readerStateExiting ?? { knows: [], suspects: [], wrongAbout: [], activeTensions: [] }, activeTensions: v } })} />
        </FormField>
      </fieldset>
    </div>

  {:else if formStep === "texture"}
    <div class="form-step">
      <FormField label="Pacing">
        <Input value={formPlan.pacing ?? ""} oninput={(e) => updatePlan({ pacing: (e.target as HTMLInputElement).value || null })} placeholder="Slow build to explosive confrontation" />
      </FormField>
      <FormField label="Density">
        <RadioGroup name="formDensity" value={formPlan.density} options={[
          { value: "sparse", label: "Sparse" },
          { value: "moderate", label: "Moderate" },
          { value: "dense", label: "Dense" },
        ]} onchange={(v) => updatePlan({ density: v as "sparse" | "moderate" | "dense" })} />
      </FormField>
      <FormField label="Sensory Notes">
        <TextArea value={formPlan.sensoryNotes ?? ""} variant="compact" rows={2} oninput={(e) => updatePlan({ sensoryNotes: (e.target as HTMLTextAreaElement).value || null })} placeholder="Rain on cobblestones, neon reflecting in puddles" />
      </FormField>
      <FormField label="Location">
        {#if locations.length > 0}
          <select class="select" value={formPlan.locationId ?? ""} onchange={(e) => updatePlan({ locationId: (e.target as HTMLSelectElement).value || null })}>
            <option value="">No location</option>
            {#each locations as loc (loc.id)}
              <option value={loc.id}>{loc.name}</option>
            {/each}
          </select>
        {:else}
          <Input value={formPlan.locationId ?? ""} oninput={(e) => updatePlan({ locationId: (e.target as HTMLInputElement).value || null })} placeholder="Location ID" />
        {/if}
      </FormField>
      <FormField label="Prohibitions">
        <TagInput tags={formPlan.sceneSpecificProhibitions} onchange={(v) => updatePlan({ sceneSpecificProhibitions: v })} placeholder="Add prohibition..." />
      </FormField>

      <CollapsibleSection summary="Subtext">
        <div class="form-step">
          <FormField label="Surface Conversation">
            <TextArea value={formPlan.subtext?.surfaceConversation ?? ""} variant="compact" rows={2} oninput={(e) => updatePlan({ subtext: { surfaceConversation: (e.target as HTMLTextAreaElement).value, actualConversation: formPlan.subtext?.actualConversation ?? "", enforcementRule: formPlan.subtext?.enforcementRule ?? "" } })} />
          </FormField>
          <FormField label="Actual Conversation">
            <TextArea value={formPlan.subtext?.actualConversation ?? ""} variant="compact" rows={2} oninput={(e) => updatePlan({ subtext: { surfaceConversation: formPlan.subtext?.surfaceConversation ?? "", actualConversation: (e.target as HTMLTextAreaElement).value, enforcementRule: formPlan.subtext?.enforcementRule ?? "" } })} />
          </FormField>
          <FormField label="Enforcement Rule">
            <TextArea value={formPlan.subtext?.enforcementRule ?? ""} variant="compact" rows={2} oninput={(e) => updatePlan({ subtext: { surfaceConversation: formPlan.subtext?.surfaceConversation ?? "", actualConversation: formPlan.subtext?.actualConversation ?? "", enforcementRule: (e.target as HTMLTextAreaElement).value } })} />
          </FormField>
        </div>
      </CollapsibleSection>

      <CollapsibleSection summary="Anchor Lines">
        <CardList
          items={formPlan.anchorLines}
          addLabel="Add Anchor Line"
          emptyMessage="No anchor lines yet."
          onAdd={() => updatePlan({ anchorLines: [...formPlan.anchorLines, { text: "", placement: "", verbatim: true }] })}
          onRemove={(i) => updatePlan({ anchorLines: formPlan.anchorLines.filter((_, idx) => idx !== i) })}
        >
          {#snippet renderItem(line, i)}
            <div class="anchor-fields">
              <Input value={line.text} oninput={(e) => {
                const updated = [...formPlan.anchorLines];
                updated[i] = { ...line, text: (e.target as HTMLInputElement).value };
                updatePlan({ anchorLines: updated });
              }} placeholder="Line text" />
              <Input value={line.placement} oninput={(e) => {
                const updated = [...formPlan.anchorLines];
                updated[i] = { ...line, placement: (e.target as HTMLInputElement).value };
                updatePlan({ anchorLines: updated });
              }} placeholder="Placement" />
              <label class="checkbox-option">
                <input type="checkbox" checked={line.verbatim} onchange={() => {
                  const updated = [...formPlan.anchorLines];
                  updated[i] = { ...line, verbatim: !line.verbatim };
                  updatePlan({ anchorLines: updated });
                }} />
                <span>Verbatim</span>
              </label>
            </div>
          {/snippet}
        </CardList>
      </CollapsibleSection>
    </div>

  {:else if formStep === "structure"}
    <div class="form-step">
      <FormField label="Estimated Word Count">
        <NumberRange value={formPlan.estimatedWordCount} onchange={(v) => updatePlan({ estimatedWordCount: v })} labels={["min", "max"]} />
      </FormField>
      <FormField label="Chunk Count">
        <Input type="number" value={String(formPlan.chunkCount)} oninput={(e) => updatePlan({ chunkCount: Number((e.target as HTMLInputElement).value) || 3 })} />
      </FormField>
      <FormField label="Chunk Descriptions" hint="Describe what happens in each chunk">
        <TagInput tags={formPlan.chunkDescriptions} onchange={(v) => updatePlan({ chunkDescriptions: v })} placeholder="Add chunk description..." />
      </FormField>

      <CollapsibleSection summary="JSON Preview">
        <pre class="json-preview">{JSON.stringify(formPlan, null, 2)}</pre>
      </CollapsibleSection>
    </div>
  {/if}
</div>

<style>
  .guided-form { padding: 8px 0; }
  .form-step { display: flex; flex-direction: column; gap: 10px; }
  .form-fieldset {
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .form-fieldset :global(legend) {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--accent); padding: 0 6px;
  }
  .anchor-fields { display: flex; flex-direction: column; gap: 4px; }
  .checkbox-option {
    display: flex; align-items: center; gap: 4px; cursor: pointer;
    font-size: 11px; color: var(--text-secondary);
  }
  .json-preview {
    font-family: var(--font-mono); font-size: 10px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px;
    overflow: auto; max-height: 300px; white-space: pre-wrap; color: var(--text-primary);
  }
  .select {
    font-family: var(--font-mono); font-size: 11px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-primary); padding: 4px 8px; width: 100%;
  }
</style>
