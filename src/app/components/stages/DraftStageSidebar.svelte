<script lang="ts">
import type { NarrativeIR } from "../../../types/index.js";
import { Tabs } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import CompilerView from "../CompilerView.svelte";
import IRInspector from "../IRInspector.svelte";
import SetupPayoffPanel from "../SetupPayoffPanel.svelte";
import StyleDriftPanel from "../StyleDriftPanel.svelte";
import VoiceSeparabilityView from "../VoiceSeparabilityView.svelte";
import { createDraftStageMetrics } from "./draftStageMetrics.svelte.js";

type TabId = "compiler" | "drift" | "voice" | "setups" | "ir";

let {
  store,
  commands,
  activeTab = $bindable(),
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  activeTab: TabId;
  onExtractIR: (sceneId?: string) => void;
} = $props();

const metrics = createDraftStageMetrics(store);

const tabItems = [
  { id: "compiler", label: "Draft Engine" },
  { id: "drift", label: "Voice Consistency" },
  { id: "voice", label: "Character Voices" },
  { id: "setups", label: "Setups" },
  { id: "ir", label: "IR" },
];

async function handleVerifyIR() {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.verifySceneIR(sceneId);
}
async function handleUpdateIR(ir: NarrativeIR) {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.saveSceneIR(sceneId, ir);
}
</script>

<div class="draft-sidebar">
  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id as TabId; }} />
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
      <StyleDriftPanel
        reports={metrics.styleDriftReports}
        baselineSceneTitle={metrics.baselineSceneTitle}
        sceneTitles={metrics.sceneTitles}
      />
    {:else if activeTab === "voice"}
      <VoiceSeparabilityView report={metrics.voiceReport} />
    {:else if activeTab === "setups"}
      <SetupPayoffPanel
        sceneIRs={store.sceneIRs}
        sceneTitles={metrics.sceneTitles}
        sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))}
      />
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

<style>
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
