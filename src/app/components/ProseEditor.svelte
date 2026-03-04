<script lang="ts">
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { untrack } from "svelte";
import { buildContinuousText } from "../../review/refine.js";
import type {
  RefinementChip,
  RefinementRequest,
  RefinementResult,
  RefinementState,
  RefinementVariant,
} from "../../review/refineTypes.js";
import type { Chunk } from "../../types/index.js";
import { Button } from "../primitives/index.js";
import type { Commands } from "../store/commands.js";
import { posToOffset, textToDoc } from "./prosemirror-utils.js";
import RefinementPopover from "./RefinementPopover.svelte";

let {
  chunks,
  sceneId,
  commands,
  onRequestRefinement,
}: {
  chunks: Chunk[];
  sceneId: string;
  commands: Commands;
  onRequestRefinement: (request: RefinementRequest) => Promise<RefinementResult | null>;
} = $props();

let editorElement: HTMLDivElement;
let editor: Editor | null = null;
let applyingExternal = false;

// State machine
let refinementState = $state<RefinementState>("idle");
let selectedText = $state("");
let selectionStart = $state(0);
let selectionEnd = $state(0);
let popoverPosition = $state<{ top: number; left: number; anchorBottom?: number }>({ top: 0, left: 0 });
let variants = $state<RefinementVariant[]>([]);
let cutPreviewText = $state<string | null>(null);

// Build continuous text reactively
let continuous = $derived(buildContinuousText(chunks));

// ─── Editor Lifecycle ───────────────────────────
$effect(() => {
  if (!editorElement) return;

  const initialText = untrack(() => continuous.text);

  const ed = new Editor({
    element: editorElement,
    extensions: [Document, Paragraph, Text],
    content: textToDoc(initialText),
    editable: true,
    editorProps: {
      attributes: {
        class: "prose-editor-content",
      },
    },
    onSelectionUpdate({ editor: updatedEd }) {
      if (applyingExternal) return;
      const { from, to } = updatedEd.state.selection;
      if (from === to) {
        // Collapsed selection — dismiss popover
        if (refinementState === "selecting") {
          refinementState = "idle";
        }
        return;
      }

      const text = updatedEd.state.doc.textBetween(from, to, "\n\n");
      if (!text.trim()) return;

      selectedText = text;
      selectionStart = posToOffset(updatedEd, from);
      selectionEnd = posToOffset(updatedEd, to);

      // Position popover below selection
      const coords = updatedEd.view.coordsAtPos(to);
      const wrapperRect = editorElement.getBoundingClientRect();
      popoverPosition = {
        top: coords.bottom - wrapperRect.top + 6,
        left: Math.max(0, coords.left - wrapperRect.left),
        anchorBottom: coords.top - wrapperRect.top,
      };

      refinementState = "selecting";
      variants = [];
      cutPreviewText = null;
    },
  });

  editor = ed;

  return () => {
    ed.destroy();
    editor = null;
  };
});

// ─── Sync External Text ─────────────────────────
$effect(() => {
  const newText = continuous.text;
  const ed = untrack(() => editor);
  if (!ed) return;
  const currentText = ed.getText({ blockSeparator: "\n\n" });
  if (newText !== currentText) {
    applyingExternal = true;
    try {
      ed.commands.setContent(textToDoc(newText));
    } finally {
      applyingExternal = false;
    }
  }
});

// ─── Lock editor during loading ─────────────────
$effect(() => {
  const state = refinementState;
  const ed = untrack(() => editor);
  if (!ed) return;
  ed.setEditable(state !== "loading");
});

// ─── Handlers ───────────────────────────────────
async function handleRefine(instruction: string, chips: RefinementChip[]) {
  refinementState = "loading";

  try {
    const request: RefinementRequest = {
      sceneId,
      selectedText,
      selectionStart,
      selectionEnd,
      instruction,
      chips,
    };

    const result = await onRequestRefinement(request);

    if (result && result.variants.length > 0) {
      variants = result.variants;
      refinementState = "reviewing";
    } else {
      refinementState = "selecting";
    }
  } catch {
    refinementState = "selecting";
  }
}

function handleCut() {
  // Show a preview of the text with the selection removed
  const text = continuous.text;
  cutPreviewText = text.slice(0, selectionStart) + text.slice(selectionEnd);
  refinementState = "cutting";
}

async function handleConfirmCut() {
  const result = await commands.applyRefinement(sceneId, selectionStart, selectionEnd, "");
  if (result.ok) {
    refinementState = "idle";
    cutPreviewText = null;
  }
}

function handleCancelCut() {
  cutPreviewText = null;
  refinementState = "selecting";
}

async function handleAcceptVariant(variant: RefinementVariant) {
  const result = await commands.applyRefinement(sceneId, selectionStart, selectionEnd, variant.text);
  if (result.ok) {
    refinementState = "idle";
    variants = [];
  }
}

function handleKeepOriginal() {
  refinementState = "idle";
  variants = [];
}

function handleCancel() {
  refinementState = "idle";
  variants = [];
  cutPreviewText = null;
}
</script>

<div class="prose-editor-wrapper">
  <div bind:this={editorElement} class="prose-editor"></div>

  {#if refinementState === "cutting" && cutPreviewText !== null}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="cut-preview-popover"
      style:top={popoverPosition.top + "px"}
      style:left={popoverPosition.left + "px"}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="cut-preview-label">Preview after removing selection:</div>
      <div class="cut-preview-text">
        ...{cutPreviewText.slice(Math.max(0, selectionStart - 60), selectionStart)}<span class="cut-join">|</span>{cutPreviewText.slice(selectionStart, selectionStart + 60)}...
      </div>
      <div class="cut-preview-actions">
        <Button size="sm" variant="primary" onclick={handleConfirmCut}>Remove</Button>
        <Button size="sm" variant="ghost" onclick={handleCancelCut}>Cancel</Button>
      </div>
    </div>
  {/if}

  {#if refinementState === "selecting" || refinementState === "loading" || refinementState === "reviewing"}
    <RefinementPopover
      {selectedText}
      loading={refinementState === "loading"}
      {variants}
      position={popoverPosition}
      onRefine={handleRefine}
      onCut={handleCut}
      onAcceptVariant={handleAcceptVariant}
      onKeepOriginal={handleKeepOriginal}
      onCancel={handleCancel}
    />
  {/if}
</div>

<style>
  .prose-editor-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .prose-editor {
    height: 100%;
    overflow-y: auto;
  }

  .prose-editor :global(.prose-editor-content) {
    outline: none;
    padding: 24px 48px;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    min-height: 100%;
    max-width: 720px;
    margin: 0 auto;
    color: var(--text-primary);
  }

  .prose-editor :global(.prose-editor-content p) {
    margin-bottom: 1em;
  }

  .prose-editor :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--accent);
  }

  .cut-preview-popover {
    position: absolute;
    z-index: 100;
    background: var(--bg-card, #1e1e2e);
    border: 1px solid var(--error, #ef4444);
    border-radius: var(--radius-md, 6px);
    padding: 10px;
    max-width: 420px;
    min-width: 280px;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-size: 12px;
  }

  .cut-preview-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .cut-preview-text {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .cut-join {
    color: var(--error, #ef4444);
    font-weight: 700;
  }

  .cut-preview-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
</style>
