<script lang="ts">
import type { Bible } from "../../types/index.js";
import { createEmptyBible } from "../../types/index.js";
import { Button, Modal, Tabs } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import type { BootstrapFooterState } from "./BibleBootstrapTab.svelte";
import BibleBootstrapTab from "./BibleBootstrapTab.svelte";
import type { FormFooterState } from "./BibleGuidedFormTab.svelte";
import BibleGuidedFormTab from "./BibleGuidedFormTab.svelte";

let {
  store,
  commands,
  initialTab,
}: {
  store: ProjectStore;
  commands: Commands;
  initialTab?: "bootstrap" | "form";
} = $props();

let activeTab = $state(initialTab ?? "bootstrap");
const tabItems = [
  { id: "bootstrap", label: "AI Bootstrap" },
  { id: "form", label: "Guided Form" },
];

let bootstrapRef: BibleBootstrapTab | undefined = $state();
let formRef: BibleGuidedFormTab | undefined = $state();

let bootstrapFooter = $state<BootstrapFooterState>({ loading: false, canGenerate: false });
let formFooter = $state<FormFooterState>({ currentStep: "foundations", isFirstStep: true, isLastStep: false });

let initialBible = $state<Bible>(createEmptyBible(""));

$effect(() => {
  if (store.bibleAuthoringOpen) {
    initialBible = store.bible ? $state.snapshot(store.bible) : createEmptyBible(store.project?.id ?? "");
  }
});

function handleClose() {
  store.setBibleAuthoringOpen(false);
  bootstrapRef?.reset();
}

async function handleBootstrapCommit(bible: Bible, _sourcePrompt: string) {
  await commands.saveBible(bible);
  await new Promise((resolve) => setTimeout(resolve, 600));
  handleClose();
}

async function handleFormSave(bible: Bible) {
  await commands.saveBible(bible);
  handleClose();
}
</script>

<Modal open={store.bibleAuthoringOpen} onClose={handleClose} width="wide">
  {#snippet header()}Bible Authoring{/snippet}

  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id; }} />

  <div hidden={activeTab !== "bootstrap"}>
    <BibleBootstrapTab
      bind:this={bootstrapRef}
      bind:footerState={bootstrapFooter}
      projectId={store.project?.id ?? `proj-${Date.now()}`}
      onCommit={handleBootstrapCommit}
    />
  </div>

  <div hidden={activeTab !== "form"}>
    <BibleGuidedFormTab
      bind:this={formRef}
      bind:footerState={formFooter}
      {initialBible}
      open={store.bibleAuthoringOpen}
      onSave={handleFormSave}
    />
  </div>

  {#snippet footer()}
    {#if activeTab === "bootstrap"}
      <Button onclick={handleClose}>Cancel</Button>
      <Button variant="primary" onclick={() => bootstrapRef?.bootstrap()} disabled={bootstrapFooter.loading || !bootstrapFooter.canGenerate}>
        {bootstrapFooter.loading ? "Bootstrapping..." : "Bootstrap Bible"}
      </Button>
    {:else}
      <Button onclick={handleClose}>Cancel</Button>
      <div class="form-nav">
        {#if !formFooter.isFirstStep}
          <Button onclick={() => formRef?.prev()}>Back</Button>
        {/if}
        <Button onclick={() => formRef?.save()}>Save & Close</Button>
        {#if formFooter.isLastStep}
          <Button variant="primary" onclick={() => formRef?.save()}>Save Bible</Button>
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
