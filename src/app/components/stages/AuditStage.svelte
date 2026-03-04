<script lang="ts">
import { analyzeEdits } from "../../../learner/diff.js";
import { applyProposal, type BibleProposal } from "../../../learner/proposals.js";
import { generateTuningProposals, type TuningProposal } from "../../../learner/tuning.js";
import { computeStyleDriftFromProse } from "../../../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../../../metrics/voiceSeparability.js";
import type { StyleDriftReport, VoiceSeparabilityReport } from "../../../types/index.js";
import { getCanonicalText } from "../../../types/index.js";
import { Badge, Button, Spinner, Tabs } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import ForwardSimulator from "../ForwardSimulator.svelte";
import LearnerPanel from "../LearnerPanel.svelte";
import SceneSequencer from "../SceneSequencer.svelte";
import SetupPayoffPanel from "../SetupPayoffPanel.svelte";
import StyleDriftPanel from "../StyleDriftPanel.svelte";
import VoiceSeparabilityView from "../VoiceSeparabilityView.svelte";

let {
  store,
  commands,
  onRunAudit,
  onRunDeepAudit,
}: {
  store: ProjectStore;
  commands: Commands;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
} = $props();

let isAuditing = $derived(store.isAuditing);

let sidebarTab = $state<"simulator" | "drift" | "voice" | "setups" | "learner">("simulator");

const sidebarTabs = [
  { id: "simulator", label: "Reader Journey" },
  { id: "drift", label: "Voice Drift" },
  { id: "voice", label: "Voices" },
  { id: "setups", label: "Setups" },
  { id: "learner", label: "Learner" },
];

// ─── Derived values ─────────────────────────────
let simulatorScenes = $derived(
  store.scenes.map((s) => ({
    plan: s.plan,
    ir: store.sceneIRs[s.plan.id] ?? null,
    sceneOrder: s.sceneOrder,
  })),
);

let sceneTitles = $derived(Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])));

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

let editPatterns = $derived.by(() => {
  const projectId = store.project?.id ?? "";
  const patterns = [];
  for (const scene of store.scenes) {
    const chunks = store.sceneChunks[scene.plan.id] ?? [];
    for (const chunk of chunks) {
      if (chunk.editedText !== null) {
        patterns.push(...analyzeEdits(chunk.generatedText, chunk.editedText, chunk.id, scene.plan.id, projectId));
      }
    }
  }
  return patterns;
});

let sceneOrderMap = $derived(new Map(store.scenes.map((s) => [s.plan.id, s.sceneOrder])));

let tuningProposals = $derived.by(() => {
  const allChunks = store.scenes.flatMap((s) => store.sceneChunks[s.plan.id] ?? []);
  return generateTuningProposals(allChunks, store.compilationConfig, store.project?.id ?? "");
});

// ─── Active scene prose (read-only view) ─────────
let activeChunks = $derived(store.activeSceneChunks);
let unresolvedFlags = $derived(store.auditFlags.filter((f) => !f.resolved));

async function handleAcceptProposal(proposal: BibleProposal) {
  if (!store.bible) return;
  const updated = applyProposal(store.bible, proposal);
  await commands.saveBible(updated);
}
</script>

<div class="audit-stage">
  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
  />

  <div class="audit-toolbar">
    <Button size="sm" variant="primary" onclick={onRunAudit} disabled={isAuditing}>Run Audit</Button>
    <span class="info-tip">
      <svg class="info-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 7v4M8 5.5v-.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="info-tip-text">Scans for kill list violations, sentence rhythm issues, paragraph length, and computes prose metrics. Instant &mdash; no LLM call.</span>
    </span>
    <Button size="sm" onclick={onRunDeepAudit} disabled={isAuditing}>
      {#if isAuditing}<Spinner size="sm" /> Auditing...{:else}Deep Audit{/if}
    </Button>
    <button type="button" class="info-tip" aria-describedby="audit-deep-tip">
      <svg class="info-svg" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 7v4M8 5.5v-.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span id="audit-deep-tip" class="info-tip-text" role="tooltip">Sends prose to Claude to check whether characters explicitly state what should remain subtext. Requires a scene plan with subtext defined.</span>
    </button>
    {#if unresolvedFlags.length > 0}
      <Badge variant="warning">{unresolvedFlags.length} unresolved flag{unresolvedFlags.length !== 1 ? "s" : ""}</Badge>
    {:else}
      <Badge variant="accepted">All clear</Badge>
    {/if}
  </div>

  <div class="audit-columns">
    <div class="audit-prose">
      <h3 class="audit-section-title">
        {store.activeScenePlan?.title ?? "No scene selected"}
      </h3>
      {#if activeChunks.length > 0}
        <div class="prose-scroll">
          {#each activeChunks as chunk, i (chunk.id)}
            <div class="prose-chunk">
              <span class="chunk-label">Chunk {i + 1}</span>
              <p class="chunk-text">{getCanonicalText(chunk)}</p>
              {#if chunk.humanNotes}
                <p class="chunk-notes">Note: {chunk.humanNotes}</p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="audit-empty">No prose generated for this scene yet.</div>
      {/if}

      {#if unresolvedFlags.length > 0}
        <div class="flags-section">
          <span class="audit-section-title">Flags</span>
          {#each unresolvedFlags as flag (flag.id)}
            <div class="flag-item flag-{flag.severity}">
              <Badge variant={flag.severity === "critical" ? "error" : "warning"}>{flag.severity}</Badge>
              <span class="flag-cat">[{flag.category}]</span>
              <span class="flag-msg">{flag.message}</span>
              <div class="flag-actions">
                <Button size="sm" onclick={() => commands.resolveAuditFlag(flag.id, "fixed", true)}>Resolve</Button>
                <Button size="sm" variant="ghost" onclick={() => commands.dismissAuditFlag(flag.id)}>Dismiss</Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="audit-sidebar">
      <Tabs items={sidebarTabs} active={sidebarTab} onSelect={(id) => { sidebarTab = id as typeof sidebarTab; }} />
      <div class="sidebar-content">
        {#if sidebarTab === "simulator"}
          <ForwardSimulator
            scenes={simulatorScenes}
            activeSceneIndex={store.activeSceneIndex}
            bible={store.bible}
            onSelectScene={(i) => store.setActiveScene(i)}
          />
        {:else if sidebarTab === "drift"}
          <StyleDriftPanel reports={styleDriftReports} {baselineSceneTitle} {sceneTitles} />
        {:else if sidebarTab === "voice"}
          <VoiceSeparabilityView report={voiceReport} />
        {:else if sidebarTab === "setups"}
          <SetupPayoffPanel
            sceneIRs={store.sceneIRs}
            {sceneTitles}
            sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))}
          />
        {:else if sidebarTab === "learner"}
          <LearnerPanel
            {editPatterns}
            sceneOrder={sceneOrderMap}
            projectId={store.project?.id ?? ""}
            {tuningProposals}
            onAcceptProposal={handleAcceptProposal}
            onAcceptTuning={(tp) => {
              store.setConfig({ ...store.compilationConfig, [tp.parameter]: tp.suggestedValue });
            }}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .audit-stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .audit-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .info-tip {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
  }
  .info-svg {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    transition: color 0.12s;
  }
  .info-tip:hover .info-svg {
    color: var(--accent);
  }
  .info-tip-text {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 240px;
    padding: 8px 10px;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-md, 6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.5;
    z-index: 200;
    pointer-events: none;
    white-space: normal;
  }
  .info-tip:hover .info-tip-text,
  .info-tip:focus-visible .info-tip-text {
    display: block;
  }

  .audit-columns {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 1px;
    background: var(--border);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .audit-prose {
    background: var(--bg-primary);
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .audit-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .prose-scroll {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prose-chunk {
    border-left: 2px solid var(--border);
    padding-left: 10px;
  }

  .chunk-label {
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .chunk-text {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-primary);
    white-space: pre-wrap;
    margin: 4px 0 0;
  }

  .chunk-notes {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 4px;
  }

  .audit-empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  .flags-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .flag-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 4px 0;
    flex-wrap: wrap;
  }

  .flag-cat { color: var(--text-muted); font-size: 10px; }
  .flag-msg { color: var(--text-primary); flex: 1; }
  .flag-actions { display: flex; gap: 4px; }

  .audit-sidebar {
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
