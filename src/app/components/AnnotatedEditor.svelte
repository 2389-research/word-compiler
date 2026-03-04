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
  onRequestSuggestion,
}: {
  text: string;
  annotations?: EditorialAnnotation[];
  readonly?: boolean;
  onTextChange?: (newText: string) => void;
  onAcceptSuggestion?: (annotationId: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
  onRequestSuggestion?: (id: string, feedback: string) => Promise<string | null>;
} = $props();

let editorElement: HTMLDivElement;
// Plain variable — NOT reactive. TipTap's Editor is a complex external object
// that must not participate in Svelte's dependency tracking.
let editor: Editor | null = null;
let applyingExternal = false;
let activeAnnotation = $state<EditorialAnnotation | null>(null);
let tooltipPosition = $state({ top: 0, left: 0, anchorBottom: 0 });
let tooltipPinned = $state(false);

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
        { inclusiveStart: true, inclusiveEnd: true, annotationId: ann.id },
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
        // Remap decoration positions through document changes
        let next = tr.docChanged ? prev.map(tr.mapping, tr.doc) : prev;
        // Remove a specific annotation's decoration (after accepting a suggestion)
        if (meta?.removeAnnotationId) {
          const toRemove = next.find(undefined, undefined, (spec) => spec.annotationId === meta.removeAnnotationId);
          if (toRemove.length > 0) {
            next = next.remove(toRemove);
          }
        }
        return next;
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
// Guard: if any annotation's charRange doesn't match its anchor.focus in the
// current editor text, the annotations are stale (computed against a prior
// text version). Skip the sync — the PM plugin already maintains correctly-
// remapped decorations through edits, so skipping preserves good positions.
$effect(() => {
  const anns = annotations;
  const ed = untrack(() => editor);
  if (!ed) return;

  if (anns.length > 0) {
    const currentText = ed.getText({ blockSeparator: "\n\n" });
    const hasStale = anns.some((a) => {
      if (a.charRange.start >= a.charRange.end) return false;
      if (a.charRange.end > currentText.length) return true;
      return currentText.slice(a.charRange.start, a.charRange.end) !== a.anchor.focus;
    });
    if (hasStale) return;
  }

  const decoSet = makeDecorations(ed, anns);
  const tr = ed.state.tr.setMeta(editorialKey, { decoSet });
  ed.view.dispatch(tr);
});

// ─── Sync Active Annotation ─────────────────────
// When annotations prop updates (e.g. suggestion generated), refresh
// activeAnnotation so the tooltip reflects the new data.
// Compare by value (suggestion field) not reference — Svelte 5 $state
// proxies have different identities so !== always returns true.
$effect(() => {
  const anns = annotations;
  const active = untrack(() => activeAnnotation);
  if (!active) return;
  const updated = anns.find((a) => a.id === active.id);
  if (updated && updated.suggestion !== active.suggestion) {
    activeAnnotation = updated;
  }
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
    // Don't dismiss a pinned tooltip (user is actively interacting with it)
    if (tooltipPinned) return;
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

  // Hovering a different squiggle unpins the previous tooltip
  if (tooltipPinned && activeAnnotation && activeAnnotation.id !== annId) {
    tooltipPinned = false;
  }

  const rect = (squiggle as HTMLElement).getBoundingClientRect();
  tooltipPosition = {
    top: rect.bottom + 4,
    left: rect.left,
    anchorBottom: rect.top,
  };
  activeAnnotation = ann;
}

function handleMouseLeave() {
  if (tooltipPinned) return;
  // Delay to allow crossing the gap between squiggle and tooltip
  clearTimeout(leaveTimeout);
  leaveTimeout = setTimeout(() => {
    activeAnnotation = null;
  }, 200);
}

function handleFocusIn(e: FocusEvent) {
  const target = e.target as HTMLElement;
  if (target.closest?.(".annotation-tooltip")) {
    tooltipPinned = true;
    clearTimeout(leaveTimeout);
  }
}

function handleEditorClick(e: MouseEvent) {
  if (!tooltipPinned) return;
  const target = e.target as HTMLElement;
  // Click outside the tooltip unpins and dismisses
  if (!target.closest?.(".annotation-tooltip")) {
    tooltipPinned = false;
    activeAnnotation = null;
  }
}

const ADVISORY_PREFIXES = [
  "consider ",
  "try ",
  "perhaps ",
  "you might ",
  "you could ",
  "it would be ",
  "this could ",
  "think about ",
  "maybe ",
  "instead of ",
  "rather than ",
  "avoid ",
  "if the ",
];

function looksLikeAdvice(text: string): boolean {
  const lower = text.trimStart().toLowerCase();
  return ADVISORY_PREFIXES.some((p) => lower.startsWith(p));
}

function handleAccept(id: string) {
  tooltipPinned = false;
  const ann = annotations.find((a) => a.id === id);
  if (!ann?.suggestion || !editor) return;

  // Guard: don't insert editorial advice into prose
  if (looksLikeAdvice(ann.suggestion)) {
    console.warn("[editorial] Blocked advisory suggestion from insertion:", ann.suggestion.slice(0, 80));
    activeAnnotation = null;
    onDismissAnnotation?.(id);
    return;
  }

  // Look up the decoration's CURRENT positions (correctly remapped through prior edits)
  // instead of using ann.charRange which may be stale after prior acceptances.
  const decoSet = editorialKey.getState(editor.state) as DecorationSet | undefined;
  if (!decoSet) return;
  const matching = decoSet.find(undefined, undefined, (spec) => spec.annotationId === id);
  if (matching.length === 0) {
    // Decoration was removed by ProseMirror's mapping (e.g., overlapping edit) — dismiss
    console.warn("[editorial] Decoration gone for annotation", id, "— dismissing");
    activeAnnotation = null;
    onDismissAnnotation?.(id);
    return;
  }

  const from = matching[0]!.from;
  const to = matching[0]!.to;

  // Replace text AND remove the accepted decoration in a single transaction.
  // The plugin's apply method handles both: remapping other decorations through
  // the text change, then removing the accepted one via removeAnnotationId meta.
  applyingExternal = true;
  const tr = editor.state.tr
    .replaceWith(from, to, editor.state.schema.text(ann.suggestion))
    .setMeta(editorialKey, { removeAnnotationId: id });
  editor.view.dispatch(tr);
  applyingExternal = false;

  // Propagate the updated text to the parent
  const newText = editor.getText({ blockSeparator: "\n\n" });
  onTextChange?.(newText);
  activeAnnotation = null;
  onAcceptSuggestion?.(id);
}

function handleDismiss(id: string) {
  tooltipPinned = false;
  activeAnnotation = null;
  // Remove the decoration via PM transaction to avoid triggering
  // Sync Annotations with stale charRanges (same fix as handleAccept).
  if (editor) {
    const tr = editor.state.tr.setMeta(editorialKey, { removeAnnotationId: id });
    editor.view.dispatch(tr);
  }
  onDismissAnnotation?.(id);
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="annotated-editor-wrapper"
  onmouseover={handleMouseOver}
  onmouseleave={handleMouseLeave}
  onfocusin={handleFocusIn}
  onclick={handleEditorClick}
>
  <div bind:this={editorElement} class="annotated-editor"></div>
  {#if activeAnnotation}
    <AnnotationTooltip
      annotation={activeAnnotation}
      position={tooltipPosition}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
      {onRequestSuggestion}
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
  .annotated-editor :global(.annotated-editor-content p + p) {
    margin-top: 0.8em;
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
