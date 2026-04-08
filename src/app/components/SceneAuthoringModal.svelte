<script lang="ts">
import type { ChapterArc, ScenePlan } from "../../types/index.js";
import { createEmptyChapterArc } from "../../types/index.js";
import { Button, Modal, Tabs } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import type { BootstrapFooterState, BootstrapPhase } from "./SceneBootstrapTab.svelte";
import SceneBootstrapTab from "./SceneBootstrapTab.svelte";
import type { FormFooterState } from "./SceneGuidedFormTab.svelte";
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

// ─── Reactive footer state (bound from children) ─
let bootstrapFooter = $state<BootstrapFooterState>({
  loading: false,
  canGenerate: false,
  phase: "idle" as BootstrapPhase,
  acceptedCount: 0,
});
let formFooter = $state<FormFooterState>({ formStep: "core", isFirstStep: true, isLastStep: false });

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
  {#snippet header()}Section Authoring{/snippet}

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id; }} />

  <div hidden={activeTab !== "bootstrap"}>
    <SceneBootstrapTab
      bind:this={bootstrapRef}
      bind:footerState={bootstrapFooter}
      {store}
      {commands}
      onCommit={handleBootstrapCommit}
    />
  </div>

  <div hidden={activeTab !== "form"}>
    <SceneGuidedFormTab
      bind:this={formRef}
      bind:footerState={formFooter}
      characters={store.bible?.characters ?? []}
      locations={store.bible?.locations ?? []}
      projectId={store.project?.id ?? ""}
      open={store.sceneAuthoringOpen}
      onSave={handleFormSave}
    />
  </div>

  {#snippet footer()}
    {#if activeTab === "bootstrap"}
      <Button onclick={handleClose}>Cancel</Button>
      {#if bootstrapFooter.phase === "idle"}
        <Button variant="primary" onclick={() => bootstrapRef?.generate()} disabled={bootstrapFooter.loading || !bootstrapFooter.canGenerate}>
          Generate Sections
        </Button>
      {:else if bootstrapFooter.phase === "complete"}
        <Button variant="primary" onclick={() => bootstrapRef?.commit()} disabled={bootstrapFooter.acceptedCount === 0}>
          Commit {bootstrapFooter.acceptedCount} Section{bootstrapFooter.acceptedCount !== 1 ? "s" : ""}
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
          <Button variant="primary" onclick={() => formRef?.save()}>Save Section Plan</Button>
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
