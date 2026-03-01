<script lang="ts">
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { untrack } from "svelte";
import type { EditorialAnnotation } from "../../review/types.js";
import AnnotationTooltip from "./AnnotationTooltip.svelte";
import { offsetToPos, textToDoc } from "./prosemirror-utils.js";

let {
  text,
  annotations = [],
  readonly = false,
  onTextChange,
  onAcceptSuggestion,
  onDismissAnnotation,
}: {
  text: string;
  annotations?: EditorialAnnotation[];
  readonly?: boolean;
  onTextChange?: (newText: string) => void;
  onAcceptSuggestion?: (annotationId: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
} = $props();

let editorElement: HTMLDivElement;
// Plain variable — NOT reactive. TipTap's Editor is a complex external object
// that must not participate in Svelte's dependency tracking.
let editor: Editor | null = null;
let applyingExternal = false;
let activeAnnotation = $state<EditorialAnnotation | null>(null);
let tooltipPosition = $state({ top: 0, left: 0, anchorBottom: 0 });

const editorialKey = new PluginKey("editorial-annotations");

function makeDecorations(ed: Editor, anns: EditorialAnnotation[]): DecorationSet {
  const decorations: Decoration[] = [];
  for (const ann of anns) {
    if (ann.charRange.start === ann.charRange.end) continue;
    const from = offsetToPos(ed, ann.charRange.start);
    const to = offsetToPos(ed, ann.charRange.end);
    if (from >= to) continue;
    decorations.push(
      Decoration.inline(
        from,
        to,
        {
          class: `editorial-squiggle editorial-${ann.severity}`,
          "data-annotation-id": ann.id,
        },
        { inclusiveStart: true, inclusiveEnd: true },
      ),
    );
  }
  return DecorationSet.create(ed.state.doc, decorations);
}

function createEditorialPlugin(): Plugin {
  return new Plugin({
    key: editorialKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, prev) {
        const meta = tr.getMeta(editorialKey);
        if (meta?.decoSet) {
          return meta.decoSet as DecorationSet;
        }
        if (tr.docChanged) {
          return prev.map(tr.mapping, tr.doc);
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return editorialKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

// ─── Editor Lifecycle ───────────────────────────
// Only depends on editorElement (bound once on mount). Editor is NOT reactive.
$effect(() => {
  if (!editorElement) return;

  // Read text/readonly without tracking — dedicated sync effects handle updates.
  const initialText = untrack(() => text);
  const initialReadonly = untrack(() => readonly);

  const ed = new Editor({
    element: editorElement,
    extensions: [Document, Paragraph, Text],
    content: textToDoc(initialText),
    editable: !initialReadonly,
    editorProps: {
      attributes: {
        class: "annotated-editor-content",
      },
    },
    onUpdate({ editor: updatedEd }) {
      if (applyingExternal || readonly) return;
      const newText = updatedEd.getText({ blockSeparator: "\n\n" });
      onTextChange?.(newText);
    },
  });

  ed.registerPlugin(createEditorialPlugin());
  editor = ed;

  return () => {
    ed.destroy();
    editor = null;
  };
});

// ─── Sync External Text ─────────────────────────
// Reacts to `text` prop changes. Reads `editor` without tracking.
$effect(() => {
  const newText = text;
  const ed = untrack(() => editor);
  if (!ed) return;
  const currentText = ed.getText({ blockSeparator: "\n\n" });
  if (newText !== currentText) {
    applyingExternal = true;
    ed.commands.setContent(textToDoc(newText));
    applyingExternal = false;
  }
});

// ─── Sync Annotations ───────────────────────────
// Reacts to `annotations` prop changes. Reads `editor` without tracking.
$effect(() => {
  const anns = annotations;
  const ed = untrack(() => editor);
  if (!ed) return;
  const decoSet = makeDecorations(ed, anns);
  const tr = ed.state.tr.setMeta(editorialKey, { decoSet });
  ed.view.dispatch(tr);
});

// ─── Sync Readonly ──────────────────────────────
// Reacts to `readonly` prop changes. Reads `editor` without tracking.
$effect(() => {
  const isReadonly = readonly;
  const ed = untrack(() => editor);
  if (!ed) return;
  ed.setEditable(!isReadonly);
});

// ─── Hover Handling ─────────────────────────────
let leaveTimeout: ReturnType<typeof setTimeout> | undefined;

function handleMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // Ignore events from inside the tooltip — let the tooltip stay visible
  if (target.closest?.(".annotation-tooltip")) {
    clearTimeout(leaveTimeout);
    return;
  }

  const squiggle = target.closest?.("[data-annotation-id]");
  if (!squiggle) {
    // Not on a squiggle and not on the tooltip — schedule hide with grace period
    clearTimeout(leaveTimeout);
    leaveTimeout = setTimeout(() => {
      activeAnnotation = null;
    }, 150);
    return;
  }

  // Cancel any pending leave timeout — user re-entered a squiggle
  clearTimeout(leaveTimeout);

  const annId = (squiggle as HTMLElement).dataset.annotationId;
  const ann = annotations.find((a) => a.id === annId);
  if (!ann) return;

  const rect = (squiggle as HTMLElement).getBoundingClientRect();
  const wrapperRect = editorElement.getBoundingClientRect();
  tooltipPosition = {
    top: rect.bottom - wrapperRect.top + 4,
    left: Math.max(0, rect.left - wrapperRect.left),
    anchorBottom: rect.top - wrapperRect.top,
  };
  activeAnnotation = ann;
}

function handleMouseLeave() {
  // Delay to allow crossing the gap between squiggle and tooltip
  clearTimeout(leaveTimeout);
  leaveTimeout = setTimeout(() => {
    activeAnnotation = null;
  }, 200);
}

function handleAccept(id: string) {
  const ann = annotations.find((a) => a.id === id);
  if (!ann?.suggestion || !editor) return;

  const from = offsetToPos(editor, ann.charRange.start);
  const to = offsetToPos(editor, ann.charRange.end);
  // Suppress onUpdate during suggestion application — we fire onTextChange once below
  applyingExternal = true;
  const tr = editor.state.tr.replaceWith(from, to, editor.state.schema.text(ann.suggestion));
  editor.view.dispatch(tr);
  applyingExternal = false;
  // Propagate the updated text to the parent
  const newText = editor.getText({ blockSeparator: "\n\n" });
  onTextChange?.(newText);
  activeAnnotation = null;
  onAcceptSuggestion?.(id);
}

function handleDismiss(id: string) {
  activeAnnotation = null;
  onDismissAnnotation?.(id);
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="annotated-editor-wrapper"
  onmouseover={handleMouseOver}
  onmouseleave={handleMouseLeave}
>
  <div bind:this={editorElement} class="annotated-editor"></div>
  {#if activeAnnotation}
    <AnnotationTooltip
      annotation={activeAnnotation}
      position={tooltipPosition}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
    />
  {/if}
</div>

<style>
  .annotated-editor-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .annotated-editor {
    height: 100%;
    overflow-y: auto;
  }
  .annotated-editor :global(.annotated-editor-content) {
    outline: none;
    padding: 10px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    min-height: 100%;
  }

  /* Squiggle underlines */
  .annotated-editor :global(.editorial-squiggle) {
    background-repeat: repeat-x;
    background-position: bottom;
    background-size: 4px 3px;
    padding-bottom: 2px;
  }
  .annotated-editor :global(.editorial-critical) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%23ef4444' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-warning) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%23f59e0b' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-info) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%233b82f6' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-squiggle:hover) {
    cursor: pointer;
    opacity: 0.9;
  }
</style>
