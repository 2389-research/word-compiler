<script lang="ts">
import { exportToMarkdown } from "../../export/markdown.js";
import { exportToPlaintext } from "../../export/plaintext.js";
import { Button, Modal, RadioGroup } from "../primitives/index.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  open,
  onClose,
  store,
  initialFormat,
}: {
  open: boolean;
  onClose: () => void;
  store: ProjectStore;
  initialFormat?: "markdown" | "plaintext";
} = $props();

let format = $state<"markdown" | "plaintext">(initialFormat ?? "markdown");

let exported = $derived.by(() => {
  if (!open) return "";
  if (format === "markdown") {
    return exportToMarkdown(store.scenes, store.sceneChunks, store.chapterArc);
  }
  return exportToPlaintext(store.scenes, store.sceneChunks);
});

let preview = $derived(exported.length > 500 ? `${exported.slice(0, 500)}…` : exported);

let wordCount = $derived(exported.split(/\s+/).filter(Boolean).length);

function getFilename(): string {
  const title = store.chapterArc?.workingTitle ?? "chapter";
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const ext = format === "markdown" ? "md" : "txt";
  return `${slug}-${Date.now()}.${ext}`;
}

function handleCopy() {
  navigator.clipboard.writeText(exported).then(() => {
    onClose();
  });
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
  onClose();
}
</script>

<Modal {open} {onClose} width="wide">
  {#snippet header()}Export Prose{/snippet}

  <div class="export-format">
    <RadioGroup
      name="exportFormat"
      value={format}
      options={[
        { value: "markdown", label: "Markdown" },
        { value: "plaintext", label: "Plain Text" },
      ]}
      onchange={(v) => { format = v as "markdown" | "plaintext"; }}
    />
  </div>

  {#if exported}
    <div class="export-meta">
      {wordCount.toLocaleString()} words · {format === "markdown" ? ".md" : ".txt"}
    </div>
    <pre class="export-preview">{preview}</pre>
  {:else}
    <div class="export-empty">No prose to export. Generate some chunks first.</div>
  {/if}

  {#snippet footer()}
    <Button onclick={onClose}>Cancel</Button>
    <Button onclick={handleCopy} disabled={!exported}>Copy to Clipboard</Button>
    <Button variant="primary" onclick={handleDownload} disabled={!exported}>Download File</Button>
  {/snippet}
</Modal>

<style>
  .export-format { margin-bottom: 12px; }
  .export-meta { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
  .export-preview {
    font-family: var(--font-mono); font-size: 11px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px;
    overflow: auto; max-height: 300px; white-space: pre-wrap; color: var(--text-primary);
  }
  .export-empty { color: var(--text-muted); padding: 20px; text-align: center; font-size: 12px; }
</style>
