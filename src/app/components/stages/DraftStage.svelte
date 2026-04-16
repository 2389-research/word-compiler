<script lang="ts">
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../../../gates/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import SceneAuthoringModal from "../SceneAuthoringModal.svelte";
import SceneSequencer from "../SceneSequencer.svelte";
import DraftStageMain from "./DraftStageMain.svelte";
import DraftStageSidebar from "./DraftStageSidebar.svelte";

type TabId = "compiler" | "drift" | "voice" | "setups" | "ir";

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

let activeTab = $state<TabId>("compiler");

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
    <DraftStageMain
      {store}
      {commands}
      {onGenerate}
      {onRunAudit}
      {onRunDeepAudit}
      {onAutopilot}
      {onExtractIR}
      {canGenerate}
      {gateMessages}
      onOpenIRTab={() => { activeTab = "ir"; }}
    />
    <DraftStageSidebar
      {store}
      {commands}
      bind:activeTab
      {onExtractIR}
    />
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
</style>
