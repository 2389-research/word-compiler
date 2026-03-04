<script lang="ts">
import { untrack } from "svelte";
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../../../gates/index.js";
import { analyzeEdits } from "../../../learner/diff.js";
import { applyProposal, type BibleProposal } from "../../../learner/proposals.js";
import { generateTuningProposals, type TuningProposal } from "../../../learner/tuning.js";
import { callLLM } from "../../../llm/client.js";
import { computeStyleDriftFromProse } from "../../../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../../../metrics/voiceSeparability.js";
import { buildReviewContext } from "../../../review/contextBuilder.js";
import type { ChunkView, EditorialAnnotation, LLMReviewClient, ReviewOrchestrator } from "../../../review/index.js";
import {
  buildSuggestionRequestPrompt,
  createReviewOrchestrator,
  REVIEW_OUTPUT_SCHEMA,
  SUGGESTION_REQUEST_SCHEMA,
  trimSuggestionOverlap,
} from "../../../review/index.js";
import type { Chunk, NarrativeIR, StyleDriftReport, VoiceSeparabilityReport } from "../../../types/index.js";
import { getCanonicalText } from "../../../types/index.js";
import { Tabs } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import CompilerView from "../CompilerView.svelte";
import DraftingDesk from "../DraftingDesk.svelte";
import IRInspector from "../IRInspector.svelte";
import SceneAuthoringModal from "../SceneAuthoringModal.svelte";
import SceneSequencer from "../SceneSequencer.svelte";
import SetupPayoffPanel from "../SetupPayoffPanel.svelte";
import StyleDriftPanel from "../StyleDriftPanel.svelte";
import VoiceSeparabilityView from "../VoiceSeparabilityView.svelte";

let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
} = $props();

// ─── Editorial Review ───────────────────────────
const REVIEW_MODEL = "claude-sonnet-4-6";
const REVIEW_MAX_TOKENS = 2048;

const llmReviewClient: LLMReviewClient = {
  review(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string> {
    return callLLM(
      systemPrompt,
      userPrompt,
      REVIEW_MODEL,
      REVIEW_MAX_TOKENS,
      REVIEW_OUTPUT_SCHEMA as Record<string, unknown>,
      signal,
    );
  },
};

// ─── Persistence helpers ─────────────────────────
function loadDismissed(): Set<string> {
  try {
    const key = `review-dismissed:${store.project?.id ?? "default"}`;
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>) {
  try {
    const key = `review-dismissed:${store.project?.id ?? "default"}`;
    localStorage.setItem(key, JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage failures; dismissed state just won't persist.
  }
}

function loadAnnotations(sceneId: string): Map<number, EditorialAnnotation[]> {
  try {
    const key = `review-annotations:${store.project?.id ?? "default"}:${sceneId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [number, EditorialAnnotation[]][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveAnnotations(sceneId: string, anns: Map<number, EditorialAnnotation[]>) {
  try {
    const key = `review-annotations:${store.project?.id ?? "default"}:${sceneId}`;
    localStorage.setItem(key, JSON.stringify([...anns]));
  } catch {
    // Ignore storage failures; annotations just won't persist.
  }
}

// ─── Reactive state ──────────────────────────────
let dismissed = $state(loadDismissed());
let chunkAnnotations = $state(new Map<number, EditorialAnnotation[]>());
let reviewingChunks = $state(new Set<number>());
let orchestrator = $state<ReviewOrchestrator | null>(null);
// Bumped to force orchestrator recreation (e.g. after chunk destruction
// invalidates the orchestrator's index-keyed internal state).
let orchestratorVersion = $state(0);

// Reload dismissed set when project changes
$effect(() => {
  const _projectId = store.project?.id;
  dismissed = loadDismissed();
});

// Recreate orchestrator when bible, scene, or version changes
$effect(() => {
  // Read dependencies explicitly
  const bible = store.bible;
  const scenePlan = store.activeScenePlan;
  const _version = orchestratorVersion;

  // Cleanup previous orchestrator — untrack to avoid read→write loop
  untrack(() => {
    orchestrator?.cancelAll();
    reviewingChunks = new Set();
    prevChunkCount = 0;
    clearTimeout(autoReviewTimeout);
  });

  if (!bible || !scenePlan) {
    orchestrator = null;
    chunkAnnotations = new Map();
    return;
  }

  // Load persisted annotations for this scene (survives page refresh).
  // Filter through dismissed set so dismissed annotations don't reappear.
  const loaded = loadAnnotations(scenePlan.id);
  for (const [idx, anns] of loaded) {
    const filtered = anns.filter((a) => !dismissed.has(a.fingerprint));
    if (filtered.length > 0) loaded.set(idx, filtered);
    else loaded.delete(idx);
  }
  chunkAnnotations = loaded;

  orchestrator = createReviewOrchestrator(
    bible,
    scenePlan,
    () => dismissed,
    llmReviewClient,
    (chunkIndex, anns, reviewedText) => {
      // Discard stale annotations: if the chunk text has changed since the
      // review was initiated (e.g., user accepted a suggestion while the LLM
      // was still processing), the charRanges are against the old text.
      const currentChunk = store.activeSceneChunks[chunkIndex];
      if (currentChunk && getCanonicalText(currentChunk) !== reviewedText) return;
      chunkAnnotations = new Map(chunkAnnotations).set(chunkIndex, anns);
      // Persist to localStorage so annotations survive refresh
      if (scenePlan) saveAnnotations(scenePlan.id, chunkAnnotations);
    },
    (reviewing) => {
      reviewingChunks = reviewing;
    },
  );
});

// Auto-review fires ONLY when a new chunk appears (count increases).
// Text edits, status changes, and note updates are invisible to this effect.
// The author works through suggestions at their own pace, then clicks "Re-review".
//
// IMPORTANT: The timeout lives in a module-level variable, NOT returned as an
// effect cleanup. This prevents a race condition: when store.activeSceneChunks
// changes reference (e.g. status update on existing chunk), the effect re-runs,
// but count hasn't changed so it early-returns. If the timeout were in cleanup,
// it would be cancelled by that re-run, silently dropping the pending review.
let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
let prevChunkCount = 0;

$effect(() => {
  const count = store.activeSceneChunks.length;
  const sceneId = store.activeScenePlan?.id;
  const generating = store.isGenerating;
  if (!sceneId || count === 0 || count <= prevChunkCount || generating) {
    if (!generating) prevChunkCount = count;
    return;
  }
  prevChunkCount = count;
  const orch = untrack(() => orchestrator);
  if (!orch) return;
  const chunks = untrack(() => store.activeSceneChunks);
  clearTimeout(autoReviewTimeout);
  autoReviewTimeout = setTimeout(() => {
    const views: ChunkView[] = chunks
      .map((c, i) => ({ chunk: c, index: i }))
      .filter(({ chunk }) => chunk.status !== "accepted")
      .map(({ chunk, index }) => ({
        index,
        text: getCanonicalText(chunk),
        sceneId: sceneId,
      }));
    if (views.length > 0) orch.requestReview(views);
  }, 1500);
});

function handleReviewChunk(index: number) {
  const chunks = store.activeSceneChunks;
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId || !orchestrator || index >= chunks.length) return;
  const chunk = chunks[index]!;
  if (chunk.status === "accepted") return;
  const view: ChunkView = { index, text: getCanonicalText(chunk), sceneId };
  orchestrator.requestReview([view], true);
}

function handleAcceptSuggestion(_annotationId: string) {
  // Text replacement handled by AnnotatedEditor via PM transaction.
  // No auto-re-review — author works through suggestions at their own pace.
}

function handleDismissAnnotation(annotationId: string) {
  // Persist the fingerprint to the dismissed set so future reviews exclude it.
  // The decoration is already removed in AnnotatedEditor via PM transaction —
  // we intentionally do NOT modify chunkAnnotations here because that would
  // trigger the Sync Annotations effect with stale charRanges (same corruption
  // class as the accept bug). Same-fingerprint annotations on other chunks
  // remain visible until the next re-review, which is the safer trade-off.
  const sceneId = store.activeScenePlan?.id;
  for (const [, anns] of chunkAnnotations) {
    const ann = anns.find((a) => a.id === annotationId);
    if (ann) {
      dismissed = new Set(dismissed).add(ann.fingerprint);
      saveDismissed(dismissed);
      break;
    }
  }
  // Persist annotation removal to localStorage
  if (sceneId) saveAnnotations(sceneId, chunkAnnotations);
}

const SUGGESTION_MAX_TOKENS = 1024;

async function handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null> {
  // 1. Find the annotation and its chunk index
  let targetAnnotation: EditorialAnnotation | undefined;
  let targetChunkIndex: number | undefined;
  for (const [chunkIndex, anns] of chunkAnnotations) {
    const ann = anns.find((a) => a.id === annotationId);
    if (ann) {
      targetAnnotation = ann;
      targetChunkIndex = chunkIndex;
      break;
    }
  }
  if (!targetAnnotation || targetChunkIndex === undefined) return null;

  // 2. Get chunk text and build context
  const chunks = store.activeSceneChunks;
  const chunk = chunks[targetChunkIndex];
  if (!chunk || !store.bible || !store.activeScenePlan) return null;
  const chunkText = getCanonicalText(chunk);
  const context = buildReviewContext(store.bible, store.activeScenePlan);

  // 3. Build prompt and call LLM
  const { systemPrompt, userPrompt } = buildSuggestionRequestPrompt(context, targetAnnotation, chunkText, feedback);

  try {
    const rawJson = await callLLM(
      systemPrompt,
      userPrompt,
      REVIEW_MODEL,
      SUGGESTION_MAX_TOKENS,
      SUGGESTION_REQUEST_SCHEMA as Record<string, unknown>,
    );

    // 4. Parse and validate
    const parsed = JSON.parse(rawJson);
    if (!parsed.suggestion || typeof parsed.suggestion !== "string" || parsed.suggestion.trim().length === 0) {
      return null;
    }

    // 4b. Trim suggestion overlap — catch cases where the LLM rewrites beyond the focus span
    const prefixText = chunkText.slice(0, targetAnnotation.charRange.start);
    const suffixText = chunkText.slice(targetAnnotation.charRange.end);
    parsed.suggestion = trimSuggestionOverlap(parsed.suggestion, prefixText, suffixText);

    // 5. Update annotation in chunkAnnotations
    const updatedAnns = (chunkAnnotations.get(targetChunkIndex) ?? []).map((a) =>
      a.id === annotationId ? { ...a, suggestion: parsed.suggestion } : a,
    );
    chunkAnnotations = new Map(chunkAnnotations).set(targetChunkIndex, updatedAnns);

    // 6. Persist
    const sceneId = store.activeScenePlan?.id;
    if (sceneId) saveAnnotations(sceneId, chunkAnnotations);

    return parsed.suggestion;
  } catch (err) {
    console.warn("[editorial] Suggestion generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Local UI state ─────────────────────────────
let activeTab = $state<"compiler" | "drift" | "voice" | "setups" | "ir">("compiler");

const tabItems = [
  { id: "compiler", label: "Draft Engine" },
  { id: "drift", label: "Voice Consistency" },
  { id: "voice", label: "Character Voices" },
  { id: "setups", label: "Setups" },
  { id: "ir", label: "IR" },
];

// ─── Derived values (moved from App.svelte) ─────
let canGenerate = $derived(!!store.bible && !!store.activeScenePlan && !!store.compiledPayload);

let gateMessages = $derived.by(() => {
  const msgs: string[] = [];
  if (!store.bible) msgs.push("No bible loaded.");
  if (!store.activeScenePlan) msgs.push("No scene plan selected.");
  if (store.activeScenePlan) {
    const planGate = checkScenePlanGate(store.activeScenePlan);
    msgs.push(...planGate.messages);
  }
  if (store.lintResult) {
    const compileGate = checkCompileGate(store.lintResult);
    msgs.push(...compileGate.messages);
  }
  if (store.activeSceneChunks.length > 0) {
    const lastChunk = store.activeSceneChunks[store.activeSceneChunks.length - 1]!;
    const reviewGate = checkChunkReviewGate(lastChunk);
    msgs.push(...reviewGate.messages);
  }
  return msgs;
});

let styleDriftReports = $derived.by((): StyleDriftReport[] => {
  if (!store.bible) return [];
  const completedScenes = store.scenes.filter((s) => s.status === "complete");
  if (completedScenes.length < 2) return [];
  const reports: StyleDriftReport[] = [];
  const baselineId = completedScenes[0]!.plan.id;
  const baselineChunks = store.sceneChunks[baselineId] ?? [];
  if (baselineChunks.length === 0) return [];
  const baselineProse = baselineChunks.map((c) => getCanonicalText(c)).join("\n\n");
  for (let i = 1; i < completedScenes.length; i++) {
    const scene = completedScenes[i]!;
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    if (chunks.length === 0) continue;
    const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
    reports.push(computeStyleDriftFromProse(baselineId, baselineProse, scene.plan.id, prose));
  }
  return reports;
});

let baselineSceneTitle = $derived(store.scenes.find((s) => s.status === "complete")?.plan.title ?? "Scene 1");
let sceneTitles = $derived(Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])));

let voiceReport = $derived.by((): VoiceSeparabilityReport | null => {
  if (!store.bible || store.bible.characters.length < 2) return null;
  const sceneTexts = store.scenes
    .map((s) => ({
      sceneId: s.plan.id,
      prose: (store.sceneChunks[s.plan.id] ?? []).map((c) => getCanonicalText(c)).join("\n\n"),
    }))
    .filter((s) => s.prose.length > 0);
  if (sceneTexts.length === 0) return null;
  return measureVoiceSeparability(sceneTexts, store.bible);
});

// ─── Handlers ───────────────────────────────────
let editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function handleUpdateChunk(index: number, changes: Partial<Chunk>) {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  store.updateChunkForScene(sceneId, index, changes);
  if (changes.editedText !== undefined || changes.humanNotes !== undefined) {
    const key = `${sceneId}:${index}`;
    const existing = editDebounceTimers.get(key);
    if (existing) clearTimeout(existing);
    editDebounceTimers.set(
      key,
      setTimeout(() => {
        commands.persistChunk(sceneId, index);
        editDebounceTimers.delete(key);
      }, 500),
    );
  } else {
    commands.persistChunk(sceneId, index);
  }
}

function handleRemoveChunk(index: number) {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  commands.removeChunk(sceneId, index);
}

async function handleDestroyChunk(index: number) {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  const chunks = store.activeSceneChunks;
  const isLast = index === chunks.length - 1;

  if (!isLast) {
    const count = chunks.length - index;
    const ok = window.confirm(
      `Delete chunk ${index + 1} and ${count - 1} later chunk${count - 1 > 1 ? "s" : ""} that depend on it?`,
    );
    if (!ok) return;
  }

  // ── Cancel everything that references chunk indices ──

  // 1. Stop autopilot — it would generate into a broken state
  if (store.isAutopilot) store.cancelAutopilot();

  // 2. Cancel pending auto-review (against the old chunk array)
  clearTimeout(autoReviewTimeout);

  // 3. Cancel in-flight LLM reviews and clear reviewing indicators
  orchestrator?.cancelAll();

  // 4. Flush edit debounce timers for destroyed indices
  for (let i = index; i < chunks.length; i++) {
    const key = `${sceneId}:${i}`;
    const timer = editDebounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      editDebounceTimers.delete(key);
    }
  }

  // 5. Clear persisted annotations (indices are now stale)
  saveAnnotations(sceneId, new Map());
  chunkAnnotations = new Map();

  // ── Remove chunks from end backward to avoid index shifting ──
  for (let i = chunks.length - 1; i >= index; i--) {
    await commands.removeChunk(sceneId, i);
  }

  // 6. Force orchestrator recreation with clean internal state.
  //    The effect will create a fresh orchestrator (empty lastReviewedText,
  //    empty annotations), reset prevChunkCount to 0, and auto-review will
  //    fire for all remaining chunks after its 1.5s delay.
  orchestratorVersion++;
}

async function handleCompleteScene() {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  const result = await commands.completeScene(sceneId);
  if (result.ok) onExtractIR(sceneId);
}

async function handleVerifyIR() {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.verifySceneIR(sceneId);
}

async function handleUpdateIR(ir: NarrativeIR) {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.saveSceneIR(sceneId, ir);
}
</script>

<div class="draft-stage">
  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
    onAddScene={() => store.setSceneAuthoringOpen(true)}
  />

  <div class="draft-columns">
    <div class="draft-main">
      <DraftingDesk
        chunks={store.activeSceneChunks}
        scenePlan={store.activeScenePlan}
        sceneStatus={store.activeScene?.status ?? null}
        isGenerating={store.isGenerating}
        isAutopilot={store.isAutopilot}
        isAuditing={store.isAuditing}
        {canGenerate}
        {gateMessages}
        auditFlags={store.auditFlags}
        sceneIR={store.activeSceneIR}
        isExtractingIR={store.isExtractingIR}
        {chunkAnnotations}
        {reviewingChunks}
        onGenerate={onGenerate}
        onUpdateChunk={handleUpdateChunk}
        onRemoveChunk={handleRemoveChunk}
        onDestroyChunk={handleDestroyChunk}
        onRunAudit={onRunAudit}
        onRunDeepAudit={onRunDeepAudit}
        onCompleteScene={handleCompleteScene}
        onAutopilot={onAutopilot}
        onCancelAutopilot={() => store.cancelAutopilot()}
        onOpenIRInspector={() => { activeTab = "ir"; }}
        onExtractIR={() => onExtractIR()}
        onReviewChunk={handleReviewChunk}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissAnnotation={handleDismissAnnotation}
        onRequestSuggestion={handleRequestSuggestion}
      />
    </div>

    <div class="draft-sidebar">
      <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id as typeof activeTab; }} />
      <div class="sidebar-content">
        {#if activeTab === "compiler"}
          <CompilerView
            payload={store.compiledPayload}
            log={store.compilationLog}
            lintResult={store.lintResult}
            auditFlags={store.auditFlags}
            metrics={store.metrics}
            onResolveFlag={async (flagId, action) => { await commands.resolveAuditFlag(flagId, action, true); }}
            onDismissFlag={async (flagId) => { await commands.dismissAuditFlag(flagId); }}
          />
        {:else if activeTab === "drift"}
          <StyleDriftPanel reports={styleDriftReports} {baselineSceneTitle} {sceneTitles} />
        {:else if activeTab === "voice"}
          <VoiceSeparabilityView report={voiceReport} />
        {:else if activeTab === "setups"}
          <SetupPayoffPanel sceneIRs={store.sceneIRs} {sceneTitles} sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))} />
        {:else if activeTab === "ir"}
          <IRInspector
            ir={store.activeSceneIR}
            sceneTitle={store.activeScenePlan?.title ?? "No scene"}
            isExtracting={store.isExtractingIR}
            canExtract={store.activeScene?.status === "complete"}
            onExtract={() => onExtractIR(store.activeScenePlan?.id)}
            onVerify={handleVerifyIR}
            onUpdate={handleUpdateIR}
            onClose={() => { activeTab = "compiler"; }}
          />
        {/if}
      </div>
    </div>
  </div>

  <SceneAuthoringModal {store} {commands} />
</div>

<style>
  .draft-stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .draft-columns {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 1px;
    background: var(--border);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .draft-main {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .draft-sidebar {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
