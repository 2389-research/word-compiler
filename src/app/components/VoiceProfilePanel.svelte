<script lang="ts">
import {
  apiCreateWritingSample,
  apiDeleteWritingSample,
  apiGenerateVoiceGuide,
  apiGetVoiceGuide,
  apiListWritingSamples,
} from "../../api/client.js";
import { extractCoreSensibility } from "../../profile/renderer.js";
import type { VoiceGuide, WritingSample } from "../../profile/types.js";
import { Button, ErrorBanner, Input, Modal, Select, Spinner, TextArea } from "../primitives/index.js";

let guide = $state<VoiceGuide | null>(null);
let samples = $state<WritingSample[]>([]);
let loading = $state(false);
let generating = $state(false);
let error = $state<string | null>(null);
let showAddModal = $state(false);
let showGuideModal = $state(false);

// Add sample form state
let sampleText = $state("");
let sampleDomain = $state("blog");
let sampleFilename = $state("");
let addingSample = $state(false);

// Load on mount
$effect(() => {
  loadData();
});

async function loadData() {
  loading = true;
  error = null;
  try {
    const [g, s] = await Promise.all([apiGetVoiceGuide(), apiListWritingSamples()]);
    guide = g;
    samples = s;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load voice profile";
  } finally {
    loading = false;
  }
}

async function handleAddSample() {
  if (!sampleText.trim()) return;
  addingSample = true;
  error = null;
  try {
    const sample = await apiCreateWritingSample(sampleFilename.trim() || null, sampleDomain, sampleText.trim());
    samples = [...samples, sample];
    sampleText = "";
    sampleFilename = "";
    sampleDomain = "blog";
    showAddModal = false;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to add sample";
  } finally {
    addingSample = false;
  }
}

async function handleGenerate() {
  generating = true;
  error = null;
  try {
    const sampleIds = samples.map((s) => s.id);
    guide = await apiGenerateVoiceGuide(sampleIds);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to generate voice profile";
  } finally {
    generating = false;
  }
}

async function handleDeleteSample(id: string) {
  error = null;
  try {
    await apiDeleteWritingSample(id);
    samples = samples.filter((s) => s.id !== id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to delete sample";
  }
}

let totalWords = $derived(samples.reduce((sum, s) => sum + s.wordCount, 0));
let coreSensibility = $derived(guide ? extractCoreSensibility(guide.narrativeSummary) : "");
let updatedDate = $derived(guide ? new Date(guide.updatedAt).toLocaleDateString() : "");
</script>

<div class="voice-panel">
  {#if error}
    <ErrorBanner message={error} onDismiss={() => { error = null; }} />
  {/if}

  {#if loading}
    <div class="voice-loading">
      <Spinner />
    </div>
  {:else if guide}
    <!-- State 3: Has guide -->
    <div class="voice-heading-row">
      <h3 class="voice-heading">Your Voice <span class="voice-version">v{guide.version}</span></h3>
    </div>
    <p class="voice-subtitle">
      Built from {guide.corpusSize} document{guide.corpusSize === 1 ? "" : "s"} · Updated {updatedDate}
    </p>
    <p class="voice-summary">{coreSensibility}</p>
    <div class="voice-actions">
      <Button size="sm" onclick={() => { showGuideModal = true; }}>View Full Guide</Button>
      <Button size="sm" onclick={() => { showAddModal = true; }}>Add More Samples</Button>
    </div>
  {:else if samples.length > 0}
    <!-- State 2: Has samples, no guide -->
    <h3 class="voice-heading">Your Voice</h3>
    <p class="voice-subtitle">
      {samples.length} writing sample{samples.length === 1 ? "" : "s"} ({totalWords.toLocaleString()} words)
    </p>
    <ul class="sample-list">
      {#each samples as sample (sample.id)}
        <li class="sample-item">
          <span class="sample-info">
            {sample.filename ?? "untitled"} ({sample.domain}, {sample.wordCount.toLocaleString()} words)
          </span>
          <button class="sample-delete" onclick={() => handleDeleteSample(sample.id)} title="Remove sample">&times;</button>
        </li>
      {/each}
    </ul>
    {#if generating}
      <div class="voice-generating">
        <Spinner />
        <span class="generating-text">Analyzing your writing style...</span>
      </div>
    {:else}
      <div class="voice-actions">
        <Button size="sm" onclick={handleGenerate}>Generate Profile</Button>
        <Button size="sm" onclick={() => { showAddModal = true; }}>Add More Samples</Button>
      </div>
    {/if}
  {:else}
    <!-- State 1: No samples, no guide -->
    <h3 class="voice-heading">Your Voice</h3>
    <p class="voice-subtitle">
      Add writing samples to build your voice profile. This helps the compiler match your style from the first chunk.
    </p>
    <div class="voice-actions">
      <Button size="sm" onclick={() => { showAddModal = true; }}>Add Writing Samples</Button>
    </div>
  {/if}

  <!-- Add Sample Modal -->
  <Modal open={showAddModal} onClose={() => { showAddModal = false; }}>
    {#snippet header()}
      <h3>Add Writing Sample</h3>
    {/snippet}

    <div class="add-sample-form">
      <TextArea
        placeholder="Paste your writing here..."
        value={sampleText}
        oninput={(e) => { sampleText = (e.target as HTMLTextAreaElement).value; }}
        rows={12}
      />
      <div class="add-sample-row">
        <label class="add-sample-label">
          Domain
          <Select
            value={sampleDomain}
            onchange={(e) => { sampleDomain = (e.target as HTMLSelectElement).value; }}
          >
            <option value="blog">Blog</option>
            <option value="fiction">Fiction</option>
            <option value="journalism">Journalism</option>
            <option value="essay">Essay</option>
            <option value="other">Other</option>
          </Select>
        </label>
        <label class="add-sample-label">
          Filename (optional)
          <Input
            placeholder="e.g., my-blog-post.txt"
            value={sampleFilename}
            oninput={(e) => { sampleFilename = (e.target as HTMLInputElement).value; }}
          />
        </label>
      </div>
    </div>

    {#snippet footer()}
      <Button size="sm" onclick={() => { showAddModal = false; }}>Cancel</Button>
      <Button size="sm" onclick={handleAddSample} disabled={!sampleText.trim() || addingSample}>
        {addingSample ? "Adding..." : "Add Sample"}
      </Button>
    {/snippet}
  </Modal>

  <!-- View Full Guide Modal -->
  <Modal open={showGuideModal} onClose={() => { showGuideModal = false; }} width="wide">
    {#snippet header()}
      <h3>Voice Guide v{guide?.version ?? ""}</h3>
    {/snippet}

    <div class="guide-content">
      <pre class="guide-text">{guide?.narrativeSummary ?? ""}</pre>
    </div>

    {#snippet footer()}
      <Button size="sm" onclick={() => { showGuideModal = false; }}>Close</Button>
    {/snippet}
  </Modal>
</div>

<style>
  .voice-panel {
    max-width: 640px;
    margin: 24px auto 0;
    padding: 20px 24px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .voice-loading {
    display: flex;
    justify-content: center;
    padding: 16px 0;
  }

  .voice-heading-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .voice-heading {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .voice-version {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .voice-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 12px;
  }

  .voice-summary {
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.6;
    margin-bottom: 16px;
    font-style: italic;
  }

  .sample-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
  }

  .sample-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary);
    padding: 3px 0;
  }

  .sample-info {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sample-delete {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    flex-shrink: 0;
  }

  .sample-delete:hover {
    color: var(--danger, #e53e3e);
  }

  .voice-actions {
    display: flex;
    gap: 8px;
  }

  .voice-generating {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }

  .generating-text {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .add-sample-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .add-sample-row {
    display: flex;
    gap: 12px;
  }

  .add-sample-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-secondary);
    flex: 1;
  }

  .guide-content {
    max-height: 60vh;
    overflow-y: auto;
  }

  .guide-text {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: var(--font-mono);
  }
</style>
