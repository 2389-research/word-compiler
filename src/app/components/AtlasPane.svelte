<script lang="ts">
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "svelte-codemirror-editor";
import type { Bible, ChapterArc, ScenePlan } from "../../types/index.js";
import { Button, Pane } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  store,
  commands,
  onBootstrap,
  onAuthor,
}: {
  store: ProjectStore;
  commands: Commands;
  onBootstrap: () => void;
  onAuthor?: () => void;
} = $props();

let bibleJson = $derived(store.bible ? JSON.stringify(store.bible, null, 2) : "");
let planJson = $derived(store.activeScenePlan ? JSON.stringify(store.activeScenePlan, null, 2) : "");
let arcJson = $derived(store.chapterArc ? JSON.stringify(store.chapterArc, null, 2) : "");

const extensions = [json(), oneDark];

// Debounce timers for JSON editor saves
let bibleDebounce: ReturnType<typeof setTimeout> | undefined;
let arcDebounce: ReturnType<typeof setTimeout> | undefined;
let planDebounce: ReturnType<typeof setTimeout> | undefined;

function handleBibleChange(text: string) {
  try {
    const parsed = JSON.parse(text) as Bible;
    store.setBible(parsed);
    clearTimeout(bibleDebounce);
    bibleDebounce = setTimeout(() => commands.saveBible(parsed), 500);
  } catch {
    // Invalid JSON — don't update state until valid
  }
}

function handleArcChange(text: string) {
  try {
    const parsed = JSON.parse(text) as ChapterArc;
    clearTimeout(arcDebounce);
    arcDebounce = setTimeout(() => commands.updateChapterArc(parsed), 500);
  } catch {
    // Invalid JSON
  }
}

function handlePlanChange(text: string) {
  try {
    const parsed = JSON.parse(text) as ScenePlan;
    clearTimeout(planDebounce);
    planDebounce = setTimeout(() => commands.updateScenePlan(parsed), 500);
  } catch {
    // Invalid JSON
  }
}

async function handleLoadBible() {
  const text = await store.loadFile();
  if (text) {
    try {
      const parsed = JSON.parse(text) as Bible;
      await commands.saveBible(parsed);
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
      await commands.saveScenePlan(parsed, store.scenes.length);
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
      await commands.saveChapterArc(parsed);
    } catch {
      store.setError("Invalid Chapter Arc JSON");
    }
  }
}
</script>

<Pane title="Project Atlas" contentClass="bible-content">
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
      <Button onclick={() => store.chapterArc && store.saveFile(store.chapterArc, "chapter-arc.json")} disabled={!store.chapterArc}>Save Arc</Button>
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
    <div class="editor-section">
      <div class="editor-label">Chapter Arc JSON</div>
      <div class="editor-wrapper">
        <CodeMirror value={arcJson} on:change={(e) => handleArcChange(e.detail)} {extensions} />
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
