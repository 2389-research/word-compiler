<script lang="ts">
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../gates/index.js";
import { computeStyleDriftFromProse } from "../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../metrics/voiceSeparability.js";
import type { Chunk, StyleDriftReport, VoiceSeparabilityReport } from "../types/index.js";
import { getCanonicalText } from "../types/index.js";
import BiblePane from "./components/BiblePane.svelte";
import BootstrapModal from "./components/BootstrapModal.svelte";
import ChapterArcEditor from "./components/ChapterArcEditor.svelte";
import CompilerView from "./components/CompilerView.svelte";
import DraftingDesk from "./components/DraftingDesk.svelte";
import ForwardSimulator from "./components/ForwardSimulator.svelte";
import IRInspector from "./components/IRInspector.svelte";
import SceneSequencer from "./components/SceneSequencer.svelte";
import StyleDriftPanel from "./components/StyleDriftPanel.svelte";
import VoiceSeparabilityView from "./components/VoiceSeparabilityView.svelte";
import { Button, ErrorBanner, Select, Tabs } from "./primitives/index.js";
import { createGenerationActions, setupCompilerEffect, store } from "./store/index.svelte.js";
import { theme } from "./store/theme.svelte.js";

// Set up compiler auto-recompile effect
setupCompilerEffect(store);

// Create generation action handlers
const { generateChunk, runAuditManual, extractSceneIR } = createGenerationActions(store);

// ─── Local UI state ─────────────────────────────
let showArcEditor = $state(false);
let activeTab = $state<"compiler" | "ir" | "simulator" | "drift" | "voice">("compiler");

const tabItems = [
  { id: "compiler", label: "Compiler" },
  { id: "ir", label: "IR Inspector" },
  { id: "simulator", label: "Forward Sim" },
  { id: "drift", label: "Style Drift" },
  { id: "voice", label: "Voice Sep" },
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

// Forward simulator scene nodes (include IRs)
let simulatorScenes = $derived(
  store.scenes.map((s) => ({
    plan: s.plan,
    ir: store.sceneIRs[s.plan.id] ?? null,
    sceneOrder: s.sceneOrder,
  })),
);

// Style drift reports (computed across completed scenes)
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
    const report = computeStyleDriftFromProse(baselineId, baselineProse, scene.plan.id, prose);
    reports.push(report);
  }
  return reports;
});

let baselineSceneTitle = $derived(store.scenes.find((s) => s.status === "complete")?.plan.title ?? "Scene 1");

// Voice separability (computed across all scene prose)
let voiceReport = $derived.by((): VoiceSeparabilityReport | null => {
  if (!store.bible || store.bible.characters.length < 2) return null;
  const allProse = store.scenes
    .map((s) => (store.sceneChunks[s.plan.id] ?? []).map((c) => getCanonicalText(c)).join("\n\n"))
    .filter(Boolean)
    .join("\n\n");
  if (!allProse) return null;
  return measureVoiceSeparability(allProse, store.bible);
});

// ─── Handlers ──────────────────────────────────
function handleUpdateChunk(index: number, changes: Partial<Chunk>) {
  store.updateChunk(index, changes);
}

function handleRemoveChunk(index: number) {
  store.removeChunk(index);
}

function handleCompleteScene() {
  if (store.activeScenePlan) {
    store.completeScene(store.activeScenePlan.id);
  }
}

function handleResolveFlag(flagId: string, action: string) {
  store.resolveAuditFlag(flagId, action, true);
}

function handleDismissFlag(flagId: string) {
  store.dismissAuditFlag(flagId);
}

function handleVerifyIR() {
  if (store.activeScenePlan) {
    store.verifySceneIR(store.activeScenePlan.id);
  }
}

function handleUpdateIR(ir: import("../types/index.js").NarrativeIR) {
  if (store.activeScenePlan) {
    store.setSceneIR(store.activeScenePlan.id, ir);
  }
}
</script>

<div class="app">
  <div class="app-header">
    <span class="app-title">Word Compiler</span>
    <div class="header-right">
      {#if store.chapterArc}
        <Button size="sm" onclick={() => { showArcEditor = true; }}>Chapter Arc</Button>
      {/if}
      <label class="model-selector">
        Model:
        <Select
          value={store.compilationConfig.defaultModel}
          onchange={(e) => store.selectModel((e.target as HTMLSelectElement).value)}
        >
          {#if store.availableModels.length > 0}
            {#each store.availableModels as m (m.id)}
              <option value={m.id}>{m.label} ({(m.contextWindow / 1000).toFixed(0)}k ctx, {(m.maxOutput / 1000).toFixed(0)}k out)</option>
            {/each}
          {:else}
            <option value={store.compilationConfig.defaultModel}>{store.compilationConfig.defaultModel}</option>
          {/if}
        </Select>
      </label>
      <Button size="sm" onclick={() => theme.toggle()} title="Toggle dark/light theme">
        {theme.current === "dark" ? "Light" : "Dark"}
      </Button>
      <span class="app-status">
        {store.bible ? `Bible v${store.bible.version}` : "No bible"} |
        {store.activeScenePlan ? `Scene: ${store.activeScenePlan.title}` : "No scene plan"} |
        Chunks: {store.activeSceneChunks.length}{store.activeScenePlan ? `/${store.activeScenePlan.chunkCount}` : ""}
      </span>
    </div>
  </div>

  {#if store.error}
    <div class="error-margin">
      <ErrorBanner message={store.error} onDismiss={() => store.setError(null)} />
    </div>
  {/if}

  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
  />

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id as typeof activeTab; }} />

  <div class="cockpit">
    <BiblePane {store} onBootstrap={() => store.setBootstrapOpen(true)} />
    <DraftingDesk
      chunks={store.activeSceneChunks}
      scenePlan={store.activeScenePlan}
      sceneStatus={store.activeScene?.status ?? null}
      isGenerating={store.isGenerating}
      {canGenerate}
      {gateMessages}
      auditFlags={store.auditFlags}
      sceneIR={store.activeSceneIR}
      isExtractingIR={store.isExtractingIR}
      onGenerate={generateChunk}
      onUpdateChunk={handleUpdateChunk}
      onRemoveChunk={handleRemoveChunk}
      onRunAudit={runAuditManual}
      onCompleteScene={handleCompleteScene}
      onOpenIRInspector={() => { activeTab = 'ir'; }}
      onExtractIR={extractSceneIR}
    />

    <!-- Right panel: tabbed Phase 2 views -->
    {#if activeTab === "compiler"}
      <CompilerView
        payload={store.compiledPayload}
        log={store.compilationLog}
        lintResult={store.lintResult}
        auditFlags={store.auditFlags}
        metrics={store.metrics}
        onResolveFlag={handleResolveFlag}
        onDismissFlag={handleDismissFlag}
      />
    {:else if activeTab === "ir"}
      <IRInspector
        ir={store.activeSceneIR}
        sceneTitle={store.activeScenePlan?.title ?? "No scene"}
        isExtracting={store.isExtractingIR}
        canExtract={store.activeScene?.status === "complete"}
        onExtract={extractSceneIR}
        onVerify={handleVerifyIR}
        onUpdate={handleUpdateIR}
        onClose={() => { activeTab = 'compiler'; }}
      />
    {:else if activeTab === "simulator"}
      <ForwardSimulator
        scenes={simulatorScenes}
        activeSceneIndex={store.activeSceneIndex}
        onSelectScene={(i) => store.setActiveScene(i)}
      />
    {:else if activeTab === "drift"}
      <StyleDriftPanel reports={styleDriftReports} {baselineSceneTitle} />
    {:else if activeTab === "voice"}
      <VoiceSeparabilityView report={voiceReport} />
    {/if}
  </div>

  <BootstrapModal {store} />

  {#if showArcEditor && store.chapterArc}
    <ChapterArcEditor arc={store.chapterArc} {store} onClose={() => { showArcEditor = false; }} />
  {/if}
</div>

<style>
  .header-right { display: flex; align-items: center; gap: 12px; }
  .model-selector {
    display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary);
  }
  .error-margin { margin: 0 8px; }
</style>
