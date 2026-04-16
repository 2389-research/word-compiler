<script lang="ts">
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import DraftingDesk from "../DraftingDesk.svelte";
import { createDraftStageController } from "./draftStageController.svelte.js";

let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
  onOpenIRTab,
  canGenerate,
  gateMessages,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
  onOpenIRTab: () => void;
  canGenerate: boolean;
  gateMessages: string[];
} = $props();

const controller = createDraftStageController(store, commands);

$effect(() => {
  return () => controller.dispose();
});

async function handleCompleteScene() {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  const result = await commands.completeScene(sceneId);
  if (result.ok) onExtractIR(sceneId);
}
</script>

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
    {onGenerate}
    onCancelGeneration={() => store.cancelGeneration()}
    onUpdateChunk={controller.handleUpdateChunk}
    onRemoveChunk={controller.handleRemoveChunk}
    onDestroyChunk={controller.handleDestroyChunk}
    {onRunAudit}
    {onRunDeepAudit}
    onCompleteScene={handleCompleteScene}
    {onAutopilot}
    onCancelAutopilot={() => store.cancelAutopilot()}
    onOpenIRInspector={onOpenIRTab}
    onExtractIR={() => onExtractIR()}
    onReviewChunk={controller.handleReviewChunk}
    onAcceptSuggestion={() => {}}
    onDismissAnnotation={controller.handleDismissAnnotation}
    onRequestSuggestion={controller.handleRequestSuggestion}
  />
</div>

<style>
  .draft-main {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
