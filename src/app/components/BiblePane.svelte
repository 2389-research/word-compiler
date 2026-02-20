<script lang="ts">
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "svelte-codemirror-editor";
import type { Bible, ChapterArc, ScenePlan } from "../../types/index.js";
import { Button, Pane } from "../primitives/index.js";
import type { ApiActions } from "../store/api-actions.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  store,
  actions,
  onBootstrap,
  onAuthor,
}: {
  store: ProjectStore;
  actions?: ApiActions;
  onBootstrap: () => void;
  onAuthor?: () => void;
} = $props();

let bibleJson = $derived(store.bible ? JSON.stringify(store.bible, null, 2) : "");
let planJson = $derived(store.activeScenePlan ? JSON.stringify(store.activeScenePlan, null, 2) : "");

const extensions = [json(), oneDark];

function handleBibleChange(text: string) {
  try {
    const parsed = JSON.parse(text) as Bible;
    if (actions) {
      actions.saveBible(parsed);
    } else {
      store.setBible(parsed);
    }
  } catch {
    // Invalid JSON — don't update state until valid
  }
}

function handlePlanChange(text: string) {
  try {
    const parsed = JSON.parse(text) as ScenePlan;
    if (actions) {
      actions.saveScenePlan(parsed, store.activeSceneIndex);
    } else if (store.activeScenePlan) {
      store.addScenePlan(parsed);
    } else {
      store.setScenePlan(parsed);
    }
  } catch {
    // Invalid JSON
  }
}

async function handleLoadBible() {
  const text = await store.loadFile();
  if (text) {
    try {
      const parsed = JSON.parse(text) as Bible;
      if (actions) {
        await actions.saveBible(parsed);
      } else {
        store.setBible(parsed);
      }
    } catch {
      store.setError("Invalid Bible JSON");
    }
  }
}

async function handleLoadPlan() {
  const text = await store.loadFile();
  if (text) {
    try {
      const parsed = JSON.parse(text) as ScenePlan;
      if (actions) {
        await actions.saveScenePlan(parsed, store.scenes.length);
      } else if (store.scenes.length > 0) {
        store.addScenePlan(parsed);
      } else {
        store.setScenePlan(parsed);
      }
    } catch {
      store.setError("Invalid Scene Plan JSON");
    }
  }
}

async function handleLoadArc() {
  const text = await store.loadFile();
  if (text) {
    try {
      const parsed = JSON.parse(text) as ChapterArc;
      if (actions) {
        await actions.saveChapterArc(parsed);
      } else {
        store.setChapterArc(parsed);
      }
    } catch {
      store.setError("Invalid Chapter Arc JSON");
    }
  }
}
</script>

<Pane title="Bible + Plan" contentClass="bible-content">
  {#snippet headerRight()}
    <div class="pane-actions">
      {#if onAuthor}
        <Button onclick={onAuthor}>New Bible</Button>
      {:else}
        <Button onclick={onBootstrap}>Bootstrap</Button>
      {/if}
    </div>
  {/snippet}
    <div class="bible-buttons">
      <Button onclick={handleLoadBible}>Load Bible</Button>
      <Button onclick={() => store.bible && store.saveFile(store.bible, "bible.json")} disabled={!store.bible}>Save Bible</Button>
      <Button onclick={handleLoadPlan}>Load Plan</Button>
      <Button onclick={() => store.activeScenePlan && store.saveFile(store.activeScenePlan, "scene-plan.json")} disabled={!store.activeScenePlan}>Save Plan</Button>
      <Button onclick={handleLoadArc}>Load Arc</Button>
      {#if store.bible}
        <span class="bible-version">v{store.bible.version}</span>
      {/if}
    </div>
    <div class="editor-section">
      <div class="editor-label">Bible JSON</div>
      <div class="editor-wrapper">
        <CodeMirror value={bibleJson} on:change={(e) => handleBibleChange(e.detail)} {extensions} />
      </div>
    </div>
    <div class="editor-section">
      <div class="editor-label">Scene Plan JSON</div>
      <div class="editor-wrapper">
        <CodeMirror value={planJson} on:change={(e) => handlePlanChange(e.detail)} {extensions} />
      </div>
    </div>
</Pane>

<style>
  :global(.bible-content) { display: flex; flex-direction: column; gap: 8px; }
  .bible-buttons { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  .bible-version { font-size: 10px; color: var(--accent-dim); margin-left: auto; }
  .editor-section { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .editor-label {
    padding: 4px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  }
  .editor-wrapper { flex: 1; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); }
</style>
