<script lang="ts">
import { bootstrapToBible, buildBootstrapPrompt, parseBootstrapResponse } from "../../bootstrap/index.js";
import { generateStream } from "../../llm/client.js";
import type { Bible } from "../../types/index.js";
import { ErrorBanner, Spinner, TextArea } from "../primitives/index.js";

export type BootstrapFooterState = {
  loading: boolean;
  canGenerate: boolean;
};

let {
  projectId,
  onCommit,
  footerState = $bindable({ loading: false, canGenerate: false }),
}: {
  projectId: string;
  onCommit: (bible: Bible, sourcePrompt: string) => Promise<void>;
  footerState?: BootstrapFooterState;
} = $props();

let synopsis = $state("");
let bsLoading = $state(false);
let bsStatus = $state("");
let bsStreamText = $state("");
let bsElapsed = $state(0);
let bsError = $state<string | null>(null);
let bsTimerRef: ReturnType<typeof setInterval> | null = null;

$effect(() => {
  footerState = {
    loading: bsLoading,
    canGenerate: !!synopsis.trim(),
  };
});

$effect(() => {
  return () => {
    if (bsTimerRef) clearInterval(bsTimerRef);
  };
});

export async function bootstrap() {
  if (!synopsis.trim()) return;

  bsLoading = true;
  bsError = null;
  bsStreamText = "";
  bsElapsed = 0;

  const started = Date.now();
  bsTimerRef = setInterval(() => {
    bsElapsed = Math.floor((Date.now() - started) / 1000);
  }, 1000);

  try {
    bsStatus = "Building prompt...";
    const payload = buildBootstrapPrompt(synopsis);

    bsStatus = "Streaming from LLM...";
    let fullText = "";

    await generateStream(payload, {
      onToken: (text) => {
        fullText += text;
        bsStreamText = fullText;
      },
      onDone: () => {
        bsStatus = "Parsing response...";
      },
      onError: (err) => {
        throw new Error(err);
      },
    });

    const parsed = parseBootstrapResponse(fullText);
    if ("error" in parsed) {
      bsError = `Parse failed: ${parsed.error}\n\nRaw response:\n${fullText.slice(0, 500)}`;
      bsLoading = false;
      bsStatus = "";
      return;
    }

    const result = bootstrapToBible(parsed, projectId, synopsis);
    bsStatus = "Done!";
    await onCommit(result, synopsis);

    bsLoading = false;
    bsStatus = "";
    bsStreamText = "";
    bsElapsed = 0;
  } catch (err) {
    bsError = err instanceof Error ? err.message : "Bootstrap failed";
    bsLoading = false;
    bsStatus = "";
  } finally {
    if (bsTimerRef) clearInterval(bsTimerRef);
  }
}

export function reset() {
  bsError = null;
  bsStatus = "";
  bsStreamText = "";
  bsElapsed = 0;
  if (bsTimerRef) clearInterval(bsTimerRef);
}
</script>

<p class="modal-instructions">
  Paste your essay idea or outline. The system will extract your thesis, section structure, tone, and a suggested avoid list.
</p>

{#if !bsLoading}
  <TextArea
    bind:value={synopsis}
    placeholder={`Example brief — replace with your own:\n\nAn essay arguing that most productivity advice fails knowledge workers because it treats creative work like factory output. Opens with a personal anecdote, builds through three counterexamples, closes with a reframed definition of productive work.`}
  />
{:else}
  <div class="stream-display">{bsStreamText || "Waiting for first token..."}</div>
{/if}

{#if bsLoading}
  <div class="status-bar">
    <Spinner size="sm" />
    <span>{bsStatus}</span>
    <span class="status-meta">{bsElapsed}s · {bsStreamText.length} chars</span>
  </div>
{/if}

{#if bsError}
  <div class="modal-error-wrap"><ErrorBanner message={bsError} /></div>
{/if}

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
</style>
