<script lang="ts">
import { checkPlanToDraftGate } from "../../../gates/index.js";
import { Button, Tabs } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import AtlasSceneTab from "../AtlasSceneTab.svelte";
import ChapterArcEditor from "../ChapterArcEditor.svelte";
import CharacterCard from "../CharacterCard.svelte";
import LocationCard from "../LocationCard.svelte";
import SceneAuthoringModal from "../SceneAuthoringModal.svelte";
import SceneSequencer from "../SceneSequencer.svelte";
import SetupPayoffPanel from "../SetupPayoffPanel.svelte";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let sidebarTab = $state<"characters" | "setups">("characters");
let showArcEditor = $state(false);

const sidebarTabs = [
  { id: "characters", label: "Reference" },
  { id: "setups", label: "Setups" },
];

let sceneTitles = $derived(Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])));
let characters = $derived(store.bible?.characters ?? []);
let locations = $derived(store.bible?.locations ?? []);
let nextGate = $derived(checkPlanToDraftGate(store.scenes.map((s) => s.plan)));
</script>

<div class="plan-stage">
  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
    onAddScene={() => store.setSceneAuthoringOpen(true)}
  />

  <div class="plan-columns">
    <div class="plan-main">
      <div class="plan-main-header">
        <h3 class="plan-section-title">Section Details</h3>
        <div class="plan-actions">
          <Button size="sm" onclick={() => store.setSceneAuthoringOpen(true)}>+ New Section</Button>
          {#if store.chapterArc}
            <Button size="sm" onclick={() => { showArcEditor = true; }}>Essay Arc</Button>
          {/if}
        </div>
      </div>
      <div class="plan-scene-content">
        {#if store.activeScenePlan}
          <AtlasSceneTab {store} {commands} />
        {:else}
          <div class="plan-empty">
            <p>No section selected. Create a section plan to get started.</p>
            <Button onclick={() => store.setSceneAuthoringOpen(true)}>Create Section Plan</Button>
          </div>
        {/if}
      </div>
    </div>

    <div class="plan-sidebar">
      <Tabs items={sidebarTabs} active={sidebarTab} onSelect={(id) => { sidebarTab = id as typeof sidebarTab; }} />
      <div class="sidebar-content">
        {#if sidebarTab === "characters"}
          <div class="reference-panel">
            {#if characters.length > 0}
              <div class="ref-section">
                <span class="ref-label">Characters ({characters.length})</span>
                {#each characters as char (char.id)}
                  <CharacterCard character={char} />
                {/each}
              </div>
            {/if}
            {#if locations.length > 0}
              <div class="ref-section">
                <span class="ref-label">Locations ({locations.length})</span>
                {#each locations as loc (loc.id)}
                  <LocationCard location={loc} />
                {/each}
              </div>
            {/if}
            {#if characters.length === 0 && locations.length === 0}
              <div class="plan-empty">No author voice or references in brief.</div>
            {/if}
          </div>
        {:else if sidebarTab === "setups"}
          <SetupPayoffPanel
            sceneIRs={store.sceneIRs}
            {sceneTitles}
            sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))}
          />
        {/if}
      </div>
    </div>
  </div>

  {#if !nextGate.passed}
    <div class="prereq-hint">
      <span class="prereq-label">Next: Draft</span>
      {#each nextGate.messages as msg}
        <span class="prereq-msg">{msg}</span>
      {/each}
    </div>
  {/if}

  <SceneAuthoringModal {store} {commands} />

  {#if showArcEditor && store.chapterArc}
    <ChapterArcEditor arc={store.chapterArc} {store} {commands} onClose={() => { showArcEditor = false; }} />
  {/if}
</div>

<style>
  .plan-stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .plan-columns {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 1px;
    background: var(--border);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .plan-main {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .plan-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .plan-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .plan-actions {
    display: flex;
    gap: 6px;
  }

  .plan-scene-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    min-height: 0;
  }

  .plan-sidebar {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
  }

  .reference-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ref-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ref-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  .plan-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  .prereq-hint {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    flex-shrink: 0;
  }

  .prereq-label {
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9px;
    flex-shrink: 0;
  }

  .prereq-msg {
    color: var(--text-secondary);
  }
</style>
