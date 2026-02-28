<script lang="ts">
import { untrack } from "svelte";
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../../../gates/index.js";
import { analyzeEdits } from "../../../learner/diff.js";
import { applyProposal, type BibleProposal } from "../../../learner/proposals.js";
import { generateTuningProposals, type TuningProposal } from "../../../learner/tuning.js";
import { callLLM } from "../../../llm/client.js";
import { computeStyleDriftFromProse } from "../../../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../../../metrics/voiceSeparability.js";
import type { ChunkView, EditorialAnnotation, LLMReviewClient, ReviewOrchestrator } from "../../../review/index.js";
import { createReviewOrchestrator, REVIEW_OUTPUT_SCHEMA } from "../../../review/index.js";
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
    const promise = callLLM(
      systemPrompt,
      userPrompt,
      REVIEW_MODEL,
      REVIEW_MAX_TOKENS,
      REVIEW_OUTPUT_SCHEMA as Record<string, unknown>,
    );
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      promise.then(resolve, reject);
    });
  },
};

// Dismissed fingerprints (persisted per-project in localStorage)
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
  const key = `review-dismissed:${store.project?.id ?? "default"}`;
  localStorage.setItem(key, JSON.stringify([...dismissed]));
}

let dismissed = $state(loadDismissed());
let chunkAnnotations = $state(new Map<number, EditorialAnnotation[]>());
let orchestrator = $state<ReviewOrchestrator | null>(null);

// Recreate orchestrator when bible or scene changes
$effect(() => {
  // Read dependencies explicitly
  const bible = store.bible;
  const scenePlan = store.activeScenePlan;

  // Cleanup previous orchestrator — untrack to avoid read→write loop
  untrack(() => {
    orchestrator?.cancelAll();
    chunkAnnotations = new Map();
  });

  if (!bible || !scenePlan) {
    orchestrator = null;
    return;
  }

  orchestrator = createReviewOrchestrator(
    bible,
    scenePlan,
    () => dismissed,
    llmReviewClient,
    (chunkIndex, anns) => {
      chunkAnnotations = new Map(chunkAnnotations).set(chunkIndex, anns);
    },
  );
});

// Trigger review when chunks change
$effect(() => {
  const chunks = store.activeSceneChunks;
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId || chunks.length === 0) return;
  // Read orchestrator inside untrack — we only want to react to chunk changes
  const orch = untrack(() => orchestrator);
  if (!orch) return;
  const timeout = setTimeout(() => {
    const views: ChunkView[] = chunks.map((c, i) => ({
      index: i,
      text: getCanonicalText(c),
      sceneId: sceneId,
    }));
    orch.requestReview(views);
  }, 1000);
  return () => clearTimeout(timeout);
});

function handleAcceptSuggestion(_annotationId: string) {
  // The AnnotatedEditor handles text replacement; we just need to trigger re-review
  // which will happen automatically through chunk text change → $effect above
}

function handleDismissAnnotation(annotationId: string) {
  // Find the annotation's fingerprint and add to dismissed set
  for (const [, anns] of chunkAnnotations) {
    const ann = anns.find((a) => a.id === annotationId);
    if (ann) {
      dismissed = new Set(dismissed).add(ann.fingerprint);
      saveDismissed(dismissed);
      // Remove from current annotations immediately
      const updated = new Map(chunkAnnotations);
      for (const [idx, chunkAnns] of updated) {
        updated.set(
          idx,
          chunkAnns.filter((a) => a.fingerprint !== ann.fingerprint),
        );
      }
      chunkAnnotations = updated;
      break;
    }
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
        {canGenerate}
        {gateMessages}
        auditFlags={store.auditFlags}
        sceneIR={store.activeSceneIR}
        isExtractingIR={store.isExtractingIR}
        {chunkAnnotations}
        onGenerate={onGenerate}
        onUpdateChunk={handleUpdateChunk}
        onRemoveChunk={handleRemoveChunk}
        onRunAudit={onRunAudit}
        onRunDeepAudit={onRunDeepAudit}
        onCompleteScene={handleCompleteScene}
        onAutopilot={onAutopilot}
        onCancelAutopilot={() => store.cancelAutopilot()}
        onOpenIRInspector={() => { activeTab = "ir"; }}
        onExtractIR={() => onExtractIR()}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissAnnotation={handleDismissAnnotation}
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
