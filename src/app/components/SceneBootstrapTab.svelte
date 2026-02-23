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
import { createEmptyChapterArc } from "../../types/index.js";
import { Button, ErrorBanner, FormField, Input, Spinner, TextArea } from "../primitives/index.js";
import type { ProjectStore } from "../store/project.svelte.js";

export type BootstrapFooterState = {
  loading: boolean;
  canGenerate: boolean;
  hasPlans: boolean;
  acceptCount: number;
};

let {
  store,
  onCommit,
  footerState = $bindable({ loading: false, canGenerate: false, hasPlans: false, acceptCount: 0 }),
}: {
  store: ProjectStore;
  onCommit: (plans: ScenePlan[], arc: ChapterArc | null, sourcePrompt: string) => Promise<void>;
  footerState?: BootstrapFooterState;
} = $props();

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

// ─── Derived ────────────────────────────────────
let bibleCharacters = $derived(store.bible?.characters ?? []);
let bibleLocations = $derived(store.bible?.locations ?? []);

// ─── Keep footer state in sync for parent ───────
$effect(() => {
  footerState = {
    loading,
    canGenerate: !!direction.trim(),
    hasPlans: generatedPlans.length > 0,
    acceptCount: acceptedIndices.size,
  };
});

// ─── Cleanup interval on unmount ────────────────
$effect(() => {
  return () => {
    if (timerRef) clearInterval(timerRef);
  };
});

// ─── Handlers ───────────────────────────────────
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
    if (timerRef) {
      clearInterval(timerRef);
      timerRef = null;
    }
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
  const sourcePrompt = direction.trim() + (constraints.trim() ? `\n\nConstraints: ${constraints.trim()}` : "");
  const plans = generatedPlans.filter((_, i) => acceptedIndices.has(i));
  await onCommit(plans, generatedArc, sourcePrompt);
}

function findCharName(id: string): string {
  return bibleCharacters.find((c) => c.id === id)?.name ?? id;
}

// ─── Exported methods for parent footer ─────────
export function generate() {
  handleGenerate();
}

export function reset() {
  error = null;
  status = "";
  streamText = "";
  elapsed = 0;
  generatedPlans = [];
  generatedArc = null;
  acceptedIndices = new Set();
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}
</script>

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
</style>
