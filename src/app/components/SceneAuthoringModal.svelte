<script lang="ts">
import {
  type BootstrapActiveSetup,
  type BootstrapCharacterDossier,
  type BootstrapLocationDetail,
  buildSceneBootstrapPrompt,
  mapSceneBootstrapToPlans,
  parseSceneBootstrapResponse,
} from "../../bootstrap/sceneBootstrap.js";
import { generateStream } from "../../llm/client.js";
import type { ChapterArc, ScenePlan } from "../../types/index.js";
import { createEmptyChapterArc, createEmptyScenePlan, generateId } from "../../types/index.js";
import {
  Button,
  CardList,
  CollapsibleSection,
  ErrorBanner,
  FormField,
  Input,
  Modal,
  NumberRange,
  RadioGroup,
  Spinner,
  Tabs,
  TagInput,
  TextArea,
} from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  store,
  commands,
  initialTab,
}: {
  store: ProjectStore;
  commands: Commands;
  initialTab?: "bootstrap" | "form";
} = $props();

// ─── Tab state ──────────────────────────────────
let activeTab = $state(initialTab ?? "bootstrap");
const tabItems = [
  { id: "bootstrap", label: "AI Bootstrap" },
  { id: "form", label: "Guided Form" },
];

// ─── Bootstrap state ────────────────────────────
let direction = $state("");
let sceneCount = $state(3);
let constraints = $state("");
let includeChapterArc = $state(true);
let selectedCharIds = $state<string[]>([]);
let selectedLocIds = $state<string[]>([]);
let loading = $state(false);
let status = $state("");
let streamText = $state("");
let elapsed = $state(0);
let error = $state<string | null>(null);
let timerRef: ReturnType<typeof setInterval> | null = null;
let generatedPlans = $state<ScenePlan[]>([]);
let generatedArc = $state<ChapterArc | null>(null);
let acceptedIndices = $state<Set<number>>(new Set());

// ─── Guided Form state ─────────────────────────
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
  if (store.sceneAuthoringOpen) {
    formPlan = createEmptyScenePlan(store.project?.id ?? "");
    formStep = "core";
  }
});

// ─── Derived ────────────────────────────────────
let bibleCharacters = $derived(store.bible?.characters ?? []);
let bibleLocations = $derived(store.bible?.locations ?? []);

// ─── Handlers ───────────────────────────────────
function handleClose() {
  store.setSceneAuthoringOpen(false);
  error = null;
  status = "";
  streamText = "";
  elapsed = 0;
  generatedPlans = [];
  generatedArc = null;
  acceptedIndices = new Set();
  if (timerRef) clearInterval(timerRef);
}

function toggleCharacter(id: string) {
  if (selectedCharIds.includes(id)) {
    selectedCharIds = selectedCharIds.filter((c) => c !== id);
  } else {
    selectedCharIds = [...selectedCharIds, id];
  }
}

function toggleLocation(id: string) {
  if (selectedLocIds.includes(id)) {
    selectedLocIds = selectedLocIds.filter((l) => l !== id);
  } else {
    selectedLocIds = [...selectedLocIds, id];
  }
}

async function handleGenerate() {
  if (!direction.trim()) return;

  loading = true;
  error = null;
  streamText = "";
  elapsed = 0;
  generatedPlans = [];
  generatedArc = null;
  acceptedIndices = new Set();

  const started = Date.now();
  timerRef = setInterval(() => {
    elapsed = Math.floor((Date.now() - started) / 1000);
  }, 1000);

  try {
    status = "Building prompt...";
    const chars = bibleCharacters
      .filter((c) => selectedCharIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name, role: c.role }));
    const locs = bibleLocations.filter((l) => selectedLocIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name }));

    // Gather rich context from store
    const existingScenes = store.scenes.map((s) => ({
      title: s.plan.title,
      povCharacterName: bibleCharacters.find((c) => c.id === s.plan.povCharacterId)?.name ?? "",
      povDistance: s.plan.povDistance,
      narrativeGoal: s.plan.narrativeGoal,
      emotionalBeat: s.plan.emotionalBeat,
      readerStateExiting: s.plan.readerStateExiting,
    }));

    const chapterArc = store.chapterArc
      ? {
          workingTitle: store.chapterArc.workingTitle,
          narrativeFunction: store.chapterArc.narrativeFunction,
          dominantRegister: store.chapterArc.dominantRegister,
          pacingTarget: store.chapterArc.pacingTarget,
          endingPosture: store.chapterArc.endingPosture,
        }
      : undefined;

    const narrativeRules = store.bible?.narrativeRules
      ? {
          pov: store.bible.narrativeRules.pov,
          subtextPolicy: store.bible.narrativeRules.subtextPolicy,
          expositionPolicy: store.bible.narrativeRules.expositionPolicy,
          sceneEndingPolicy: store.bible.narrativeRules.sceneEndingPolicy,
        }
      : undefined;

    const activeSetups: BootstrapActiveSetup[] = (store.bible?.narrativeRules?.setups ?? [])
      .filter((s) => s.status === "planned" || s.status === "planted")
      .map((s) => ({ description: s.description, status: s.status }));

    const characterDossiers: BootstrapCharacterDossier[] = bibleCharacters
      .filter((c) => selectedCharIds.includes(c.id))
      .map((c) => ({
        name: c.name,
        role: c.role,
        backstory: c.backstory,
        contradictions: c.contradictions,
        voice: {
          vocabularyNotes: c.voice.vocabularyNotes,
          verbalTics: c.voice.verbalTics,
          prohibitedLanguage: c.voice.prohibitedLanguage,
          metaphoricRegister: c.voice.metaphoricRegister,
        },
        behavior: c.behavior
          ? {
              stressResponse: c.behavior.stressResponse,
              noticesFirst: c.behavior.noticesFirst,
              emotionPhysicality: c.behavior.emotionPhysicality,
            }
          : null,
      }));

    const locationDetails: BootstrapLocationDetail[] = bibleLocations
      .filter((l) => selectedLocIds.includes(l.id))
      .map((l) => ({
        name: l.name,
        description: l.description,
        atmosphere: l.sensoryPalette?.atmosphere ?? null,
        sounds: l.sensoryPalette?.sounds ?? [],
        smells: l.sensoryPalette?.smells ?? [],
        prohibitedDefaults: l.sensoryPalette?.prohibitedDefaults ?? [],
      }));

    const killList = (store.bible?.styleGuide?.killList ?? []).map((k) => k.pattern);
    const structuralBans = store.bible?.styleGuide?.structuralBans ?? [];

    const payload = buildSceneBootstrapPrompt({
      direction: direction.trim(),
      sceneCount,
      characters: chars,
      locations: locs,
      constraints: constraints.trim() || undefined,
      includeChapterArc,
      existingScenes: existingScenes.length > 0 ? existingScenes : undefined,
      chapterArc,
      narrativeRules,
      activeSetups: activeSetups.length > 0 ? activeSetups : undefined,
      characterDossiers: characterDossiers.length > 0 ? characterDossiers : undefined,
      locationDetails: locationDetails.length > 0 ? locationDetails : undefined,
      killList: killList.length > 0 ? killList : undefined,
      structuralBans: structuralBans.length > 0 ? structuralBans : undefined,
    });

    status = "Streaming from LLM...";
    let fullText = "";

    await generateStream(payload, {
      onToken: (text) => {
        fullText += text;
        streamText = fullText;
      },
      onDone: () => {
        status = "Parsing response...";
      },
      onError: (err) => {
        throw new Error(err);
      },
    });

    const parsed = parseSceneBootstrapResponse(fullText);
    if ("error" in parsed) {
      error = `Parse failed: ${parsed.error}\n\nRaw response:\n${fullText.slice(0, 500)}`;
      loading = false;
      status = "";
      return;
    }

    const plans = mapSceneBootstrapToPlans(
      parsed,
      store.project?.id ?? `proj-${Date.now()}`,
      bibleCharacters.map((c) => ({ id: c.id, name: c.name })),
      bibleLocations.map((l) => ({ id: l.id, name: l.name })),
    );

    generatedPlans = plans;

    if (parsed.chapterArc) {
      const arcBase = createEmptyChapterArc(store.project?.id ?? "");
      generatedArc = {
        ...arcBase,
        workingTitle: parsed.chapterArc.workingTitle || "",
        narrativeFunction: parsed.chapterArc.narrativeFunction || "",
        dominantRegister: parsed.chapterArc.dominantRegister || "",
        pacingTarget: parsed.chapterArc.pacingTarget || "",
        endingPosture: parsed.chapterArc.endingPosture || "",
        readerStateEntering: {
          knows: parsed.chapterArc.readerStateEntering?.knows ?? [],
          suspects: parsed.chapterArc.readerStateEntering?.suspects ?? [],
          wrongAbout: parsed.chapterArc.readerStateEntering?.wrongAbout ?? [],
          activeTensions: parsed.chapterArc.readerStateEntering?.activeTensions ?? [],
        },
        readerStateExiting: {
          knows: parsed.chapterArc.readerStateExiting?.knows ?? [],
          suspects: parsed.chapterArc.readerStateExiting?.suspects ?? [],
          wrongAbout: parsed.chapterArc.readerStateExiting?.wrongAbout ?? [],
          activeTensions: parsed.chapterArc.readerStateExiting?.activeTensions ?? [],
        },
      };
    }

    status = "Done!";
    loading = false;
  } catch (err) {
    error = err instanceof Error ? err.message : "Scene bootstrap failed";
    loading = false;
    status = "";
  } finally {
    if (timerRef) clearInterval(timerRef);
  }
}

function toggleAccept(index: number) {
  const next = new Set(acceptedIndices);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  acceptedIndices = next;
}

function acceptAll() {
  acceptedIndices = new Set(generatedPlans.map((_, i) => i));
}

async function commitAccepted() {
  // Build sourcePrompt from direction + constraints
  const sourcePrompt = direction.trim() + (constraints.trim() ? `\n\nConstraints: ${constraints.trim()}` : "");

  // Save chapter arc first so we have its ID for scene plans
  if (generatedArc) {
    generatedArc.sourcePrompt = sourcePrompt;
    await commands.saveChapterArc(generatedArc);
  } else if (!store.chapterArc) {
    // Auto-create a minimal chapter arc so scenes have a chapterId to persist under
    const arc = createEmptyChapterArc(store.project?.id ?? "");
    arc.sourcePrompt = sourcePrompt;
    await commands.saveChapterArc(arc);
  }

  const chapterId = store.chapterArc?.id ?? null;
  const plans = generatedPlans.filter((_, i) => acceptedIndices.has(i)).map((p) => ({ ...p, chapterId }));

  if (plans.length > 0) {
    await commands.saveMultipleScenePlans(plans);
  }
  handleClose();
}

// ─── Guided Form helpers ────────────────────────
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
  if (!store.chapterArc) {
    const arc = createEmptyChapterArc(store.project?.id ?? "");
    await commands.saveChapterArc(arc);
  }
  const chapterId = store.chapterArc?.id ?? null;
  await commands.saveScenePlan({ ...formPlan, chapterId }, store.scenes.length);
  formPlan = createEmptyScenePlan(store.project?.id ?? "");
  formStep = "core";
  handleClose();
}

function findCharName(id: string): string {
  return bibleCharacters.find((c) => c.id === id)?.name ?? id;
}
</script>

<Modal open={store.sceneAuthoringOpen} onClose={handleClose} width="wide">
  {#snippet header()}Scene Authoring{/snippet}

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id; }} />

  {#if activeTab === "bootstrap"}
    <!-- ─── AI Bootstrap Tab ──────────────────── -->
    {#if generatedPlans.length === 0}
      <div class="bootstrap-form">
        <FormField label="Chapter Direction" required hint="Describe the chapter you want to write">
          <TextArea bind:value={direction} placeholder="A tense confrontation between Marcus and Elena at The Velvet, escalating from veiled threats to an open power play..." />
        </FormField>

        <FormField label="Scene Count">
          <Input type="number" bind:value={sceneCount} />
        </FormField>

        {#if bibleCharacters.length > 0}
          <FormField label="Characters" hint="Select characters to include">
            <div class="checkbox-grid">
              {#each bibleCharacters as char (char.id)}
                <label class="checkbox-option">
                  <input type="checkbox" checked={selectedCharIds.includes(char.id)} onchange={() => toggleCharacter(char.id)} />
                  <span>{char.name}</span>
                  <span class="checkbox-role">{char.role}</span>
                </label>
              {/each}
            </div>
          </FormField>
        {/if}

        {#if bibleLocations.length > 0}
          <FormField label="Locations" hint="Select locations to include">
            <div class="checkbox-grid">
              {#each bibleLocations as loc (loc.id)}
                <label class="checkbox-option">
                  <input type="checkbox" checked={selectedLocIds.includes(loc.id)} onchange={() => toggleLocation(loc.id)} />
                  <span>{loc.name}</span>
                </label>
              {/each}
            </div>
          </FormField>
        {/if}

        <FormField label="Additional Constraints" hint="Optional extra guidance">
          <TextArea bind:value={constraints} variant="compact" rows={2} placeholder="No violence in the first scene, save the reveal for the final scene..." />
        </FormField>

        <label class="checkbox-option">
          <input type="checkbox" bind:checked={includeChapterArc} />
          <span>Also generate Chapter Arc</span>
        </label>
      </div>

      {#if loading}
        <div class="stream-display">{streamText || "Waiting for first token..."}</div>
        <div class="status-bar">
          <Spinner size="sm" />
          <span>{status}</span>
          <span class="status-meta">{elapsed}s · {streamText.length} chars</span>
        </div>
      {/if}
    {:else}
      <!-- ─── Preview generated scenes ────────── -->
      <div class="preview-header">
        <span class="preview-count">{generatedPlans.length} scenes generated</span>
        <div class="preview-actions">
          <Button size="sm" onclick={acceptAll}>Select All</Button>
          <Button size="sm" variant="primary" onclick={commitAccepted} disabled={acceptedIndices.size === 0}>
            Accept {acceptedIndices.size} Scene{acceptedIndices.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
      <div class="preview-grid">
        {#each generatedPlans as plan, i (plan.id)}
          <button
            type="button"
            class="preview-card"
            class:preview-card-selected={acceptedIndices.has(i)}
            onclick={() => toggleAccept(i)}
          >
            <div class="preview-card-title">{plan.title || `Scene ${i + 1}`}</div>
            <div class="preview-card-detail"><span class="preview-label">POV:</span> {findCharName(plan.povCharacterId) || "—"}</div>
            <div class="preview-card-detail"><span class="preview-label">Goal:</span> {plan.narrativeGoal || "—"}</div>
            <div class="preview-card-detail"><span class="preview-label">Beat:</span> {plan.emotionalBeat || "—"}</div>
            <div class="preview-card-detail"><span class="preview-label">Words:</span> {plan.estimatedWordCount[0]}–{plan.estimatedWordCount[1]}</div>
          </button>
        {/each}
      </div>
      {#if generatedArc}
        <div class="preview-arc">
          <span class="preview-label">Chapter Arc:</span> {generatedArc.workingTitle}
        </div>
      {/if}
    {/if}

    {#if error}
      <div class="modal-error-wrap"><ErrorBanner message={error} /></div>
    {/if}

  {:else}
    <!-- ─── Guided Form Tab ───────────────────── -->
    <div class="guided-form">
      {#if formStep === "core"}
        <div class="form-step">
          <FormField label="Title" required>
            <Input bind:value={formPlan.title} placeholder="Scene title" />
          </FormField>
          <FormField label="POV Character">
            {#if bibleCharacters.length > 0}
              <select class="select" value={formPlan.povCharacterId} onchange={(e) => updatePlan({ povCharacterId: (e.target as HTMLSelectElement).value })}>
                <option value="">Select character...</option>
                {#each bibleCharacters as char (char.id)}
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
            {#if bibleLocations.length > 0}
              <select class="select" value={formPlan.locationId ?? ""} onchange={(e) => updatePlan({ locationId: (e.target as HTMLSelectElement).value || null })}>
                <option value="">No location</option>
                {#each bibleLocations as loc (loc.id)}
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
  {/if}

  {#snippet footer()}
    {#if activeTab === "bootstrap"}
      <Button onclick={handleClose}>Cancel</Button>
      {#if generatedPlans.length === 0}
        <Button variant="primary" onclick={handleGenerate} disabled={loading || !direction.trim()}>
          {loading ? "Generating..." : "Generate Scenes"}
        </Button>
      {/if}
    {:else}
      <Button onclick={handleClose}>Cancel</Button>
      <div class="form-nav">
        {#if formStep !== "core"}
          <Button onclick={prevFormStep}>Back</Button>
        {/if}
        <Button onclick={saveFormPlan}>Save & Close</Button>
        {#if formStep === "structure"}
          <Button variant="primary" onclick={saveFormPlan}>Save Scene Plan</Button>
        {:else}
          <Button variant="primary" onclick={nextFormStep}>Next</Button>
        {/if}
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .bootstrap-form { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }
  .checkbox-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .checkbox-option {
    display: flex; align-items: center; gap: 4px; cursor: pointer;
    font-size: 11px; color: var(--text-secondary);
  }
  .checkbox-role { color: var(--text-muted); font-size: 10px; }
  .stream-display {
    font-family: var(--font-mono); font-size: 11px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; height: 200px;
    overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--text-primary);
    margin-top: 8px;
  }
  .status-bar {
    margin-top: 8px; padding: 6px 10px; border-radius: var(--radius-md); font-size: 11px;
    display: flex; align-items: center; gap: 8px;
  }
  .status-meta { color: var(--text-secondary); margin-left: auto; }
  .modal-error-wrap { margin-top: 8px; }

  .preview-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
  .preview-count { font-size: 11px; color: var(--text-secondary); }
  .preview-actions { display: flex; gap: 6px; }
  .preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .preview-card {
    display: flex; flex-direction: column; gap: 4px; padding: 10px;
    border: 1px solid var(--border); border-radius: var(--radius-md);
    background: var(--bg-card); text-align: left; cursor: pointer;
    font-family: var(--font-mono); font-size: inherit; color: inherit;
    transition: all 0.15s;
  }
  .preview-card:hover { border-color: var(--accent-dim); }
  .preview-card-selected { border-color: var(--accent); background: rgba(0, 212, 255, 0.08); }
  .preview-card-title { font-size: 12px; color: var(--text-primary); font-weight: 500; }
  .preview-card-detail { font-size: 10px; color: var(--text-secondary); }
  .preview-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .preview-arc { padding: 6px 0; font-size: 11px; color: var(--text-secondary); }

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
  .form-nav { display: flex; gap: 6px; margin-left: auto; }
  .anchor-fields { display: flex; flex-direction: column; gap: 4px; }
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
