<script lang="ts">
import { checkBootstrapToPlanGate } from "../../../gates/index.js";
import { Button } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import AtlasBibleTab from "../AtlasBibleTab.svelte";
import BibleAuthoringModal from "../BibleAuthoringModal.svelte";
import BootstrapModal from "../BootstrapModal.svelte";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let bible = $derived(store.bible);
let nextGate = $derived(checkBootstrapToPlanGate(bible));
</script>

<div class="bootstrap-stage">
  {#if !bible}
    <div class="bootstrap-welcome">
      <h2 class="bootstrap-heading">Create Your Essay Brief</h2>
      <p class="bootstrap-subtitle">An essay brief defines your voice, style rules, and structural plan. Choose how to start.</p>

      <div class="bootstrap-cards">
        <button class="bootstrap-card" onclick={() => store.setBootstrapOpen(true)}>
          <span class="card-icon">AI</span>
          <span class="card-title">Start from Description</span>
          <span class="card-desc">Paste your essay idea and let the AI extract your thesis, section structure, tone, and style rules.</span>
        </button>

        <button class="bootstrap-card" onclick={() => store.setBibleAuthoringOpen(true)}>
          <span class="card-icon">+</span>
          <span class="card-title">Build Manually</span>
          <span class="card-desc">Use the guided form to define your voice, style rules, and essay structure step by step.</span>
        </button>
      </div>
    </div>
  {:else}
    <div class="bootstrap-bible-view">
      <div class="bible-header-bar">
        <h3 class="bible-title">Essay Brief <span class="bible-version">v{bible.version}</span></h3>
        <div class="bible-actions">
          <Button size="sm" onclick={() => store.setBibleAuthoringOpen(true)}>Edit Brief</Button>
          <Button size="sm" onclick={() => store.setBootstrapOpen(true)}>Re-bootstrap</Button>
        </div>
      </div>
      <div class="bible-content">
        <AtlasBibleTab
          {store}
          {commands}
          onBootstrap={() => store.setBootstrapOpen(true)}
          onAuthor={() => store.setBibleAuthoringOpen(true)}
        />
      </div>
    </div>
  {/if}

  {#if !nextGate.passed}
    <div class="prereq-hint">
      <span class="prereq-label">Next: Plan</span>
      {#each nextGate.messages as msg}
        <span class="prereq-msg">{msg}</span>
      {/each}
    </div>
  {/if}

  <BootstrapModal {store} {commands} />
  <BibleAuthoringModal {store} {commands} />
</div>

<style>
  .bootstrap-stage {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .bootstrap-welcome {
    max-width: 640px;
    margin: 0 auto;
    text-align: center;
    padding-top: 48px;
  }

  .bootstrap-heading {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .bootstrap-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 32px;
    line-height: 1.6;
  }

  .bootstrap-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .bootstrap-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 28px 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font-mono);
    text-align: center;
  }

  .bootstrap-card:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 4%, var(--bg-secondary));
  }

  .card-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .bootstrap-bible-view {
    max-width: 800px;
    margin: 0 auto;
  }

  .bible-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .bible-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .bible-version {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .bible-actions {
    display: flex;
    gap: 6px;
  }

  .bible-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px;
  }

  .prereq-hint {
    max-width: 640px;
    margin: 16px auto 0;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .prereq-label {
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9px;
    flex-shrink: 0;
  }

  .prereq-msg {
    color: var(--text-secondary);
  }
</style>
