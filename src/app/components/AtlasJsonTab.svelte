<script lang="ts">
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "svelte-codemirror-editor";
import type { Bible, ChapterArc, ScenePlan } from "../../types/index.js";
import { Button } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let locked = $state(true);

let bibleJson = $derived(store.bible ? JSON.stringify(store.bible, null, 2) : "");
let planJson = $derived(store.activeScenePlan ? JSON.stringify(store.activeScenePlan, null, 2) : "");
let arcJson = $derived(store.chapterArc ? JSON.stringify(store.chapterArc, null, 2) : "");

const extensions = [json(), oneDark];

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
    arcDebounce = setTimeout(() => commands.saveChapterArc(parsed), 500);
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
      store.setError("Invalid Essay Arc JSON");
    }
  }
}
</script>

<div class="json-tab">
  <div class="json-buttons">
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

  {#if locked}
    <div class="lock-banner">
      <span class="lock-text">Raw JSON is read-only. Prefer the Bible / Scene / Arc tabs for editing.</span>
      <button class="lock-btn" onclick={() => (locked = false)}>Enable Editing</button>
    </div>
  {:else}
    <div class="lock-banner lock-banner-warn">
      <span class="lock-text">Editing enabled — changes auto-save. Bible edits create new versions.</span>
      <button class="lock-btn" onclick={() => (locked = true)}>Lock</button>
    </div>
  {/if}

  <div class="editor-section">
    <div class="editor-label">Bible JSON</div>
    <div class="editor-wrapper" class:editor-locked={locked}>
      <CodeMirror value={bibleJson} on:change={(e) => { if (!locked) handleBibleChange(e.detail); }} readonly={locked} {extensions} />
    </div>
  </div>
  <div class="editor-section">
    <div class="editor-label">Section Plan JSON</div>
    <div class="editor-wrapper" class:editor-locked={locked}>
      <CodeMirror value={planJson} on:change={(e) => { if (!locked) handlePlanChange(e.detail); }} readonly={locked} {extensions} />
    </div>
  </div>
  <div class="editor-section">
    <div class="editor-label">Essay Arc JSON</div>
    <div class="editor-wrapper" class:editor-locked={locked}>
      <CodeMirror value={arcJson} on:change={(e) => { if (!locked) handleArcChange(e.detail); }} readonly={locked} {extensions} />
    </div>
  </div>
</div>

<style>
  .json-tab { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }
  .json-buttons { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  .bible-version { font-size: 10px; color: var(--accent-dim); margin-left: auto; }
  .editor-section { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .editor-label {
    padding: 4px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  }
  .editor-wrapper { flex: 1; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); }
  .editor-locked { opacity: 0.7; }
  .lock-banner {
    display: flex; align-items: center; gap: 8px; padding: 4px 8px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 10px;
  }
  .lock-banner-warn { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 6%, transparent); }
  .lock-text { flex: 1; color: var(--text-muted); }
  .lock-banner-warn .lock-text { color: var(--warning); }
  .lock-btn {
    font-family: var(--font-mono); font-size: 9px; padding: 2px 8px;
    background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-secondary); cursor: pointer;
  }
  .lock-btn:hover { color: var(--accent); border-color: var(--accent); }
</style>
