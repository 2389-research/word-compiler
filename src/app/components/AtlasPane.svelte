<script lang="ts">
import { Button, Pane, Tabs } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import AtlasArcTab from "./AtlasArcTab.svelte";
import AtlasBibleTab from "./AtlasBibleTab.svelte";
import AtlasJsonTab from "./AtlasJsonTab.svelte";
import AtlasSceneTab from "./AtlasSceneTab.svelte";

let {
  store,
  commands,
  onBootstrap,
  onAuthor,
  initialTab = "bible",
}: {
  store: ProjectStore;
  commands: Commands;
  onBootstrap: () => void;
  onAuthor?: () => void;
  initialTab?: string;
} = $props();

const tabs = [
  { id: "bible", label: "Brief" },
  { id: "scene", label: "Section" },
  { id: "arc", label: "Arc" },
  { id: "json", label: "JSON" },
];

const validTabIds = new Set(tabs.map((t) => t.id));
let activeTab = $state(validTabIds.has(initialTab) ? initialTab : "bible");
</script>

<Pane title="Project Atlas" contentClass="atlas-content">
  {#snippet headerRight()}
    <div class="pane-actions">
      {#if onAuthor}
        <Button onclick={onAuthor}>New Brief</Button>
      {:else}
        <Button onclick={onBootstrap}>Bootstrap</Button>
      {/if}
    </div>
  {/snippet}

  <Tabs items={tabs} active={activeTab} onSelect={(id) => (activeTab = id)} />

  <div class="tab-body">
    {#if activeTab === "bible"}
      <AtlasBibleTab {store} {commands} {onBootstrap} {onAuthor} />
    {:else if activeTab === "scene"}
      <AtlasSceneTab {store} {commands} />
    {:else if activeTab === "arc"}
      <AtlasArcTab {store} {commands} />
    {:else if activeTab === "json"}
      <AtlasJsonTab {store} {commands} />
    {/if}
  </div>
</Pane>

<style>
  :global(.atlas-content) {
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    gap: 0;
  }
  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    min-height: 0;
  }
</style>
