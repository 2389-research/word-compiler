<script lang="ts">
import { bootstrapToBible, buildBootstrapPrompt, parseBootstrapResponse } from "../../bootstrap/index.js";
import { generateStream } from "../../llm/client.js";
import { generateId } from "../../types/index.js";
import { Button, ErrorBanner, Modal, Spinner, TextArea } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import type { ProjectStore } from "../store/project.svelte.js";

let {
  store,
  commands,
}: {
  store: ProjectStore;
  commands: Commands;
} = $props();

let synopsis = $state("");
let loading = $state(false);
let status = $state("");
let streamText = $state("");
let elapsed = $state(0);
let error = $state<string | null>(null);
let timerRef: ReturnType<typeof setInterval> | null = null;

function handleClose() {
  store.setBootstrapOpen(false);
  error = null;
  status = "";
  streamText = "";
  elapsed = 0;
  if (timerRef) clearInterval(timerRef);
}

async function handleBootstrap() {
  if (!synopsis.trim()) return;

  loading = true;
  error = null;
  streamText = "";
  elapsed = 0;

  const started = Date.now();
  timerRef = setInterval(() => {
    elapsed = Math.floor((Date.now() - started) / 1000);
  }, 1000);

  try {
    status = "Building prompt...";
    const payload = buildBootstrapPrompt(synopsis);

    status = "Streaming from LLM...";
    let fullText = "";

    await generateStream(payload, {
      onToken: (text) => {
        fullText += text;
        streamText = fullText;
      },
      onDone: () => {
        status = "Parsing response...";
      },
      onError: (err) => {
        throw new Error(err);
      },
    });

    const parsed = parseBootstrapResponse(fullText);
    if ("error" in parsed) {
      error = `Parse failed: ${parsed.error}\n\nRaw response:\n${fullText.slice(0, 500)}`;
      loading = false;
      status = "";
      return;
    }

    const bible = bootstrapToBible(parsed, store.project?.id ?? generateId(), synopsis);
    status = "Done!";
    await commands.saveBible(bible);

    setTimeout(() => {
      store.setBootstrapOpen(false);
      loading = false;
      status = "";
      streamText = "";
      elapsed = 0;
    }, 600);
  } catch (err) {
    error = err instanceof Error ? err.message : "Bootstrap failed";
    loading = false;
    status = "";
  } finally {
    if (timerRef) clearInterval(timerRef);
  }
}
</script>

<Modal open={store.bootstrapModalOpen} onClose={handleClose}>
  {#snippet header()}Bootstrap Bible from Synopsis{/snippet}

  <p class="modal-instructions">
    Paste your story synopsis. The system will extract characters, locations, tone, and a suggested avoid list.
    You'll need to add dialogue samples manually.
  </p>

  {#if !loading}
    <TextArea
      bind:value={synopsis}
      placeholder={`Example synopsis — replace with your own:\n\nMarcus Cole, a retired homicide detective turned bar owner, runs a dimly lit jazz bar called "The Velvet" in a decaying waterfront district...`}
    />
  {:else}
    <div class="stream-display">{streamText || "Waiting for first token..."}</div>
  {/if}

  {#if loading}
    <div class="status-bar">
      <Spinner size="sm" />
      <span>{status}</span>
      <span class="status-meta">{elapsed}s · {streamText.length} chars</span>
    </div>
  {/if}

  {#if error}
    <div class="modal-error-wrap">
      <ErrorBanner message={error} />
    </div>
  {/if}

  {#snippet footer()}
    <Button onclick={handleClose}>Cancel</Button>
    <Button variant="primary" onclick={handleBootstrap} disabled={loading || !synopsis.trim()}>
      {loading ? "Bootstrapping..." : "Bootstrap Bible"}
    </Button>
  {/snippet}
</Modal>

<style>
  .modal-instructions { margin-bottom: 12px; color: var(--text-secondary); font-size: 12px; }
  .stream-display {
    font-family: var(--font-mono); font-size: 11px; background: var(--bg-input);
    border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; height: 300px;
    overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--text-primary);
  }
  .status-bar {
    margin-top: 8px; padding: 6px 10px; border-radius: var(--radius-md); font-size: 11px;
    display: flex; align-items: center; gap: 8px;
  }
  .status-meta { color: var(--text-secondary); margin-left: auto; }
  .modal-error-wrap { margin-top: 8px; }
  .modal-error-wrap :global(.error-banner) { white-space: pre-wrap; }
</style>
