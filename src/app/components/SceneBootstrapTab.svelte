<script lang="ts">
import {
  type BootstrapActiveSetup,
  type BootstrapCharacterDossier,
  type BootstrapLocationDetail,
  buildSceneBootstrapPrompt,
  type ExistingSceneSummary,
  mapSceneBootstrapToPlans,
  parseSceneBootstrapResponse,
} from "../../bootstrap/sceneBootstrap.js";
import { generateStream } from "../../llm/client.js";
import type { ChapterArc, ScenePlan } from "../../types/index.js";
import { createEmptyChapterArc, createEmptyCharacterDossier, createEmptyLocation } from "../../types/index.js";
import { Button, ErrorBanner, FormField, Input, Spinner, TextArea } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

export type BootstrapPhase = "idle" | "generating" | "reviewing" | "complete";

export type BootstrapFooterState = {
  loading: boolean;
  canGenerate: boolean;
  phase: BootstrapPhase;
  acceptedCount: number;
};

let {
  store,
  commands,
  onCommit,
  footerState = $bindable({ loading: false, canGenerate: false, phase: "idle" as BootstrapPhase, acceptedCount: 0 }),
}: {
  store: ProjectStore;
  commands: Commands;
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

// ─── Phase state machine ─────────────────────────
let phase = $state<BootstrapPhase>("idle");
let acceptedPlans = $state<ScenePlan[]>([]);
let currentPlan = $state<ScenePlan | null>(null);
let currentArc = $state<ChapterArc | null>(null);
let currentSceneIndex = $state(0);
let skippedCount = $state(0);

// ─── Derived ────────────────────────────────────
let bibleCharacters = $derived(store.bible?.characters ?? []);
let bibleLocations = $derived(store.bible?.locations ?? []);
let isLastScene = $derived(currentSceneIndex >= sceneCount - 1);

// ─── Keep footer state in sync for parent ───────
$effect(() => {
  footerState = {
    loading,
    canGenerate: !!direction.trim(),
    phase,
    acceptedCount: acceptedPlans.length,
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

/** Normalize a partial reader state to a full reader state with array defaults */
function normalizeReaderState(raw?: {
  knows?: string[];
  suspects?: string[];
  wrongAbout?: string[];
  activeTensions?: string[];
}) {
  return {
    knows: raw?.knows ?? [],
    suspects: raw?.suspects ?? [],
    wrongAbout: raw?.wrongAbout ?? [],
    activeTensions: raw?.activeTensions ?? [],
  };
}

/** Build a ChapterArc from parsed bootstrap response, or return null */
function buildChapterArcFromParsed(parsed: ReturnType<typeof parseSceneBootstrapResponse>): ChapterArc | null {
  if ("error" in parsed || !parsed.chapterArc) return null;
  const arcBase = createEmptyChapterArc(store.project?.id ?? "");
  return {
    ...arcBase,
    workingTitle: parsed.chapterArc.workingTitle || "",
    narrativeFunction: parsed.chapterArc.narrativeFunction || "",
    dominantRegister: parsed.chapterArc.dominantRegister || "",
    pacingTarget: parsed.chapterArc.pacingTarget || "",
    endingPosture: parsed.chapterArc.endingPosture || "",
    readerStateEntering: normalizeReaderState(parsed.chapterArc.readerStateEntering),
    readerStateExiting: normalizeReaderState(parsed.chapterArc.readerStateExiting),
  };
}

/** Gather context from the store for the bootstrap prompt, with overridable sceneCount and existingScenes. */
function gatherBootstrapContext(overrides: {
  sceneCount: number;
  existingScenes: ExistingSceneSummary[];
  includeChapterArc: boolean;
}) {
  const chars = bibleCharacters
    .filter((c) => selectedCharIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name, role: c.role }));
  const locs = bibleLocations.filter((l) => selectedLocIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name }));

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

  return buildSceneBootstrapPrompt({
    direction: direction.trim(),
    sceneCount: overrides.sceneCount,
    characters: chars,
    locations: locs,
    constraints: constraints.trim() || undefined,
    includeChapterArc: overrides.includeChapterArc,
    existingScenes: overrides.existingScenes.length > 0 ? overrides.existingScenes : undefined,
    chapterArc,
    narrativeRules,
    activeSetups: activeSetups.length > 0 ? activeSetups : undefined,
    characterDossiers: characterDossiers.length > 0 ? characterDossiers : undefined,
    locationDetails: locationDetails.length > 0 ? locationDetails : undefined,
    killList: killList.length > 0 ? killList : undefined,
    structuralBans: structuralBans.length > 0 ? structuralBans : undefined,
  });
}

/** Build the existingScenes array from store scenes + session acceptedPlans. */
function buildExistingScenes() {
  const fromStore = store.scenes.map((s) => ({
    title: s.plan.title,
    povCharacterName: bibleCharacters.find((c) => c.id === s.plan.povCharacterId)?.name ?? "",
    povDistance: s.plan.povDistance,
    narrativeGoal: s.plan.narrativeGoal,
    emotionalBeat: s.plan.emotionalBeat,
    readerStateExiting: s.plan.readerStateExiting,
  }));

  const fromSession = acceptedPlans.map((p) => ({
    title: p.title,
    povCharacterName: bibleCharacters.find((c) => c.id === p.povCharacterId)?.name ?? "",
    povDistance: p.povDistance,
    narrativeGoal: p.narrativeGoal,
    emotionalBeat: p.emotionalBeat,
    readerStateExiting: p.readerStateExiting,
  }));

  return [...fromStore, ...fromSession];
}

async function handleGenerateOne() {
  if (!direction.trim()) return;

  loading = true;
  error = null;
  streamText = "";
  elapsed = 0;
  currentPlan = null;
  phase = "generating";

  const started = Date.now();
  timerRef = setInterval(() => {
    elapsed = Math.floor((Date.now() - started) / 1000);
  }, 1000);

  try {
    status = "Building prompt...";
    const existingScenes = buildExistingScenes();
    const shouldIncludeArc = includeChapterArc && isLastScene;
    const payload = gatherBootstrapContext({
      sceneCount: 1,
      existingScenes,
      includeChapterArc: shouldIncludeArc,
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
      phase = "reviewing"; // Stay in reviewing so user can retry
      status = "";
      return;
    }

    const selectedChars = bibleCharacters
      .filter((c) => selectedCharIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
    const selectedLocs = bibleLocations
      .filter((l) => selectedLocIds.includes(l.id))
      .map((l) => ({ id: l.id, name: l.name }));
    const plans = mapSceneBootstrapToPlans(
      parsed,
      store.project?.id ?? `proj-${Date.now()}`,
      selectedChars,
      selectedLocs,
    );

    currentPlan = plans[0] ?? null;
    if (!currentPlan) {
      error = `LLM response parsed but contained no section plan.\n\nRaw response:\n${fullText.slice(0, 500)}`;
      loading = false;
      phase = "reviewing";
      status = "";
      return;
    }
    if (shouldIncludeArc) {
      currentArc = buildChapterArcFromParsed(parsed);
    }

    phase = "reviewing";
    status = "Done!";
    loading = false;
  } catch (err) {
    error = err instanceof Error ? err.message : "Section planning failed";
    loading = false;
    phase = "reviewing"; // Stay in reviewing for retry
    status = "";
  } finally {
    if (timerRef) {
      clearInterval(timerRef);
      timerRef = null;
    }
  }
}

function handleAccept() {
  if (loading || !currentPlan) return;
  error = null;
  acceptedPlans = [...acceptedPlans, currentPlan];
  currentPlan = null;
  advanceOrComplete();
}

function handleSkip() {
  if (loading) return;
  error = null;
  currentPlan = null;
  skippedCount++;
  advanceOrComplete();
}

function advanceOrComplete() {
  const nextIndex = currentSceneIndex + 1;
  currentSceneIndex = nextIndex;
  if (nextIndex >= sceneCount) {
    phase = "complete";
  } else {
    handleGenerateOne();
  }
}

function handleRegenerate() {
  error = null;
  handleGenerateOne();
}

function handleAddMore() {
  // Discard the chapter arc since we're adding more scenes
  currentArc = null;
  sceneCount++;
  phase = "generating";
  handleGenerateOne();
}

async function commitAccepted() {
  const sourcePrompt = direction.trim() + (constraints.trim() ? `\n\nConstraints: ${constraints.trim()}` : "");
  await onCommit(acceptedPlans, currentArc, sourcePrompt);
}

function findCharName(id: string): string {
  return bibleCharacters.find((c) => c.id === id)?.name ?? id;
}

function findLocName(id: string | null): string {
  if (!id) return "";
  return bibleLocations.find((l) => l.id === id)?.name ?? id;
}

/** Check if a scene's POV character is resolved (exists in bible). */
function isCharResolved(plan: ScenePlan): boolean {
  return !plan.povCharacterId || bibleCharacters.some((c) => c.id === plan.povCharacterId);
}

/** Check if a scene's location is resolved (exists in bible or null). */
function isLocResolved(plan: ScenePlan): boolean {
  return !plan.locationId || bibleLocations.some((l) => l.id === plan.locationId);
}

/** Check if any accepted scene has unresolved references. */
let hasUnresolved = $derived.by(() => {
  const plans = currentPlan ? [...acceptedPlans, currentPlan] : acceptedPlans;
  return plans.some((plan) => !isCharResolved(plan) || !isLocResolved(plan));
});

/** Resolve a scene's POV character in the accepted plans list. */
function resolveSceneChar(planIndex: number, charId: string) {
  acceptedPlans = acceptedPlans.map((p, i) => (i === planIndex ? { ...p, povCharacterId: charId } : p));
}

/** Resolve a scene's location in the accepted plans list. */
function resolveSceneLoc(planIndex: number, locId: string) {
  acceptedPlans = acceptedPlans.map((p, i) => (i === planIndex ? { ...p, locationId: locId || null } : p));
}

/** Resolve the current reviewing scene's POV character. */
function resolveCurrentChar(charId: string) {
  if (currentPlan) {
    currentPlan = { ...currentPlan, povCharacterId: charId };
  }
}

/** Resolve the current reviewing scene's location. */
function resolveCurrentLoc(locId: string) {
  if (currentPlan) {
    currentPlan = { ...currentPlan, locationId: locId || null };
  }
}

/** Create a new character stub in the bible and assign it to a scene. */
async function createAndAssignChar(planIndex: number, name: string) {
  const bible = store.bible;
  if (!bible) return;
  const newChar = createEmptyCharacterDossier(name);
  const updated = { ...bible, characters: [...bible.characters, newChar] };
  await commands.saveBible(updated);
  resolveSceneChar(planIndex, newChar.id);
}

/** Create a new location stub in the bible and assign it to a scene. */
async function createAndAssignLoc(planIndex: number, name: string) {
  const bible = store.bible;
  if (!bible) return;
  const newLoc = createEmptyLocation(name);
  const updated = { ...bible, locations: [...bible.locations, newLoc] };
  await commands.saveBible(updated);
  resolveSceneLoc(planIndex, newLoc.id);
}

/** Create char and assign to current reviewing scene. */
async function createAndAssignCurrentChar(name: string) {
  const bible = store.bible;
  if (!bible) return;
  const newChar = createEmptyCharacterDossier(name);
  const updated = { ...bible, characters: [...bible.characters, newChar] };
  await commands.saveBible(updated);
  resolveCurrentChar(newChar.id);
}

/** Create loc and assign to current reviewing scene. */
async function createAndAssignCurrentLoc(name: string) {
  const bible = store.bible;
  if (!bible) return;
  const newLoc = createEmptyLocation(name);
  const updated = { ...bible, locations: [...bible.locations, newLoc] };
  await commands.saveBible(updated);
  resolveCurrentLoc(newLoc.id);
}

// ─── Exported methods for parent footer ─────────
export function generate() {
  currentSceneIndex = 0;
  acceptedPlans = [];
  currentPlan = null;
  currentArc = null;
  skippedCount = 0;
  handleGenerateOne();
}

export function commit() {
  commitAccepted();
}

export function reset() {
  error = null;
  status = "";
  streamText = "";
  elapsed = 0;
  phase = "idle";
  acceptedPlans = [];
  currentPlan = null;
  currentArc = null;
  currentSceneIndex = 0;
  skippedCount = 0;
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}
</script>

{#if phase === "idle"}
  <!-- ─── Form phase ────────────────────────── -->
  <div class="bootstrap-form">
    <FormField label="Essay Direction" required hint="Describe the essay you want to write">
      <TextArea bind:value={direction} autofocus placeholder="An essay exploring why most productivity advice fails knowledge workers, building from personal experience to systemic critique..." />
    </FormField>

    <FormField label="Section Count">
      <Input type="number" bind:value={sceneCount} />
    </FormField>

    {#if bibleCharacters.length > 0}
      <FormField label="Voice Profiles" hint="Select voice profiles to include">
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
      <TextArea bind:value={constraints} variant="compact" rows={2} placeholder="Save the strongest argument for the final section, open with a personal anecdote..." />
    </FormField>

    <label class="checkbox-option">
      <input type="checkbox" bind:checked={includeChapterArc} />
      <span>Also generate Essay Arc</span>
    </label>
  </div>
{:else if phase === "generating"}
  <!-- ─── Generating phase ──────────────────── -->
  <div class="generating-phase">
    <div class="progress-header">
      <span class="progress-label">Section {currentSceneIndex + 1} of {sceneCount}</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {((currentSceneIndex) / sceneCount) * 100}%"></div>
      </div>
    </div>

    <div class="form-summary">
      <span class="summary-label">Direction:</span> {direction}
    </div>

    <div class="stream-display">{streamText || "Waiting for first token..."}</div>
    <div class="status-bar">
      <Spinner size="sm" />
      <span>{status}</span>
      <span class="status-meta">{elapsed}s · {streamText.length} chars</span>
    </div>

    {#if acceptedPlans.length > 0}
      <div class="accepted-sidebar">
        {#each acceptedPlans as plan, i (plan.id)}
          <div class="accepted-mini">Section {i + 1}: {plan.title}</div>
        {/each}
      </div>
    {/if}
  </div>
{:else if phase === "reviewing"}
  <!-- ─── Reviewing phase ───────────────────── -->
  <div class="reviewing-phase">
    <div class="progress-header">
      <span class="progress-label">Review Section {currentSceneIndex + 1} of {sceneCount}</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {((currentSceneIndex) / sceneCount) * 100}%"></div>
      </div>
    </div>

    {#if currentPlan}
      {@const charOk = isCharResolved(currentPlan)}
      {@const locOk = isLocResolved(currentPlan)}
      <div class="review-card" class:review-card-warn={!charOk || !locOk}>
        <div class="review-card-title">{currentPlan.title || `Section ${currentSceneIndex + 1}`}</div>

        {#if charOk}
          <div class="review-card-detail"><span class="review-label">Voice:</span> {findCharName(currentPlan.povCharacterId) || "—"}</div>
        {:else}
          <div class="resolve-row">
            <span class="resolve-warn">Voice: "{currentPlan.povCharacterId}" not in brief</span>
            <select class="resolve-select" onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === "__new__") { createAndAssignCurrentChar(currentPlan!.povCharacterId); } else if (v) { resolveCurrentChar(v); } }}>
              <option value="">Map to...</option>
              {#each bibleCharacters as c (c.id)}
                <option value={c.id}>{c.name} ({c.role})</option>
              {/each}
              <option value="__new__">+ New "{currentPlan.povCharacterId}"</option>
            </select>
          </div>
        {/if}

        <div class="review-card-detail"><span class="review-label">Goal:</span> {currentPlan.narrativeGoal || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Beat:</span> {currentPlan.emotionalBeat || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Effect:</span> {currentPlan.readerEffect || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Avoid:</span> {currentPlan.failureModeToAvoid || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Words:</span> {currentPlan.estimatedWordCount[0]}–{currentPlan.estimatedWordCount[1]}</div>
        <div class="review-card-detail"><span class="review-label">Density:</span> {currentPlan.density}</div>
        <div class="review-card-detail"><span class="review-label">Pacing:</span> {currentPlan.pacing || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Sensory:</span> {currentPlan.sensoryNotes || "—"}</div>
        <div class="review-card-detail"><span class="review-label">Location:</span> {currentPlan.locationId ? (locOk ? findLocName(currentPlan.locationId) : "") : "—"}</div>

        {#if !locOk}
          <div class="resolve-row">
            <span class="resolve-warn">Location: "{currentPlan.locationId}" not in brief</span>
            <select class="resolve-select" onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === "__new__") { createAndAssignCurrentLoc(currentPlan!.locationId ?? "New Location"); } else { resolveCurrentLoc(v); } }}>
              <option value="">Map to...</option>
              {#each bibleLocations as l (l.id)}
                <option value={l.id}>{l.name}</option>
              {/each}
              <option value="__new__">+ New "{currentPlan.locationId}"</option>
            </select>
          </div>
        {/if}

        {#if currentPlan.chunkDescriptions.length > 0}
          <div class="review-card-section">
            <span class="review-label">Chunks:</span>
            <ol class="chunk-list">
              {#each currentPlan.chunkDescriptions as desc}
                <li>{desc}</li>
              {/each}
            </ol>
          </div>
        {/if}

        {#if currentPlan.subtext.surfaceConversation || currentPlan.subtext.actualConversation}
          <div class="review-card-section">
            <span class="review-label">Subtext:</span>
            <div class="review-card-detail">Surface: {currentPlan.subtext.surfaceConversation}</div>
            <div class="review-card-detail">Actual: {currentPlan.subtext.actualConversation}</div>
            <div class="review-card-detail">Rule: {currentPlan.subtext.enforcementRule}</div>
          </div>
        {/if}
      </div>

      <div class="review-actions">
        <Button size="sm" variant="primary" onclick={handleAccept}>Accept</Button>
        <Button size="sm" onclick={handleSkip}>Skip</Button>
        <Button size="sm" onclick={handleRegenerate}>Regenerate</Button>
      </div>
    {:else if error}
      <div class="review-actions">
        <Button size="sm" onclick={handleRegenerate}>Retry</Button>
        <Button size="sm" onclick={handleSkip}>Skip</Button>
      </div>
    {/if}

    {#if acceptedPlans.length > 0}
      <div class="accepted-sidebar">
        {#each acceptedPlans as plan, i (plan.id)}
          <div class="accepted-mini">Section {i + 1}: {plan.title}</div>
        {/each}
      </div>
    {/if}
  </div>
{:else if phase === "complete"}
  <!-- ─── Complete phase ────────────────────── -->
  <div class="complete-phase">
    <div class="complete-summary">
      {acceptedPlans.length} accepted, {skippedCount} skipped
    </div>

    {#if acceptedPlans.length > 0}
      <div class="accepted-list">
        {#each acceptedPlans as plan, i (plan.id)}
          {@const charOk = isCharResolved(plan)}
          {@const locOk = isLocResolved(plan)}
          <div class="accepted-card" class:accepted-card-warn={!charOk || !locOk}>
            <div class="accepted-card-title">Section {i + 1}: {plan.title}</div>
            {#if charOk}
              <div class="accepted-card-detail"><span class="review-label">Voice:</span> {findCharName(plan.povCharacterId) || "—"}</div>
            {:else}
              <div class="resolve-row">
                <span class="resolve-warn">Voice: "{plan.povCharacterId}" not in brief</span>
                <select class="resolve-select" onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === "__new__") { createAndAssignChar(i, plan.povCharacterId); } else if (v) { resolveSceneChar(i, v); } }}>
                  <option value="">Map to...</option>
                  {#each bibleCharacters as c (c.id)}
                    <option value={c.id}>{c.name} ({c.role})</option>
                  {/each}
                  <option value="__new__">+ New "{plan.povCharacterId}"</option>
                </select>
              </div>
            {/if}
            <div class="accepted-card-detail"><span class="review-label">Goal:</span> {plan.narrativeGoal || "—"}</div>
            <div class="accepted-card-detail"><span class="review-label">Beat:</span> {plan.emotionalBeat || "—"}</div>
            <div class="accepted-card-detail"><span class="review-label">Words:</span> {plan.estimatedWordCount[0]}–{plan.estimatedWordCount[1]}</div>
            {#if !locOk}
              <div class="resolve-row">
                <span class="resolve-warn">Location: "{plan.locationId}" not in brief</span>
                <select class="resolve-select" onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === "__new__") { createAndAssignLoc(i, plan.locationId ?? "New Location"); } else { resolveSceneLoc(i, v); } }}>
                  <option value="">Map to...</option>
                  {#each bibleLocations as l (l.id)}
                    <option value={l.id}>{l.name}</option>
                  {/each}
                  <option value="__new__">+ New "{plan.locationId}"</option>
                </select>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if currentArc}
      <div class="preview-arc">
        <span class="review-label">Essay Arc:</span> {currentArc.workingTitle}
      </div>
    {/if}

    <div class="complete-actions">
      <Button size="sm" onclick={handleAddMore}>+ Add Another Section</Button>
    </div>
  </div>
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

  /* ─── Progress ────────────────────────── */
  .progress-header { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
  .progress-label { font-size: 12px; color: var(--text-primary); font-weight: 500; white-space: nowrap; }
  .progress-bar {
    flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; background: var(--accent); border-radius: 2px;
    transition: width 0.3s ease;
  }

  /* ─── Form summary ────────────────────── */
  .form-summary {
    font-size: 11px; color: var(--text-secondary); padding: 4px 8px;
    background: var(--bg-card); border-radius: var(--radius-sm);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .summary-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

  /* ─── Review card ─────────────────────── */
  .review-card {
    display: flex; flex-direction: column; gap: 6px; padding: 12px;
    border: 1px solid var(--border); border-radius: var(--radius-md);
    background: var(--bg-card); margin-top: 8px;
  }
  .review-card-warn { border-color: var(--warning); }
  .review-card-title { font-size: 13px; color: var(--text-primary); font-weight: 500; }
  .review-card-detail { font-size: 11px; color: var(--text-secondary); }
  .review-card-section { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
  .review-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
  .chunk-list { margin: 2px 0 0 16px; padding: 0; font-size: 11px; color: var(--text-secondary); }
  .chunk-list li { margin-bottom: 2px; }

  /* ─── Review actions ──────────────────── */
  .review-actions { display: flex; gap: 6px; margin-top: 10px; }

  /* ─── Accepted sidebar ────────────────── */
  .accepted-sidebar { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border); }
  .accepted-mini {
    font-size: 11px; color: var(--text-secondary); padding: 3px 0;
  }

  /* ─── Complete phase ──────────────────── */
  .complete-summary {
    font-size: 12px; color: var(--text-primary); font-weight: 500; padding: 8px 0;
  }
  .accepted-list { display: flex; flex-direction: column; gap: 8px; }
  .accepted-card {
    display: flex; flex-direction: column; gap: 4px; padding: 10px;
    border: 1px solid var(--accent-dim); border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  .accepted-card-warn { border-color: var(--warning); }
  .accepted-card-title { font-size: 12px; color: var(--text-primary); font-weight: 500; }
  .accepted-card-detail { font-size: 10px; color: var(--text-secondary); }
  .preview-arc { padding: 6px 0; font-size: 11px; color: var(--text-secondary); }
  .complete-actions { display: flex; gap: 6px; margin-top: 10px; }

  /* ─── Resolution rows ─────────────────── */
  .resolve-row {
    display: flex; flex-direction: column; gap: 3px; padding: 4px 6px; margin: 2px -6px;
    background: color-mix(in srgb, var(--warning) 8%, transparent);
    border-radius: var(--radius-sm); border-left: 2px solid var(--warning);
  }
  .resolve-warn { font-size: 10px; color: var(--warning); }
  .resolve-select {
    font-size: 10px; font-family: var(--font-mono); padding: 2px 4px;
    background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-primary); cursor: pointer;
  }
  .resolve-select:focus { outline: none; border-color: var(--accent); }
</style>
