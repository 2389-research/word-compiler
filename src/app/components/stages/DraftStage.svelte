<script lang="ts">
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../../../gates/index.js";
import type { NarrativeIR } from "../../../types/index.js";
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
import { createDraftStageController } from "./draftStageController.svelte.js";
import { createDraftStageMetrics } from "./draftStageMetrics.svelte.js";

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

// ─── Controller (editorial review, chunk handlers, timer lifecycle) ──
const controller = createDraftStageController(store, commands);

$effect(() => {
  return () => controller.dispose();
});

// ─── Metrics ────────────────────────────────────
const metrics = createDraftStageMetrics(store);

// ─── Local UI state ─────────────────────────────
let activeTab = $state<"compiler" | "drift" | "voice" | "setups" | "ir">("compiler");

const tabItems = [
  { id: "compiler", label: "Draft Engine" },
  { id: "drift", label: "Voice Consistency" },
  { id: "voice", label: "Character Voices" },
  { id: "setups", label: "Setups" },
  { id: "ir", label: "IR" },
];

// ─── Derived values ─────────────────────────────
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

// ─── Handlers ───────────────────────────────────
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
        chunkAnnotations={controller.chunkAnnotations}
        reviewingChunks={controller.reviewingChunks}
        onGenerate={onGenerate}
        onCancelGeneration={() => store.cancelGeneration()}
        onUpdateChunk={controller.handleUpdateChunk}
        onRemoveChunk={controller.handleRemoveChunk}
        onDestroyChunk={controller.handleDestroyChunk}
        onRunAudit={onRunAudit}
        onRunDeepAudit={onRunDeepAudit}
        onCompleteScene={handleCompleteScene}
        onAutopilot={onAutopilot}
        onCancelAutopilot={() => store.cancelAutopilot()}
        onOpenIRInspector={() => { activeTab = "ir"; }}
        onExtractIR={() => onExtractIR()}
        onReviewChunk={controller.handleReviewChunk}
        onAcceptSuggestion={() => {}}
        onDismissAnnotation={controller.handleDismissAnnotation}
        onRequestSuggestion={controller.handleRequestSuggestion}
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
          <StyleDriftPanel reports={metrics.styleDriftReports} baselineSceneTitle={metrics.baselineSceneTitle} sceneTitles={metrics.sceneTitles} />
        {:else if activeTab === "voice"}
          <VoiceSeparabilityView report={metrics.voiceReport} />
        {:else if activeTab === "setups"}
          <SetupPayoffPanel sceneIRs={store.sceneIRs} sceneTitles={metrics.sceneTitles} sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))} />
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
