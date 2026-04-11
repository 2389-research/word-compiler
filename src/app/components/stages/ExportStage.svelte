<script lang="ts">
import { exportToMarkdown } from "../../../export/markdown.js";
import { exportToPlaintext } from "../../../export/plaintext.js";
import { getCanonicalText } from "../../../types/index.js";
import { Badge, Button, RadioGroup } from "../../primitives/index.js";
import type { ProjectStore } from "../../store/project.svelte.js";

let {
  store,
}: {
  store: ProjectStore;
} = $props();

let format = $state<"markdown" | "plaintext">("markdown");

let exported = $derived.by(() => {
  if (format === "markdown") {
    return exportToMarkdown(store.scenes, store.sceneChunks, store.chapterArc);
  }
  return exportToPlaintext(store.scenes, store.sceneChunks);
});

let wordCount = $derived(exported.split(/\s+/).filter(Boolean).length);

let unresolvedFlags = $derived(store.auditFlags.filter((f) => !f.resolved));

let sceneSummary = $derived.by(() => {
  const total = store.scenes.length;
  const complete = store.scenes.filter((s) => s.status === "complete").length;
  return { total, complete };
});

function getFilename(): string {
  const title = store.chapterArc?.workingTitle ?? "essay";
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const ext = format === "markdown" ? "md" : "txt";
  return `${slug}-${Date.now()}.${ext}`;
}

function handleCopy() {
  navigator.clipboard.writeText(exported);
}

function handleDownload() {
  const mimeType = format === "markdown" ? "text/markdown" : "text/plain";
  const blob = new Blob([exported], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getFilename();
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<div class="export-stage">
  <div class="export-container">
    <h2 class="export-title">Export Prose</h2>

    {#if unresolvedFlags.length > 0}
      <div class="export-warning">
        <Badge variant="warning">{unresolvedFlags.length} unresolved audit flag{unresolvedFlags.length !== 1 ? "s" : ""}</Badge>
        <span class="warning-text">Consider resolving flags before final export.</span>
      </div>
    {/if}

    <div class="export-stats">
      <span>{sceneSummary.complete}/{sceneSummary.total} sections complete</span>
      <span>{wordCount.toLocaleString()} words</span>
    </div>

    <div class="export-format">
      <span class="format-label">Format</span>
      <RadioGroup
        name="exportFormat"
        value={format}
        options={[
          { value: "markdown", label: "Markdown (.md)" },
          { value: "plaintext", label: "Plain Text (.txt)" },
        ]}
        onchange={(v) => { format = v as "markdown" | "plaintext"; }}
      />
    </div>

    <div class="export-actions">
      <Button onclick={handleCopy} disabled={!exported}>Copy to Clipboard</Button>
      <Button variant="primary" onclick={handleDownload} disabled={!exported}>Download {getFilename()}</Button>
    </div>

    {#if exported}
      <div class="export-preview-section">
        <span class="format-label">Preview</span>
        <pre class="export-preview">{exported}</pre>
      </div>
    {:else}
      <div class="export-empty">No prose to export. Generate and complete sections first.</div>
    {/if}
  </div>
</div>

<style>
  .export-stage {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .export-container {
    max-width: 700px;
    margin: 0 auto;
  }

  .export-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .export-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--border));
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .warning-text {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .export-stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .export-format {
    margin-bottom: 16px;
  }

  .format-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 6px;
  }

  .export-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .export-preview-section {
    margin-top: 8px;
  }

  .export-preview {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px;
    overflow: auto;
    max-height: 400px;
    white-space: pre-wrap;
    color: var(--text-primary);
  }

  .export-empty {
    color: var(--text-muted);
    padding: 32px;
    text-align: center;
    font-size: 12px;
  }
</style>
