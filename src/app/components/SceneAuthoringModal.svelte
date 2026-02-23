<script lang="ts">
import type { ChapterArc, ScenePlan } from "../../types/index.js";
import { createEmptyChapterArc } from "../../types/index.js";
import { Button, Modal, Tabs } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import SceneBootstrapTab from "./SceneBootstrapTab.svelte";
import SceneGuidedFormTab from "./SceneGuidedFormTab.svelte";

let {
  store,
  commands,
  initialTab,
}: {
  store: ProjectStore;
  commands: Commands;
  initialTab?: "bootstrap" | "form";
} = $props();

// ─── Tab state ──────────────────────────────────
let activeTab = $state(initialTab ?? "bootstrap");
const tabItems = [
  { id: "bootstrap", label: "AI Bootstrap" },
  { id: "form", label: "Guided Form" },
];

// ─── Child refs ─────────────────────────────────
let bootstrapRef: SceneBootstrapTab | undefined = $state();
let formRef: SceneGuidedFormTab | undefined = $state();

// ─── Reactive footer state ──────────────────────
let bootstrapFooter = $derived(
  bootstrapRef?.getFooterState() ?? { loading: false, canGenerate: false, hasPlans: false, acceptCount: 0 },
);
let formFooter = $derived(formRef?.getFooterState() ?? { formStep: "core", isFirstStep: true, isLastStep: false });

// ─── Handlers ───────────────────────────────────
function handleClose() {
  store.setSceneAuthoringOpen(false);
  bootstrapRef?.reset();
}

async function handleBootstrapCommit(plans: ScenePlan[], arc: ChapterArc | null, sourcePrompt: string) {
  // Save chapter arc first so we have its ID for scene plans
  if (arc) {
    arc.sourcePrompt = sourcePrompt;
    await commands.saveChapterArc(arc);
  } else if (!store.chapterArc) {
    // Auto-create a minimal chapter arc so scenes have a chapterId to persist under
    const newArc = createEmptyChapterArc(store.project?.id ?? "");
    newArc.sourcePrompt = sourcePrompt;
    await commands.saveChapterArc(newArc);
  }

  const chapterId = store.chapterArc?.id ?? null;
  const plansWithChapter = plans.map((p) => ({ ...p, chapterId }));

  if (plansWithChapter.length > 0) {
    await commands.saveMultipleScenePlans(plansWithChapter);
  }
  handleClose();
}

async function handleFormSave(plan: ScenePlan) {
  if (!store.chapterArc) {
    const arc = createEmptyChapterArc(store.project?.id ?? "");
    await commands.saveChapterArc(arc);
  }
  const chapterId = store.chapterArc?.id ?? null;
  await commands.saveScenePlan({ ...plan, chapterId }, store.scenes.length);
  handleClose();
}
</script>

<Modal open={store.sceneAuthoringOpen} onClose={handleClose} width="wide">
  {#snippet header()}Scene Authoring{/snippet}

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id; }} />

  {#if activeTab === "bootstrap"}
    <SceneBootstrapTab
      bind:this={bootstrapRef}
      {store}
      onCommit={handleBootstrapCommit}
      onClose={handleClose}
    />
  {:else}
    <SceneGuidedFormTab
      bind:this={formRef}
      characters={store.bible?.characters ?? []}
      locations={store.bible?.locations ?? []}
      projectId={store.project?.id ?? ""}
      open={store.sceneAuthoringOpen}
      onSave={handleFormSave}
    />
  {/if}

  {#snippet footer()}
    {#if activeTab === "bootstrap"}
      <Button onclick={handleClose}>Cancel</Button>
      {#if !bootstrapFooter.hasPlans}
        <Button variant="primary" onclick={() => bootstrapRef?.generate()} disabled={bootstrapFooter.loading || !bootstrapFooter.canGenerate}>
          {bootstrapFooter.loading ? "Generating..." : "Generate Scenes"}
        </Button>
      {/if}
    {:else}
      <Button onclick={handleClose}>Cancel</Button>
      <div class="form-nav">
        {#if !formFooter.isFirstStep}
          <Button onclick={() => formRef?.prev()}>Back</Button>
        {/if}
        <Button onclick={() => formRef?.save()}>Save & Close</Button>
        {#if formFooter.isLastStep}
          <Button variant="primary" onclick={() => formRef?.save()}>Save Scene Plan</Button>
        {:else}
          <Button variant="primary" onclick={() => formRef?.next()}>Next</Button>
        {/if}
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .form-nav { display: flex; gap: 6px; margin-left: auto; }
</style>
