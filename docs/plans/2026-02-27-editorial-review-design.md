# Editorial Review Engine — Design Document

> **Historical document.** This design document was written during active development and references AI-assisted adversarial review sessions used during the design process.

**Goal:** Provide real-time inline editorial feedback (squiggly underlines with hover tooltips) for prose chunks, using a two-tier system: instant deterministic checks plus on-save LLM-powered judgment-based review.

**Architecture:** Three layers — Review Engine (types, LLM prompt, anchor resolution), Review Orchestrator (on-save pipeline, abort/retry, suppression), Annotated Editor (TipTap/ProseMirror + Svelte 5 decorations). Deterministic checks (kill list, rhythm, paragraph length) run instantly from existing auditor functions. LLM review adds tone, voice, grammar, POV, show-don't-tell, and other judgment-based categories.

**Tech Stack:** TipTap Core + ProseMirror (direct, not svelte-tiptap), Svelte 5 runes, Claude Sonnet 4.5 with structured outputs, existing `callLLM` with `outputSchema`.

---

## 1. Overview

### Trigger
On-save review. When the user saves a chunk edit (debounced at 500ms, same as existing persistence), a review is triggered for all visible chunks. Not as-you-type.

### Scope
Full creative editor: grammar, punctuation style, tone, rhythm (LLM judgment), show-don't-tell, dialogue voice, POV compliance, metaphoric register, vocabulary preferences, continuity.

### UX
Inline squiggly underlines (like Google Docs / Gmail). Hover shows tooltip with severity, category, message, and optional suggestion with "Apply" button. "Dismiss" button adds fingerprint to suppression cache.

### Two-Tier Feedback
1. **Tier 1 — Deterministic (instant, ~1ms):** Kill list regex, sentence variance, paragraph length. Reuses existing `src/auditor/index.ts` functions. Produces annotations with known-good character offsets.
2. **Tier 2 — LLM (async, ~1-3s):** Judgment-based categories. Uses Claude Sonnet 4.5 with structured output schema. Returns anchor triplets for fuzzy position resolution.

### What's NOT in scope
- As-you-type checking
- Rewriting prose automatically
- Replacing the existing auditor (this is complementary)
- Spell checking (browser handles this)

---

## 2. Review Engine Types

### Category Separation

Deterministic categories (existing auditor, instant): `kill_list`, `rhythm_monotony`, `paragraph_length`

LLM-only categories (judgment-based, async):

```typescript
type LLMReviewCategory =
  | "tone"           // matches bible's tone/mood intent
  | "grammar"        // grammar, syntax, word choice
  | "voice"          // character voice fingerprint adherence
  | "punctuation"    // punctuation style consistency
  | "show_dont_tell" // exposition vs dramatization
  | "pov"            // POV distance, interiority, reliability
  | "dialogue"       // dialogue technique, attribution, subtext
  | "metaphor"       // metaphoric register consistency
  | "vocabulary"     // vocabulary preferences / bans
  | "continuity";    // contradicts established facts

type Severity = "critical" | "warning" | "info"; // matches existing auditor
```

### Core Types

```typescript
interface EditorialAnnotation {
  id: string;
  category: LLMReviewCategory;
  severity: Severity;
  scope: "dialogue" | "narration" | "both";
  message: string;
  suggestion: string | null;
  anchor: { prefix: string; focus: string; suffix: string };
  charRange: { start: number; end: number };
  spans?: Array<{ start: number; end: number }>; // non-contiguous
  fingerprint: string; // hash(category + anchor.focus) for suppression
}

interface ReviewResult {
  chunkIndex: number;
  annotations: EditorialAnnotation[];
  modelUsed: string;
  reviewedAt: string;
  tokenBudget: { bibleContext: number; chunkText: number; total: number };
}
```

### Suppression

```typescript
interface DismissedAnnotation {
  fingerprint: string;
  dismissedAt: string;
  reason?: string;
}
```

Dismissed fingerprints persisted to localStorage per project. Annotations matching a dismissed fingerprint are filtered before rendering. Fingerprint = `hash(category + first 50 chars of anchor.focus)`.

### Bible Pre-filtering

Full bible can be 4000+ tokens. Pre-filter to ~800 tokens max:

```typescript
interface ReviewContext {
  styleRules: Pick<StyleGuide,
    "killList" | "metaphoricRegister" | "vocabularyPreferences" |
    "sentenceArchitecture" | "paragraphPolicy" | "structuralBans"
  >;
  activeVoices: Array<{ name: string; fingerprint: string }>;
  povRules: { distance: string; interiority: string; reliability: string } | null;
  toneIntent: string;
  maxTokens: 800; // hard cap on bible context
}
```

Includes only: present characters' voice fingerprints (from `presentCharacterIds`), active style rules, POV rules for scene's POV character, tone/mood. Skips: exemplars, location descriptions, chapter arcs, absent characters.

---

## 3. Fuzzy Anchor Mapping

LLMs can't count characters reliably. The anchor triplet (`prefix`, `focus`, `suffix`) is the source of truth. `charRange` is a best-effort hint.

### Algorithm

Three-path resolution: scan all candidates, score by adjacency + proximity, pick the best.

```typescript
interface AnchorMatch {
  start: number;
  end: number;
  confidence: "exact" | "fuzzy" | "failed";
}

function resolveAnchor(
  doc: string,
  anchor: { prefix: string; focus: string; suffix: string },
  charRangeHint: { start: number; end: number },
): AnchorMatch {
  const { prefix, focus, suffix } = anchor;
  const hasPrefix = !!prefix && prefix.length >= 2;
  const hasSuffix = !!suffix && suffix.length >= 2;
  const caret = Math.max(0, Math.min(charRangeHint.start, doc.length));
  const center = Math.max(0, Math.min(
    Math.floor((charRangeHint.start + charRangeHint.end) / 2), doc.length,
  ));

  // Score a focus occurrence by adjacency + proximity
  function score(i: number): { conf: "exact" | "fuzzy"; score: number } | null {
    const before = hasPrefix ? doc.slice(Math.max(0, i - prefix.length), i) : "";
    const after = hasSuffix
      ? doc.slice(i + focus.length, i + focus.length + suffix.length)
      : "";
    const prefixAdj = hasPrefix ? before.endsWith(prefix) : true;
    const suffixAdj = hasSuffix ? after.startsWith(suffix) : true;
    const exact = prefixAdj && suffixAdj;
    if (!exact && !prefixAdj && !suffixAdj && (hasPrefix || hasSuffix)) return null;
    const base = exact ? 1000 : 500;
    return { conf: exact ? "exact" : "fuzzy", score: base - Math.abs(i - center) };
  }

  // Path 1: Scan ALL focus occurrences, pick best
  if (focus) {
    let best: { i: number; conf: "exact" | "fuzzy"; score: number } | null = null;
    for (let i = doc.indexOf(focus, 0); i !== -1; i = doc.indexOf(focus, i + 1)) {
      const s = score(i);
      if (s && (!best || s.score > best.score)) {
        best = { i, conf: s.conf, score: s.score };
      }
    }
    if (best) {
      return { start: best.i, end: best.i + focus.length, confidence: best.conf };
    }
  }

  // Path 2: Fuzzy frame (prefix...suffix) — dynamic window
  if (hasPrefix && hasSuffix) {
    const margin = Math.max(400, prefix.length + suffix.length + 200);
    const wStart = Math.max(0, center - margin);
    const wEnd = Math.min(doc.length, center + margin);
    const window = doc.slice(wStart, wEnd);
    let best: { start: number; end: number; score: number } | null = null;
    for (let p = window.indexOf(prefix); p !== -1; p = window.indexOf(prefix, p + 1)) {
      const s = window.indexOf(suffix, p + prefix.length);
      if (s === -1) continue;
      const focusStart = wStart + p + prefix.length;
      const focusEnd = wStart + s;
      const gap = focusEnd - focusStart;
      const dist = Math.abs(focusStart - center);
      const sc = -(gap + dist / 10);
      if (!best || sc > best.score) {
        best = { start: focusStart, end: focusEnd, score: sc };
      }
    }
    if (best) return { start: best.start, end: best.end, confidence: "fuzzy" };
  }

  // Path 3: Zero-width caret — never highlight wrong text
  return { start: caret, end: caret, confidence: "failed" };
}
```

### Rendering Rules
- `"exact"` — solid squiggly underline
- `"fuzzy"` — dimmed/dashed underline (lower confidence)
- `"failed"` — annotation appears in gutter margin only, no inline highlight

### Design Decisions (validated by PAL adversarial review)
- Iterates ALL occurrences, scores by prefix/suffix adjacency + charRange proximity
- `endsWith`/`startsWith` instead of sloppy `includes` with buffer
- Empty anchors (<2 chars) treated as absent to prevent degenerate matches
- Dynamic search window: `max(400, prefix + suffix + 200)`
- Failed = zero-width caret, never a misleading highlight

---

## 4. Review Orchestrator

On-save pipeline coordinating local checks + LLM review + decoration updates.

```typescript
interface ReviewRequest {
  chunkIndex: number;
  text: string;
  sceneId: string;
  reviewContext: ReviewContext;
}

interface ChunkView {
  index: number;
  text: string; // editedText ?? generatedText
  sceneId: string;
}

interface ReviewOrchestrator {
  requestReview(chunks: ChunkView[]): void;
  cancelAll(): void;
  annotations: Map<number, EditorialAnnotation[]>;
  reviewing: Set<number>;
}
```

### Pipeline

```typescript
function createReviewOrchestrator(
  bible: Bible,
  scenePlan: ScenePlan,
  dismissed: Set<string>,
  onAnnotationsChanged: (chunkIndex: number, anns: EditorialAnnotation[]) => void,
): ReviewOrchestrator {
  let abortController: AbortController | null = null;
  const annotations = new Map<number, EditorialAnnotation[]>();
  const reviewing = new Set<number>();

  function requestReview(chunks: ChunkView[]) {
    abortController?.abort();
    abortController = new AbortController();

    for (const chunk of chunks) {
      // Tier 1: Deterministic (instant)
      const localAnnotations = runLocalChecks(chunk.text, bible, chunk.sceneId);

      // Tier 2: LLM review (async)
      reviewing.add(chunk.index);
      const context = buildReviewContext(bible, scenePlan, chunk);

      reviewWithLLM(chunk, context, abortController.signal)
        .then((llmAnnotations) => {
          const all = [...localAnnotations, ...llmAnnotations]
            .filter((a) => !dismissed.has(a.fingerprint));
          const resolved = all.map((a) => ({
            ...a,
            ...resolveAnchor(chunk.text, a.anchor, a.charRange),
          })).filter((a) => a.confidence !== "failed" || a.start !== a.end);
          annotations.set(chunk.index, resolved);
          onAnnotationsChanged(chunk.index, resolved);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          const filtered = localAnnotations.filter((a) => !dismissed.has(a.fingerprint));
          annotations.set(chunk.index, filtered);
          onAnnotationsChanged(chunk.index, filtered);
        })
        .finally(() => reviewing.delete(chunk.index));
    }
  }

  function cancelAll() {
    abortController?.abort();
    reviewing.clear();
  }

  return { requestReview, cancelAll, annotations, reviewing };
}
```

### Design Decisions
1. **Deterministic checks run first, LLM adds on top** — local annotations appear instantly.
2. **Abort on re-save** — only the latest version gets annotations.
3. **LLM failure is graceful** — local annotations still render.
4. **Dismissed fingerprints survive across reviews** — persisted set.
5. **Autopilot integration** — `cancelAll()` on autopilot start, `requestReview()` batch after completion.

---

## 5. Annotated Editor (TipTap/ProseMirror + Svelte 5)

Direct TipTap Core wrapping (svelte-tiptap is broken on Svelte 5's `$set` removal). ProseMirror `Decoration.inline()` for non-destructive visual overlays.

### ProseMirror Plugin

```typescript
const editorialKey = new PluginKey("editorial-annotations");

new Plugin({
  key: editorialKey,
  state: {
    init(_, state) {
      return makeDecorations(state.doc, []);
    },
    apply(tr, prev) {
      const meta = tr.getMeta(editorialKey);
      if (meta?.annotations) {
        return makeDecorations(tr.doc, meta.annotations);
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
```

### Position Mapping (string offset → ProseMirror position)

ProseMirror uses node-based positions where paragraph boundaries add +2 gaps. Must convert string offsets from `resolveAnchor` to PM positions:

```typescript
function offsetToPos(editor: Editor, offset: number): number {
  const doc = editor.state.doc;
  let acc = 0;
  let found: number | null = null;
  doc.descendants((node, pos, parent) => {
    if (found !== null) return false;
    if (node.isText) {
      const next = acc + node.text!.length;
      if (offset <= next) {
        found = pos + (offset - acc);
        return false;
      }
      acc = next;
    } else if (node.isBlock && parent) {
      if (acc > 0) acc += 2; // mirrors getText "\n\n" separator
    }
    return true;
  });
  return found ?? doc.content.size;
}
```

### Svelte 5 Component

Key lifecycle patterns (validated by PAL review):

1. **Create editor once** — `$effect` guards with `if (editor) return`. No re-creation on prop changes.
2. **Sync text via separate `$effect`** — calls `editor.commands.setContent()` only when external text differs from `editor.getText()`. Guards with `applyingExternal` flag to prevent echo loops.
3. **Push annotations via separate `$effect`** — dispatches transaction with `tr.setMeta(editorialKey, { annotations })`.
4. **`readonly` prop** — calls `editor.setEditable(!readonly)`. Squiggles render in both modes.
5. **Hover via event delegation** — single `mouseover` on container, `closest("[data-annotation-id]")`.
6. **Tooltip positioning** — absolute within positioned wrapper, clamped to viewport edges, recomputed on scroll.
7. **Decoration inclusivity** — `Decoration.inline(from, to, attrs, { inclusiveStart: true, inclusiveEnd: true })`.

### CSS Squiggles

```css
.editorial-squiggle {
  background-repeat: repeat-x;
  background-position: bottom;
  background-size: 4px 3px;
  padding-bottom: 2px;
}
.editorial-critical { /* red squiggle SVG */ }
.editorial-warning  { /* amber squiggle SVG */ }
.editorial-info     { /* blue squiggle SVG */ }
```

---

## 6. Suggestion Acceptance Flow

### Accept

1. User hovers squiggle → tooltip with message + suggestion
2. Clicks "Apply" → `acceptSuggestion(id)` runs
3. ProseMirror replaces range: `editor.chain().focus().deleteRange({from, to}).insertContentAt(from, suggestion).run()`
4. `onUpdate` fires → parent gets new `editedText` → debounced persist
5. Annotation removed from active set → squiggle disappears
6. Next review sees corrected text

### Dismiss

1. Clicks "Dismiss" → fingerprint added to persistent Set
2. Annotation removed immediately
3. Future reviews filter matching fingerprints
4. Persisted per-project in localStorage

### Edge Cases
- Accept with cursor inside range: `editor.chain().focus()` preserves cursor
- Accept during in-flight review: text change aborts in-flight (AbortController), next review re-evaluates
- Multiple suggestions for overlapping ranges: accept one → text changes → others stale → next review re-evaluates

---

## 7. LLM Prompt Design

### Output Schema (structured output, guaranteed valid JSON)

```typescript
const REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...LLMReviewCategory values] },
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          scope: { type: "string", enum: ["dialogue", "narration", "both"] },
          message: { type: "string" },
          suggestion: { type: "string", nullable: true },
          anchor: {
            type: "object",
            properties: {
              prefix: { type: "string" },
              focus: { type: "string" },
              suffix: { type: "string" },
            },
            required: ["prefix", "focus", "suffix"],
          },
        },
        required: ["category", "severity", "scope", "message", "suggestion", "anchor"],
      },
    },
  },
  required: ["annotations"],
};
```

### System Prompt Construction

`buildReviewSystemPrompt(context: ReviewContext)` assembles:
- Style rules (metaphoric register, vocabulary, sentence architecture, structural bans)
- Kill list (as reference only — "do NOT re-flag, handled separately")
- POV rules (distance, interiority, reliability)
- Character voice fingerprints (present characters only)
- Tone intent
- Instructions: severity definitions, anchor format ("8-15 words prefix/suffix"), scope rules

### Model Choice

Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`): fast (~1-2s) + effective for editorial judgment. Uses `callLLM` with `outputSchema` from existing `src/llm/client.ts`.

### Key Prompt Rules
- "Flag only issues a skilled human editor would catch"
- "Do NOT flag: kill list violations, sentence rhythm, paragraph length (handled separately)"
- "Prefer fewer, high-quality annotations over many marginal ones"
- Severity definitions: critical = breaks stated rules, warning = weakens prose, info = minor polish

---

## 8. Testing Strategy

### Test Files

```
tests/review/
  anchorResolver.test.ts      — resolveAnchor pure function (~15 tests)
  reviewEngine.test.ts        — prompt builders, estimateCharRange (~10 tests)
  reviewOrchestrator.test.ts  — orchestrator with mocked LLM (~12 tests)
  fingerprint.test.ts         — hash + suppression logic (~6 tests)
  contextBuilder.test.ts      — buildReviewContext bible pre-filtering (~6 tests)
tests/ui/
  AnnotatedEditor.test.ts     — ChunkCard integration, decorations (~5 tests)
```

### Testing Approach Per Layer

**Anchor Resolver** — Pure functions. Test exact match, duplicate disambiguation, edge cases (start/end of doc, empty anchors), fuzzy fallback, document drift scenarios.

**Review Engine** — String concatenation. Test prompt includes correct bible subset, excludes kill list re-flagging instruction, handles empty sections.

**Orchestrator** — Dependency injection for LLM call (same pattern as `SubtextClient`). Test two-tier merge, abort on re-save, graceful LLM failure, dismissed filtering.

**Fingerprint** — Pure hash function. Test determinism, category separation, truncation stability, localStorage round-trip.

**Context Builder** — Pure function. Test character filtering by `presentCharacterIds`, POV extraction, exemplar exclusion, token cap.

**UI Integration** — `@testing-library/svelte` + jsdom. Test editor renders, squiggles appear, tooltip on hover, readonly mode, text change callback.

### What's NOT Tested
- Actual LLM response quality (eval suite territory)
- ProseMirror internal decoration mapping (trust the library)
- Exact CSS squiggle rendering (visual, not behavioral)

**Total: ~54 tests across 6 files**

---

## 9. File Plan

### Create
- `src/review/types.ts` — EditorialAnnotation, ReviewContext, ReviewResult, LLMReviewCategory
- `src/review/anchorResolver.ts` — resolveAnchor, AnchorMatch
- `src/review/contextBuilder.ts` — buildReviewContext (bible pre-filtering)
- `src/review/prompt.ts` — buildReviewSystemPrompt, buildReviewUserPrompt, REVIEW_OUTPUT_SCHEMA
- `src/review/orchestrator.ts` — createReviewOrchestrator
- `src/review/fingerprint.ts` — hashFingerprint, suppression helpers
- `src/review/localChecks.ts` — wrapper around existing auditor for annotation format
- `src/review/index.ts` — barrel export
- `src/app/components/AnnotatedEditor.svelte` — TipTap + ProseMirror + Svelte 5
- `src/app/components/AnnotationTooltip.svelte` — hover tooltip component
- `tests/review/anchorResolver.test.ts`
- `tests/review/reviewEngine.test.ts`
- `tests/review/reviewOrchestrator.test.ts`
- `tests/review/fingerprint.test.ts`
- `tests/review/contextBuilder.test.ts`
- `tests/ui/AnnotatedEditor.test.ts`

### Modify
- `src/app/components/ChunkCard.svelte` — replace TextArea with AnnotatedEditor, pass readonly/annotations props
- `src/app/components/DraftingDesk.svelte` — pass annotations per chunk from orchestrator
- `src/app/components/stages/DraftStage.svelte` — create orchestrator, manage dismissed set, wire review trigger on save
- `src/types/index.ts` — add EditorialAnnotation to type exports (or re-export from review/)
- `package.json` — add @tiptap/core, @tiptap/pm, @tiptap/extension-document, @tiptap/extension-paragraph, @tiptap/extension-text

### Unchanged (reused)
- `src/auditor/index.ts` — checkKillList, checkSentenceVariance, checkParagraphLength
- `src/llm/client.ts` — callLLM with outputSchema
- `src/app/store/project.svelte.ts` — chunk persistence model
- `src/app/store/commands.ts` — persistChunk debounce

---

## 10. Adversarial Review Summary

This design was reviewed across 3 PAL adversarial sessions (gpt-5, high thinking mode). Key issues found and resolved:

### Section 2 (Types) — 12 issues
- Category taxonomy expanded from 8 to 10 categories
- Severity aligned to existing `critical/warning/info` (not `error`)
- Added `scope`, `spans[]`, `fingerprint` fields
- Added false positive suppression via fingerprint cache
- Bible context capped at ~800 tokens via pre-filtering

### Section 3 (Anchor Resolver) — 7 issues
- Replaced first-match with scored candidate search (all occurrences)
- Replaced `includes` with `endsWith`/`startsWith` adjacency
- Empty anchors guarded (<2 chars treated as absent)
- Dynamic search window instead of fixed 200 chars
- Failed = zero-width caret, never misleading highlight

### Section 5 (Annotated Editor) — 9 issues
- Added `offsetToPos()` for string offset → ProseMirror position mapping
- Split `$effect` into 3: create-once, text-sync, annotation-push
- Added `readonly` prop and `applyingExternal` echo guard
- Fixed tooltip positioning for scrollable panes
- Added `inclusiveStart`/`inclusiveEnd` to decorations
