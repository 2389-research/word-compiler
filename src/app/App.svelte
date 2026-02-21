<script lang="ts">
import { onMount } from "svelte";
import { apiCreateProject } from "../api/client.js";
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../gates/index.js";
import { computeStyleDriftFromProse } from "../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../metrics/voiceSeparability.js";
import { countTokens } from "../tokens/index.js";
import type { Chunk, StyleDriftReport, VoiceSeparabilityReport } from "../types/index.js";
import { generateId, getCanonicalText } from "../types/index.js";
import BibleAuthoringModal from "./components/BibleAuthoringModal.svelte";
import BiblePane from "./components/BiblePane.svelte";
import BootstrapModal from "./components/BootstrapModal.svelte";
import ChapterArcEditor from "./components/ChapterArcEditor.svelte";
import CompilerView from "./components/CompilerView.svelte";
import DraftingDesk from "./components/DraftingDesk.svelte";
import ForwardSimulator from "./components/ForwardSimulator.svelte";
import IRInspector from "./components/IRInspector.svelte";
import SceneAuthoringModal from "./components/SceneAuthoringModal.svelte";
import SceneSequencer from "./components/SceneSequencer.svelte";
import SetupPayoffPanel from "./components/SetupPayoffPanel.svelte";
import StyleDriftPanel from "./components/StyleDriftPanel.svelte";
import VoiceSeparabilityView from "./components/VoiceSeparabilityView.svelte";
import { Button, ErrorBanner, Select, Tabs } from "./primitives/index.js";
import {
  createApiActions,
  createCommands,
  createGenerationActions,
  initializeApp,
  setupCompilerEffect,
  store,
} from "./store/index.svelte.js";
import { theme } from "./store/theme.svelte.js";

// Set up compiler auto-recompile effect
setupCompilerEffect(store);

// Create persisted action handlers
const actions = createApiActions(store);
const commands = createCommands(store, actions);

// Create generation action handlers
const { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot } = createGenerationActions(
  store,
  commands,
);

// ─── Startup ────────────────────────────────────
let appReady = $state(false);
let startupStatus = $state<string>("loading");

onMount(async () => {
  const result = await initializeApp(store);
  startupStatus = result;
  appReady = result === "loaded";
});

async function createFirstProject() {
  try {
    const project = await apiCreateProject({
      id: generateId(),
      title: "Untitled Novel",
      status: "bootstrap",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.setProject(project);
    appReady = true;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to create project");
  }
}

// ─── Local UI state ─────────────────────────────
let showArcEditor = $state(false);
let activeTab = $state<"compiler" | "ir" | "simulator" | "drift" | "voice" | "setups">("compiler");

const tabItems = [
  { id: "compiler", label: "Draft Engine" },
  { id: "ir", label: "Scene Blueprint" },
  { id: "simulator", label: "Reader Journey" },
  { id: "drift", label: "Voice Consistency" },
  { id: "voice", label: "Character Voices" },
  { id: "setups", label: "Setups" },
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

// Scene title lookup for drift panel
let sceneTitles = $derived(Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])));

// Voice separability (computed across all scene prose)
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

// ─── Handlers ──────────────────────────────────
let editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function handleUpdateChunk(index: number, changes: Partial<Chunk>) {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;

  // Immediate store mutation for UI responsiveness
  store.updateChunkForScene(sceneId, index, changes);

  // Debounce API persistence for text edits, keyed per scene
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
    // Non-text changes persist immediately
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
  if (result.ok) {
    extractSceneIR(sceneId);
  }
}

async function handleResolveFlag(flagId: string, action: string) {
  await commands.resolveAuditFlag(flagId, action, true);
}

async function handleDismissFlag(flagId: string) {
  await commands.dismissAuditFlag(flagId);
}

async function handleVerifyIR() {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.verifySceneIR(sceneId);
}

async function handleUpdateIR(ir: import("../types/index.js").NarrativeIR) {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.saveSceneIR(sceneId, ir);
}

// ─── Prose Export ────────────────────────────────
let totalWordCount = $derived(
  store.scenes.reduce((sum, scene) => {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    return sum + chunks.reduce((s, c) => s + getCanonicalText(c).split(/\s+/).filter(Boolean).length, 0);
  }, 0),
);

let hasAnyProse = $derived(store.scenes.some((scene) => (store.sceneChunks[scene.plan.id] ?? []).length > 0));

function exportProse() {
  const sceneProse = store.scenes
    .toSorted((a, b) => a.sceneOrder - b.sceneOrder)
    .map((scene) => {
      const chunks = store.sceneChunks[scene.plan.id] ?? [];
      return chunks.map((c) => getCanonicalText(c)).join("\n\n");
    })
    .filter((text) => text.length > 0);

  if (sceneProse.length === 0) {
    store.setError("No prose to export — generate some chunks first.");
    return;
  }

  const prose = sceneProse.join("\n\n* * *\n\n");

  navigator.clipboard
    .writeText(prose)
    .then(() => {
      store.setError(null);
      const words = prose.split(/\s+/).filter(Boolean).length;
      alert(
        `${words.toLocaleString()} words copied to clipboard (${sceneProse.length} scene${sceneProse.length > 1 ? "s" : ""}).`,
      );
    })
    .catch(() => {
      const title = store.chapterArc?.workingTitle ?? "chapter";
      const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.txt`;
      const blob = new Blob([prose], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}

// ─── State Export ────────────────────────────────
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}… [${text.length} chars total]`;
}

function exportState() {
  const plan = store.activeScenePlan;
  const log = store.compilationLog;
  const chunks = store.activeSceneChunks;
  const payload = store.compiledPayload;

  const snapshot = {
    _format: "word-compiler-state-v1",
    _exported: new Date().toISOString(),
    scene: plan
      ? {
          title: plan.title,
          chunkCount: plan.chunkCount,
          chunkDescriptions: plan.chunkDescriptions,
          status: store.activeScene?.status,
        }
      : null,
    config: {
      model: store.compilationConfig.defaultModel,
      contextWindow: store.compilationConfig.modelContextWindow,
      reservedForOutput: store.compilationConfig.reservedForOutput,
      temperature: store.compilationConfig.defaultTemperature,
      bridgeVerbatimTokens: store.compilationConfig.bridgeVerbatimTokens,
    },
    compilation: log
      ? {
          ring1Tokens: log.ring1Tokens,
          ring2Tokens: log.ring2Tokens,
          ring3Tokens: log.ring3Tokens,
          totalTokens: log.totalTokens,
          availableBudget: log.availableBudget,
          r1Sections: log.ring1Contents,
          r2Sections: log.ring2Contents,
          r3Sections: log.ring3Contents,
        }
      : null,
    payload: payload
      ? {
          systemMessage: truncate(payload.systemMessage, 500),
          userMessage: truncate(payload.userMessage, 2000),
          systemMessageTokens: countTokens(payload.systemMessage),
          userMessageTokens: countTokens(payload.userMessage),
        }
      : null,
    chunks: chunks.map((c, i) => ({
      index: i + 1,
      status: c.status,
      model: c.model,
      temperature: c.temperature,
      textPreview: truncate(getCanonicalText(c), 200),
      wordCount: getCanonicalText(c).split(/\s+/).length,
      hasNotes: !!c.humanNotes,
      notes: c.humanNotes || undefined,
    })),
    lint: store.lintResult
      ? {
          errors: store.lintResult.issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`),
          warnings: store.lintResult.issues
            .filter((i) => i.severity === "warning")
            .map((i) => `${i.code}: ${i.message}`),
          infos: store.lintResult.issues.filter((i) => i.severity === "info").map((i) => `${i.code}: ${i.message}`),
        }
      : null,
    audit: {
      total: store.auditFlags.length,
      pending: store.auditFlags.filter((f) => !f.resolved).length,
      flags: store.auditFlags
        .filter((f) => !f.resolved)
        .map((f) => ({
          severity: f.severity,
          category: f.category,
          message: f.message,
        })),
    },
    ir: store.activeSceneIR
      ? {
          verified: store.activeSceneIR.verified,
          events: store.activeSceneIR.events.length,
          factsIntroduced: store.activeSceneIR.factsIntroduced.length,
          characterDeltas: store.activeSceneIR.characterDeltas.length,
          setupsPlanted: store.activeSceneIR.setupsPlanted.length,
          payoffsExecuted: store.activeSceneIR.payoffsExecuted.length,
          unresolvedTensions: store.activeSceneIR.unresolvedTensions,
        }
      : null,
  };

  const json = JSON.stringify(snapshot, null, 2);
  navigator.clipboard
    .writeText(json)
    .then(() => {
      store.setError(null);
      alert("State snapshot copied to clipboard. Paste it into Claude for debugging.");
    })
    .catch(() => {
      // Fallback: download as file
      store.saveFile(snapshot, `wc-state-${Date.now()}.json`);
    });
}
</script>

{#if !appReady}
  <div class="app loading-screen">
    <span class="app-title">Word Compiler</span>
    {#if startupStatus === "loading"}
      <p>Loading project...</p>
    {:else if startupStatus === "no-projects"}
      <p>Welcome to Word Compiler. Create your first project to get started.</p>
      <Button onclick={createFirstProject}>Create Project</Button>
    {:else if startupStatus === "error"}
      <ErrorBanner message={store.error ?? "Failed to load"} onDismiss={() => store.setError(null)} />
    {:else if startupStatus === "multiple-projects"}
      <p>Multiple projects found. Project list coming in Phase 3.</p>
    {/if}
  </div>
{:else}
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
      <Button size="sm" onclick={exportProse} disabled={!hasAnyProse} title="Copy all prose to clipboard">
        Copy Prose{#if totalWordCount > 0} ({totalWordCount.toLocaleString()}w){/if}
      </Button>
      <Button size="sm" onclick={exportState} title="Copy state snapshot to clipboard">Export</Button>
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
    onAddScene={() => store.setSceneAuthoringOpen(true)}
  />

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id as typeof activeTab; }} />

  <div class="cockpit">
    <BiblePane {store} {commands} onBootstrap={() => store.setBootstrapOpen(true)} onAuthor={() => store.setBibleAuthoringOpen(true)} />
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
      onGenerate={generateChunk}
      onUpdateChunk={handleUpdateChunk}
      onRemoveChunk={handleRemoveChunk}
      onRunAudit={runAuditManual}
      onRunDeepAudit={runDeepAudit}
      onCompleteScene={handleCompleteScene}
      onAutopilot={() => runAutopilot()}
      onCancelAutopilot={() => store.cancelAutopilot()}
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
      <StyleDriftPanel reports={styleDriftReports} {baselineSceneTitle} {sceneTitles} />
    {:else if activeTab === "voice"}
      <VoiceSeparabilityView report={voiceReport} />
    {:else if activeTab === "setups"}
      <SetupPayoffPanel sceneIRs={store.sceneIRs} {sceneTitles} sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))} />
    {/if}
  </div>

  <BootstrapModal {store} {commands} />
  <BibleAuthoringModal {store} {commands} />
  <SceneAuthoringModal {store} {commands} />

  {#if showArcEditor && store.chapterArc}
    <ChapterArcEditor arc={store.chapterArc} {store} {commands} onClose={() => { showArcEditor = false; }} />
  {/if}
</div>
{/if}

<style>
  .header-right { display: flex; align-items: center; gap: 12px; }
  .model-selector {
    display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary);
  }
  .error-margin { margin: 0 8px; }
  .loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; }
</style>
