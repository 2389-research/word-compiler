<script lang="ts">
import type { Bible } from "../../types/index.js";
import { createEmptyBible } from "../../types/index.js";
import { Button, Modal } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";
import type { FormFooterState } from "./BibleGuidedFormTab.svelte";
import BibleGuidedFormTab from "./BibleGuidedFormTab.svelte";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let formRef: BibleGuidedFormTab | undefined = $state();

let formFooter = $state<FormFooterState>({ currentStep: "foundations", isFirstStep: true, isLastStep: false });

let initialBible = $state<Bible>(createEmptyBible(""));
let stableProjectId = $state("");

$effect(() => {
  if (store.bibleAuthoringOpen) {
    stableProjectId = store.project?.id ?? `proj-${Date.now()}`;
    initialBible = store.bible ? $state.snapshot(store.bible) : createEmptyBible(stableProjectId);
  }
});

function handleClose() {
  store.setBibleAuthoringOpen(false);
}

async function handleFormSave(bible: Bible) {
  await commands.saveBible(bible);
  handleClose();
}
</script>

<Modal open={store.bibleAuthoringOpen} onClose={handleClose} width="wide">
  {#snippet header()}Essay Brief Editor{/snippet}

  <BibleGuidedFormTab
    bind:this={formRef}
    bind:footerState={formFooter}
    {initialBible}
    open={store.bibleAuthoringOpen}
    onSave={handleFormSave}
  />

  {#snippet footer()}
    <Button onclick={handleClose}>Cancel</Button>
    <div class="form-nav">
      {#if !formFooter.isFirstStep}
        <Button onclick={() => formRef?.prev()}>Back</Button>
      {/if}
      <Button onclick={() => formRef?.save()}>Save & Close</Button>
      {#if formFooter.isLastStep}
        <Button variant="primary" onclick={() => formRef?.save()}>Save Brief</Button>
      {:else}
        <Button variant="primary" onclick={() => formRef?.next()}>Next</Button>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .form-nav { display: flex; gap: 6px; margin-left: auto; }
</style>
