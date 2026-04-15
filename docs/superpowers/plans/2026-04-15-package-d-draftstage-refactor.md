# Package D: DraftStage Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the timer leaks in `DraftStage.svelte` (`autoReviewTimeout` and `editDebounceTimers` — neither is cleaned up on unmount, so pending `setTimeout` callbacks fire against stale state after the component is destroyed) and split the 650-line god component into a thin orchestrator plus three focused sub-components and two framework-free helper modules — all without touching stores, other panels, primitives, or the API client.

**Architecture:** After the refactor, `src/app/components/stages/DraftStage.svelte` becomes a ~120-line orchestrator that composes `<SceneSequencer/>`, `<DraftStageMain/>`, `<DraftStageSidebar/>`, and `<SceneAuthoringModal/>`. All editorial-review state (orchestrator, annotations, dismissed set, auto-review timer, debounce timers) moves into a single runes-based controller module `draftStageReview.svelte.ts` whose lifecycle is owned by `DraftStageMain.svelte` via an `$effect` with a cleanup function — which is what finally kills both timer leaks. Pure localStorage persistence helpers move to `draftStagePersistence.ts` (no runes, no UI). Expensive NLP derivations (style drift, voice separability) move to `draftStageMetrics.svelte.ts` (a runes `.svelte.ts` module exporting a factory that returns `$derived`-backed reports). The sidebar owns its own `activeTab` state.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), TypeScript strict with `noUncheckedIndexedAccess`, Vitest with `@testing-library/svelte`, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

---

## Scope boundary

This package may only modify or create files under:

- `src/app/components/stages/DraftStage*` (i.e. `DraftStage.svelte` plus new sibling files named `DraftStage<Suffix>.svelte` / `draftStage<Suffix>.ts` / `draftStage<Suffix>.svelte.ts`)
- `tests/ui/DraftStage.test.ts` (new)

It may NOT modify:

- `src/app/store/**` (no new store files — all extracted state stays inside the DraftStage subtree)
- `src/app/components/*.svelte` outside the `stages/DraftStage*` family (e.g. `DraftingDesk.svelte`, `CompilerView.svelte`, `IRInspector.svelte`, `SceneAuthoringModal.svelte`, `SceneSequencer.svelte`, `SetupPayoffPanel.svelte`, `StyleDriftPanel.svelte`, `VoiceSeparabilityView.svelte`)
- `src/app/primitives/**`
- `src/app/components/stages/{AuditStage,BootstrapStage,CompleteStage,EditStage,ExportStage,PlanStage}.svelte`
- `src/api/**`, `src/review/**`, `src/learner/**`, `src/metrics/**`, `src/gates/**`, `src/profile/**`, `src/llm/**`, `src/types/**`

**Logger note:** Package F1 has merged. New log lines in new code must use `createLogger("draft")` from `src/lib/logger.ts`. Existing `console.warn` / `console.log` call sites inside `handleRequestSuggestion` and `handleUpdateChunk` are preserved verbatim — migrating them is Package F2's job.

---

## Current file under refactor

`src/app/components/stages/DraftStage.svelte` — 650 lines, confirmed by `wc -l`. The relevant seams, verified by reading every line:

- **Lines 53–318:** Editorial review subsystem — `LLMReviewClient`, persistence helpers (`loadDismissed`, `saveDismissed`, `loadAnnotations`, `saveAnnotations`), review state (`dismissed`, `chunkAnnotations`, `reviewingChunks`, `orchestrator`, `orchestratorVersion`), two `$effect`s (reload on project change; recreate orchestrator on bible/scene/voice/version change), auto-review `$effect` with `autoReviewTimeout` (lines 189–216), and five review handlers (`handleReviewChunk`, `handleAcceptSuggestion`, `handleDismissAnnotation`, `handleRequestSuggestion`, plus a `SUGGESTION_MAX_TOKENS` constant).
- **Lines 320–329:** Sidebar tab state — `activeTab` and `tabItems`.
- **Lines 331–352:** Gate derivations — `canGenerate`, `gateMessages`.
- **Lines 354–408:** Metric derivations — `cachedStyleDrift`, `styleDriftReports`, `baselineSceneTitle`, `sceneTitles`, `cachedVoiceReport`, `voiceReport`.
- **Lines 410–527:** Chunk handlers — `editDebounceTimers` (Map, line 411), `handleUpdateChunk` (edit debounce + CIPHER batch trigger), `handleRemoveChunk`, `handleDestroyChunk` (cancels `autoReviewTimeout` and walks `editDebounceTimers`), `handleCompleteScene`, `handleVerifyIR`, `handleUpdateIR`.
- **Lines 530–610:** Template — `<SceneSequencer>` header, two-column `draft-columns` layout (`<DraftingDesk>` in `.draft-main`, tab-switched sidebar in `.draft-sidebar`), `<SceneAuthoringModal>` footer.

### The two timer leaks

1. **`autoReviewTimeout`** (line 189, cleared at lines 139, 204, 481). Set on line 205 inside the auto-review `$effect` (lines 192–216). The `$effect` never `return`s a cleanup function, so when `DraftStage` unmounts with a pending 1.5s timeout, the callback fires into a destroyed component and touches `orch.requestReview(...)` against a dead orchestrator reference.
2. **`editDebounceTimers`** (line 411). A `Map<string, setTimeout>` that accumulates one 500 ms timer per chunk per keystroke. `handleUpdateChunk` clears the timer for the same key when a new edit lands, and `handleDestroyChunk` walks indices from `index` to `chunks.length - 1` — but nothing walks the entire map on unmount. A user who unmounts DraftStage mid-typing leaves N live timers that will fire `commands.persistChunk(...)` and `apiStoreSignificantEdit(...)` after the component is gone.

Both bugs have the same root cause: the timers live in module-scoped `let` bindings (line 189 and 411) instead of inside an `$effect` cleanup. The fix is to relocate both timer sets into the review controller's `$effect` lifecycle so the component's teardown naturally cancels them.

---

## Target architecture

### Component tree after refactor

```
DraftStage.svelte                        (orchestrator, ~120 lines)
├── SceneSequencer.svelte                (unchanged, external)
├── DraftStageMain.svelte                (new, ~180 lines)
│   ├── uses: draftStageReview.svelte.ts (new, ~240 lines, framework-free runes module)
│   ├── uses: draftStagePersistence.ts   (new, ~40 lines, pure TS)
│   └── DraftingDesk.svelte              (unchanged, external)
├── DraftStageSidebar.svelte             (new, ~120 lines)
│   ├── uses: draftStageMetrics.svelte.ts (new, ~80 lines, runes factory module)
│   ├── Tabs.svelte                      (unchanged primitive)
│   ├── CompilerView.svelte              (unchanged, external)
│   ├── StyleDriftPanel.svelte           (unchanged, external)
│   ├── VoiceSeparabilityView.svelte     (unchanged, external)
│   ├── SetupPayoffPanel.svelte          (unchanged, external)
│   └── IRInspector.svelte               (unchanged, external)
└── SceneAuthoringModal.svelte           (unchanged, external)
```

### New files

| Path | Kind | Responsibility |
|---|---|---|
| `src/app/components/stages/DraftStageMain.svelte` | Svelte | Main column. Instantiates the review controller, wires `DraftingDesk` props and event handlers for chunk updates / review / CIPHER. Owns no review state directly — delegates to the controller. |
| `src/app/components/stages/DraftStageSidebar.svelte` | Svelte | Sidebar column. Owns `activeTab` `$state`, `tabItems` constant, metrics derivations (via `draftStageMetrics.svelte.ts`), and the tab switch. |
| `src/app/components/stages/draftStageReview.svelte.ts` | Runes module | Exports `createDraftStageReviewController(...)`. Owns `dismissed`, `chunkAnnotations`, `reviewingChunks`, `orchestrator`, `orchestratorVersion`, `prevChunkCount`, `autoReviewTimeout`, `editDebounceTimers`. Exposes handlers and a `dispose()` method that clears every timer. Registered from `DraftStageMain` inside an `$effect` whose cleanup calls `dispose()` — this is how both timer leaks die. |
| `src/app/components/stages/draftStagePersistence.ts` | Plain TS | Pure `localStorage` helpers: `loadDismissed`, `saveDismissed`, `loadAnnotations`, `saveAnnotations`. Takes `projectId` / `sceneId` as arguments (no store access). |
| `src/app/components/stages/draftStageMetrics.svelte.ts` | Runes module | Exports `createDraftStageMetrics(store)` returning `{ get styleDriftReports(); get voiceReport(); get baselineSceneTitle(); get sceneTitles(); }` as `$derived`-backed getters, with the same `cachedStyleDrift` / `cachedVoiceReport` freeze-during-streaming behavior. |
| `tests/ui/DraftStage.test.ts` | Vitest | Timer leak regression tests (fake timers, mount/unmount assertion) + behavioral smoke tests for the orchestrator. |

**No files under `src/app/store/**` are created.** The runes modules live beside `DraftStage.svelte` in `src/app/components/stages/` because they are single-owner helpers for a single component tree. The scope-boundary exception for store extraction is not needed.

### Prop/event contracts

**`DraftStage.svelte` (orchestrator, unchanged external signature):**

```ts
let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
} = $props();
```

**`DraftStageMain.svelte`:**

```ts
let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
  onOpenIRTab,
  canGenerate,
  gateMessages,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
  onOpenIRTab: () => void;
  canGenerate: boolean;
  gateMessages: string[];
} = $props();
```

Emits nothing via `createEventDispatcher`; uses callback props only (`onOpenIRTab` is how it asks the orchestrator to switch the sidebar to the IR tab when the user clicks "Open IR inspector" from `DraftingDesk`).

**`DraftStageSidebar.svelte`:**

```ts
let {
  store,
  commands,
  activeTab = $bindable(),
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  activeTab: "compiler" | "drift" | "voice" | "setups" | "ir";
  onExtractIR: (sceneId?: string) => void;
} = $props();
```

`activeTab` is `$bindable()` so the orchestrator can flip it to `"ir"` when `DraftStageMain` calls `onOpenIRTab`.

**`draftStageReview.svelte.ts`:**

```ts
export interface DraftStageReviewController {
  // Reactive state (getters backed by $state)
  readonly chunkAnnotations: Map<number, EditorialAnnotation[]>;
  readonly reviewingChunks: Set<number>;

  // Handlers bound to the controller
  handleReviewChunk(index: number): void;
  handleAcceptSuggestion(annotationId: string): void;
  handleDismissAnnotation(annotationId: string): void;
  handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null>;
  handleUpdateChunk(index: number, changes: Partial<Chunk>): void;
  handleRemoveChunk(index: number): Promise<void>;
  handleDestroyChunk(index: number): Promise<void>;

  // Lifecycle
  dispose(): void;
}

export function createDraftStageReviewController(
  store: ProjectStore,
  commands: Commands,
): DraftStageReviewController;
```

`createDraftStageReviewController` internally uses `$state`, `$effect.root`, and `untrack` from Svelte to replicate the two existing review `$effect`s (reload-on-project-change, recreate-orchestrator) and the auto-review `$effect`. `$effect.root` returns a disposer that the controller stores; `dispose()` calls that disposer, `orchestrator?.cancelAll()`, `clearTimeout(autoReviewTimeout)`, and walks `editDebounceTimers` clearing every entry.

**`draftStagePersistence.ts`:**

```ts
export function loadDismissed(projectId: string | undefined): Set<string>;
export function saveDismissed(projectId: string | undefined, dismissed: Set<string>): void;
export function loadAnnotations(
  projectId: string | undefined,
  sceneId: string,
): Map<number, EditorialAnnotation[]>;
export function saveAnnotations(
  projectId: string | undefined,
  sceneId: string,
  anns: Map<number, EditorialAnnotation[]>,
): void;
```

**`draftStageMetrics.svelte.ts`:**

```ts
export interface DraftStageMetrics {
  readonly styleDriftReports: StyleDriftReport[];
  readonly voiceReport: VoiceSeparabilityReport | null;
  readonly baselineSceneTitle: string;
  readonly sceneTitles: Record<string, string>;
}

export function createDraftStageMetrics(store: ProjectStore): DraftStageMetrics;
```

### State ownership map

| State | Current owner | New owner |
|---|---|---|
| `dismissed` (`Set<string>`) | `DraftStage.svelte` L112 | `draftStageReview.svelte.ts` (`$state`) |
| `chunkAnnotations` | `DraftStage.svelte` L113 | `draftStageReview.svelte.ts` (`$state`) |
| `reviewingChunks` | `DraftStage.svelte` L114 | `draftStageReview.svelte.ts` (`$state`) |
| `orchestrator` | `DraftStage.svelte` L115 | `draftStageReview.svelte.ts` (`$state`) |
| `orchestratorVersion` | `DraftStage.svelte` L118 | `draftStageReview.svelte.ts` (`$state`) |
| `prevChunkCount` | `DraftStage.svelte` L190 | `draftStageReview.svelte.ts` (plain `let` inside closure) |
| `autoReviewTimeout` | `DraftStage.svelte` L189 | `draftStageReview.svelte.ts` (plain `let` inside closure, cleared by `dispose()`) |
| `editDebounceTimers` | `DraftStage.svelte` L411 | `draftStageReview.svelte.ts` (plain `Map` inside closure, walked by `dispose()`) |
| `activeTab` | `DraftStage.svelte` L321 | `DraftStageSidebar.svelte` (`$state`, `$bindable`) |
| `cachedStyleDrift` | `DraftStage.svelte` L355 | `draftStageMetrics.svelte.ts` (closure `let`) |
| `cachedVoiceReport` | `DraftStage.svelte` L389 | `draftStageMetrics.svelte.ts` (closure `let`) |
| `canGenerate` | `DraftStage.svelte` L332 (`$derived`) | `DraftStage.svelte` orchestrator (still `$derived`; passed into `DraftStageMain`) |
| `gateMessages` | `DraftStage.svelte` L334 (`$derived.by`) | `DraftStage.svelte` orchestrator (still `$derived.by`; passed into `DraftStageMain`) |

No state is duplicated. No prop-drilling beyond one level: `DraftStage` → `DraftStageMain`/`DraftStageSidebar`. The review controller is constructed once in `DraftStageMain` and passed nowhere else (handlers are invoked locally inside `DraftStageMain`'s template bindings to `<DraftingDesk>`).

### The timer fix in detail

Inside `draftStageReview.svelte.ts`, the auto-review effect is wrapped in `$effect.root` so its cleanup is explicit:

```ts
const rootDispose = $effect.root(() => {
  // ...existing orchestrator-recreate $effect...

  // Auto-review effect
  $effect(() => {
    const count = store.activeSceneChunks.length;
    const sceneId = store.activeScenePlan?.id;
    const generating = store.isGenerating;
    if (!sceneId || count === 0 || count <= prevChunkCount || generating) {
      if (!generating) prevChunkCount = count;
      return;
    }
    prevChunkCount = count;
    const orch = untrack(() => orchestrator);
    if (!orch) return;
    const chunks = untrack(() => store.activeSceneChunks);
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = setTimeout(() => {
      const views: ChunkView[] = chunks
        .map((c, i) => ({ chunk: c, index: i }))
        .filter(({ chunk }) => chunk.status !== "accepted")
        .map(({ chunk, index }) => ({
          index,
          text: getCanonicalText(chunk),
          sceneId,
        }));
      if (views.length > 0) orch.requestReview(views);
    }, 1500);

    return () => {
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = undefined;
    };
  });
});

function dispose(): void {
  orchestrator?.cancelAll();
  clearTimeout(autoReviewTimeout);
  autoReviewTimeout = undefined;
  for (const timer of editDebounceTimers.values()) clearTimeout(timer);
  editDebounceTimers.clear();
  rootDispose();
}
```

In `DraftStageMain.svelte`:

```ts
const review = createDraftStageReviewController(store, commands);
$effect(() => {
  return () => review.dispose();
});
```

That `$effect`'s return function runs on component unmount, calling `dispose()`, which cancels the auto-review timeout, walks every entry of `editDebounceTimers`, and tears down the `$effect.root`. **Both leaks die.**

---

## Task 1: Write failing tests first

**Files:**
- Create: `tests/ui/DraftStage.test.ts`

- [ ] **Step 1: Create the test file with timer-leak regression + behavioral smoke tests**

```ts
import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DraftStage from "../../src/app/components/stages/DraftStage.svelte";
import { makeChunk, makeSceneEntry } from "../../src/app/stories/factories.js";

// DraftingDesk pulls in ProseMirror; stub the tiptap modules it imports
// transitively, matching the pattern used by tests/ui/EditStage.test.ts.
vi.mock("@tiptap/core", () => ({
  Editor: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    getText: vi.fn().mockReturnValue(""),
    state: { doc: { descendants: vi.fn() }, selection: { from: 0, to: 0 } },
    commands: { setContent: vi.fn() },
    setEditable: vi.fn(),
    view: { coordsAtPos: vi.fn().mockReturnValue({ top: 0, bottom: 0, left: 0 }) },
    registerPlugin: vi.fn(),
    on: vi.fn(),
  })),
}));
vi.mock("@tiptap/extension-document", () => ({ default: {} }));
vi.mock("@tiptap/extension-paragraph", () => ({ default: {} }));
vi.mock("@tiptap/extension-text", () => ({ default: {} }));

// Stub the review orchestrator factory so tests don't hit the LLM
vi.mock("../../src/review/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../src/review/index.js");
  return {
    ...actual,
    createReviewOrchestrator: vi.fn(() => ({
      requestReview: vi.fn(),
      cancelAll: vi.fn(),
    })),
  };
});

function createMockStore(overrides: Record<string, unknown> = {}) {
  const scene = makeSceneEntry("scene-1", "The Confrontation", "drafting");
  const chunk = makeChunk({ sceneId: "scene-1" });
  return {
    project: { id: "project-1" },
    bible: { characters: [], voiceRules: [], killList: [] },
    scenes: [scene],
    activeSceneIndex: 0,
    activeScene: scene,
    activeScenePlan: scene.plan,
    activeSceneChunks: [chunk] as typeof chunk[],
    sceneChunks: { "scene-1": [chunk] },
    sceneIRs: {},
    activeSceneIR: null,
    isExtractingIR: false,
    isGenerating: false,
    isAutopilot: false,
    isAuditing: false,
    auditFlags: [],
    compiledPayload: null,
    compilationLog: null,
    lintResult: null,
    metrics: null,
    voiceGuide: null,
    setActiveScene: vi.fn(),
    setSceneAuthoringOpen: vi.fn(),
    setVoiceGuide: vi.fn(),
    cancelGeneration: vi.fn(),
    cancelAutopilot: vi.fn(),
    updateChunkForScene: vi.fn(),
    ...overrides,
  };
}

function createMockCommands() {
  return {
    saveBible: vi.fn().mockResolvedValue({ ok: true }),
    saveScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    updateScenePlan: vi.fn().mockResolvedValue({ ok: true }),
    saveMultipleScenePlans: vi.fn().mockResolvedValue({ ok: true }),
    saveChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    updateChapterArc: vi.fn().mockResolvedValue({ ok: true }),
    saveChunk: vi.fn().mockResolvedValue({ ok: true }),
    updateChunk: vi.fn().mockResolvedValue({ ok: true }),
    persistChunk: vi.fn().mockResolvedValue({ ok: true }),
    removeChunk: vi.fn().mockResolvedValue({ ok: true }),
    completeScene: vi.fn().mockResolvedValue({ ok: true }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true }),
    resolveAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    dismissAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    saveSceneIR: vi.fn().mockResolvedValue({ ok: true }),
    verifySceneIR: vi.fn().mockResolvedValue({ ok: true }),
    saveCompilationLog: vi.fn().mockResolvedValue({ ok: true }),
    applyRefinement: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function defaultProps() {
  return {
    store: createMockStore() as never,
    commands: createMockCommands() as never,
    onGenerate: vi.fn(),
    onRunAudit: vi.fn(),
    onRunDeepAudit: vi.fn(),
    onAutopilot: vi.fn(),
    onExtractIR: vi.fn(),
  };
}

describe("DraftStage — timer cleanup on unmount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears the auto-review setTimeout when unmounted before it fires", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(DraftStage, defaultProps());
    // Ensure any queued effects have had a chance to schedule timers
    vi.advanceTimersByTime(0);
    unmount();
    // After unmount, no pending timers must remain
    expect(vi.getTimerCount()).toBe(0);
    // And clearTimeout must have been called at least once during teardown
    expect(clearSpy).toHaveBeenCalled();
  });

  it("does not fire the auto-review callback after unmount", () => {
    const { unmount } = render(DraftStage, defaultProps());
    vi.advanceTimersByTime(0);
    unmount();
    // Advance well past the 1500ms auto-review delay
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("flushes edit-debounce timers on unmount", () => {
    const props = defaultProps();
    const { unmount } = render(DraftStage, props);
    // Simulate a pending edit debounce: the controller's handleUpdateChunk
    // would schedule a 500ms setTimeout. We verify unmount clears the queue
    // regardless of how many are pending.
    vi.advanceTimersByTime(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("DraftStage — behavioral smoke tests", () => {
  it("renders the SceneSequencer with the active scene title", () => {
    render(DraftStage, defaultProps());
    expect(screen.getByRole("button", { name: /The Confrontation/ })).toBeInTheDocument();
  });

  it("renders the Draft Engine sidebar tab by default", () => {
    render(DraftStage, defaultProps());
    expect(screen.getByText("Draft Engine")).toBeInTheDocument();
  });

  it("renders all five sidebar tabs", () => {
    render(DraftStage, defaultProps());
    expect(screen.getByText("Draft Engine")).toBeInTheDocument();
    expect(screen.getByText("Voice Consistency")).toBeInTheDocument();
    expect(screen.getByText("Character Voices")).toBeInTheDocument();
    expect(screen.getByText("Setups")).toBeInTheDocument();
    expect(screen.getByText("IR")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail for the right reason**

Run: `pnpm test -- tests/ui/DraftStage.test.ts`

Expected: the three **timer cleanup** tests fail because the current `DraftStage.svelte` leaks `autoReviewTimeout` and never walks `editDebounceTimers` on unmount. The three **smoke tests** should already pass against the current implementation — they exist to pin behavior so later extractions can't silently change it.

If any smoke test fails against the *current* `DraftStage.svelte`, stop and adjust the test to match current behavior before moving on. The smoke tests are a fence, not a forcing function.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/ui/DraftStage.test.ts
git commit -m "$(cat <<'EOF'
test(draft-stage): add timer-leak regression and smoke tests

Adds tests/ui/DraftStage.test.ts covering (a) the two timer leaks
called out in #34 — autoReviewTimeout and editDebounceTimers must
be cleared on unmount — and (b) behavioral smoke tests pinning the
SceneSequencer + sidebar tab structure so the upcoming
decomposition can't silently regress them. Timer-leak tests fail
against current DraftStage; smoke tests pass.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix the timer leak (minimal change, lands before the split)

**Files:**
- Modify: `src/app/components/stages/DraftStage.svelte`

This task lands the narrowest possible fix: convert both timer bindings into cleanups owned by Svelte effects, without moving any code into new files. This gives the refactor a safety net — if Task 3 takes multiple commits, the leak is already fixed in between.

- [ ] **Step 1: Convert the auto-review effect cleanup**

In `src/app/components/stages/DraftStage.svelte`, replace the auto-review `$effect` (currently lines 192–216) so it returns a cleanup function:

```ts
$effect(() => {
  const count = store.activeSceneChunks.length;
  const sceneId = store.activeScenePlan?.id;
  const generating = store.isGenerating;
  if (!sceneId || count === 0 || count <= prevChunkCount || generating) {
    if (!generating) prevChunkCount = count;
    return;
  }
  prevChunkCount = count;
  const orch = untrack(() => orchestrator);
  if (!orch) return;
  const chunks = untrack(() => store.activeSceneChunks);
  clearTimeout(autoReviewTimeout);
  autoReviewTimeout = setTimeout(() => {
    const views: ChunkView[] = chunks
      .map((c, i) => ({ chunk: c, index: i }))
      .filter(({ chunk }) => chunk.status !== "accepted")
      .map(({ chunk, index }) => ({
        index,
        text: getCanonicalText(chunk),
        sceneId,
      }));
    if (views.length > 0) orch.requestReview(views);
  }, 1500);

  return () => {
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = undefined;
  };
});
```

The existing comment above `let autoReviewTimeout` (lines 183–188) explains why the timer wasn't in cleanup originally: it was a workaround for the re-run-early-return race where a stale effect would cancel a valid pending review. That race is now solved by the `count <= prevChunkCount` early-return happening **before** `clearTimeout`, so the `return` cleanup only runs when this effect instance actually scheduled a timeout. Update the comment to explain the new invariant, do not delete it.

- [ ] **Step 2: Add an unmount cleanup effect for `editDebounceTimers`**

Directly after the declaration `let editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();` (line 411), add:

```ts
$effect(() => {
  return () => {
    for (const timer of editDebounceTimers.values()) clearTimeout(timer);
    editDebounceTimers.clear();
  };
});
```

This is a no-dependency effect — its body runs once on mount, its cleanup runs once on unmount, and the cleanup walks every still-pending debounce timer.

- [ ] **Step 3: Run the timer-leak tests**

Run: `pnpm test -- tests/ui/DraftStage.test.ts`

Expected: all six tests (three timer + three smoke) pass.

- [ ] **Step 4: Run the full check suite**

Run: `pnpm check-all`

Expected: lint, typecheck, and the full vitest suite all green.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/stages/DraftStage.svelte
git commit -m "$(cat <<'EOF'
fix(draft-stage): clear auto-review and edit-debounce timers on unmount

Fixes the timer leak called out in #34. The auto-review $effect
now returns a cleanup that cancels the pending 1.5s setTimeout,
and a new no-dep $effect walks editDebounceTimers on teardown so
mid-typing unmounts don't fire persistChunk into a dead component.

Minimal surgical fix — no component split yet. Regression tests in
tests/ui/DraftStage.test.ts now pass.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract `draftStagePersistence.ts` (pure helpers)

**Files:**
- Create: `src/app/components/stages/draftStagePersistence.ts`
- Modify: `src/app/components/stages/DraftStage.svelte`

Start with the easiest extraction: the four `localStorage` helpers are already pure functions that take no runes. Moving them first shrinks `DraftStage.svelte` by ~40 lines and proves the test harness still passes.

- [ ] **Step 1: Create `draftStagePersistence.ts`**

```ts
import type { EditorialAnnotation } from "../../../review/index.js";

function dismissedKey(projectId: string | undefined): string {
  return `review-dismissed:${projectId ?? "default"}`;
}

function annotationsKey(projectId: string | undefined, sceneId: string): string {
  return `review-annotations:${projectId ?? "default"}:${sceneId}`;
}

export function loadDismissed(projectId: string | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(projectId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDismissed(projectId: string | undefined, dismissed: Set<string>): void {
  try {
    localStorage.setItem(dismissedKey(projectId), JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage failures; dismissed state just won't persist.
  }
}

export function loadAnnotations(
  projectId: string | undefined,
  sceneId: string,
): Map<number, EditorialAnnotation[]> {
  try {
    const raw = localStorage.getItem(annotationsKey(projectId, sceneId));
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [number, EditorialAnnotation[]][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function saveAnnotations(
  projectId: string | undefined,
  sceneId: string,
  anns: Map<number, EditorialAnnotation[]>,
): void {
  try {
    localStorage.setItem(annotationsKey(projectId, sceneId), JSON.stringify([...anns]));
  } catch {
    // Ignore storage failures; annotations just won't persist.
  }
}
```

- [ ] **Step 2: Replace the four inline helpers in `DraftStage.svelte`**

Remove `loadDismissed`, `saveDismissed`, `loadAnnotations`, `saveAnnotations` (currently lines 71–109) and replace every call site with the imported versions, threading `store.project?.id` as the `projectId` argument:

```ts
import {
  loadAnnotations,
  loadDismissed,
  saveAnnotations,
  saveDismissed,
} from "./draftStagePersistence.js";
```

Call sites to update:
- `let dismissed = $state(loadDismissed());` → `let dismissed = $state(loadDismissed(store.project?.id));`
- `dismissed = loadDismissed();` in the project-change effect → `dismissed = loadDismissed(store.project?.id);`
- `loadAnnotations(scenePlan.id)` → `loadAnnotations(store.project?.id, scenePlan.id)`
- Every `saveDismissed(dismissed)` → `saveDismissed(store.project?.id, dismissed)`
- Every `saveAnnotations(sceneId, chunkAnnotations)` → `saveAnnotations(store.project?.id, sceneId, chunkAnnotations)`
- The `saveAnnotations(sceneId, new Map())` call inside `handleDestroyChunk` → `saveAnnotations(store.project?.id, sceneId, new Map())`

- [ ] **Step 3: Run tests + full check**

```bash
pnpm test -- tests/ui/DraftStage.test.ts
pnpm check-all
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/stages/draftStagePersistence.ts src/app/components/stages/DraftStage.svelte
git commit -m "$(cat <<'EOF'
refactor(draft-stage): extract localStorage helpers to draftStagePersistence

Moves loadDismissed/saveDismissed/loadAnnotations/saveAnnotations
out of DraftStage.svelte into a sibling pure-TS module. Call sites
now pass store.project?.id explicitly, decoupling the helpers from
the store. No behavior change.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extract `draftStageMetrics.svelte.ts`

**Files:**
- Create: `src/app/components/stages/draftStageMetrics.svelte.ts`
- Modify: `src/app/components/stages/DraftStage.svelte`

- [ ] **Step 1: Create `draftStageMetrics.svelte.ts`**

```ts
import { computeStyleDriftFromProse } from "../../../metrics/styleDrift.js";
import { measureVoiceSeparability } from "../../../metrics/voiceSeparability.js";
import type { StyleDriftReport, VoiceSeparabilityReport } from "../../../types/index.js";
import { getCanonicalText } from "../../../types/index.js";
import type { ProjectStore } from "../../store/project.svelte.js";

export interface DraftStageMetrics {
  readonly styleDriftReports: StyleDriftReport[];
  readonly voiceReport: VoiceSeparabilityReport | null;
  readonly baselineSceneTitle: string;
  readonly sceneTitles: Record<string, string>;
}

export function createDraftStageMetrics(store: ProjectStore): DraftStageMetrics {
  // Caches preserve the last non-streaming report so we don't churn NLP
  // computations on every streamed token.
  let cachedStyleDrift: StyleDriftReport[] = [];
  let cachedVoiceReport: VoiceSeparabilityReport | null = null;

  const styleDriftReports = $derived.by((): StyleDriftReport[] => {
    if (store.isGenerating) return cachedStyleDrift;
    if (!store.bible) {
      cachedStyleDrift = [];
      return [];
    }
    const completedScenes = store.scenes.filter((s) => s.status === "complete");
    if (completedScenes.length < 2) {
      cachedStyleDrift = [];
      return [];
    }
    const reports: StyleDriftReport[] = [];
    const baselineId = completedScenes[0]!.plan.id;
    const baselineChunks = store.sceneChunks[baselineId] ?? [];
    if (baselineChunks.length === 0) {
      cachedStyleDrift = [];
      return [];
    }
    const baselineProse = baselineChunks.map((c) => getCanonicalText(c)).join("\n\n");
    for (let i = 1; i < completedScenes.length; i++) {
      const scene = completedScenes[i]!;
      const chunks = store.sceneChunks[scene.plan.id] ?? [];
      if (chunks.length === 0) continue;
      const prose = chunks.map((c) => getCanonicalText(c)).join("\n\n");
      reports.push(computeStyleDriftFromProse(baselineId, baselineProse, scene.plan.id, prose));
    }
    cachedStyleDrift = reports;
    return reports;
  });

  const baselineSceneTitle = $derived(
    store.scenes.find((s) => s.status === "complete")?.plan.title ?? "Scene 1",
  );

  const sceneTitles = $derived(
    Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.plan.title])),
  );

  const voiceReport = $derived.by((): VoiceSeparabilityReport | null => {
    if (store.isGenerating) return cachedVoiceReport;
    if (!store.bible || store.bible.characters.length < 2) {
      cachedVoiceReport = null;
      return null;
    }
    const sceneTexts = store.scenes
      .map((s) => ({
        sceneId: s.plan.id,
        prose: (store.sceneChunks[s.plan.id] ?? []).map((c) => getCanonicalText(c)).join("\n\n"),
      }))
      .filter((s) => s.prose.length > 0);
    if (sceneTexts.length === 0) {
      cachedVoiceReport = null;
      return null;
    }
    cachedVoiceReport = measureVoiceSeparability(sceneTexts, store.bible);
    return cachedVoiceReport;
  });

  return {
    get styleDriftReports() {
      return styleDriftReports;
    },
    get voiceReport() {
      return voiceReport;
    },
    get baselineSceneTitle() {
      return baselineSceneTitle;
    },
    get sceneTitles() {
      return sceneTitles;
    },
  };
}
```

The `.svelte.ts` extension tells Svelte's compiler to process `$derived` / `$derived.by` inside a plain TS module. This is the documented runes-in-modules pattern.

- [ ] **Step 2: Delete the metric derivations from `DraftStage.svelte`**

Remove the imports of `computeStyleDriftFromProse`, `measureVoiceSeparability`, and the block spanning `cachedStyleDrift` through `voiceReport` (lines 354–408). Replace with:

```ts
import { createDraftStageMetrics } from "./draftStageMetrics.svelte.js";

const metrics = createDraftStageMetrics(store);
```

Update the template to read `metrics.styleDriftReports`, `metrics.voiceReport`, `metrics.baselineSceneTitle`, `metrics.sceneTitles` everywhere the old locals were referenced.

- [ ] **Step 3: Run tests + full check**

```bash
pnpm test -- tests/ui/DraftStage.test.ts
pnpm check-all
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/stages/draftStageMetrics.svelte.ts src/app/components/stages/DraftStage.svelte
git commit -m "$(cat <<'EOF'
refactor(draft-stage): extract metrics derivations to runes module

Moves styleDriftReports / voiceReport / baselineSceneTitle /
sceneTitles plus their freeze-during-streaming caches out of
DraftStage.svelte into draftStageMetrics.svelte.ts, exposed as a
createDraftStageMetrics(store) factory returning $derived-backed
getters. No behavior change.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Extract `draftStageReview.svelte.ts`

**Files:**
- Create: `src/app/components/stages/draftStageReview.svelte.ts`
- Modify: `src/app/components/stages/DraftStage.svelte`

This is the largest extraction. Move every piece of review state, the two review `$effect`s, the auto-review `$effect`, and all seven handlers (`handleReviewChunk`, `handleAcceptSuggestion`, `handleDismissAnnotation`, `handleRequestSuggestion`, `handleUpdateChunk`, `handleRemoveChunk`, `handleDestroyChunk`) into the runes module. Wrap the three effects in a single `$effect.root(...)` so they get a unified disposer, and expose a `dispose()` method.

- [ ] **Step 1: Create `draftStageReview.svelte.ts`**

The module is ~240 lines. Structure:

```ts
import { untrack } from "svelte";
import { apiFireBatchCipher, apiStoreSignificantEdit } from "../../../api/client.js";
import { createLogger } from "../../../lib/logger.js";
import { callLLM } from "../../../llm/client.js";
import { shouldTriggerCipher } from "../../../profile/editFilter.js";
import { buildReviewContext } from "../../../review/contextBuilder.js";
import type { ChunkView, EditorialAnnotation, LLMReviewClient, ReviewOrchestrator } from "../../../review/index.js";
import {
  buildSuggestionRequestPrompt,
  createReviewOrchestrator,
  REVIEW_OUTPUT_SCHEMA,
  SUGGESTION_REQUEST_SCHEMA,
  trimSuggestionOverlap,
} from "../../../review/index.js";
import type { Chunk } from "../../../types/index.js";
import { DEFAULT_MODEL, getCanonicalText } from "../../../types/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import { loadAnnotations, loadDismissed, saveAnnotations, saveDismissed } from "./draftStagePersistence.js";

const log = createLogger("draft");

const REVIEW_MODEL = DEFAULT_MODEL;
const REVIEW_MAX_TOKENS = 2048;
const SUGGESTION_MAX_TOKENS = 1024;

export interface DraftStageReviewController {
  readonly chunkAnnotations: Map<number, EditorialAnnotation[]>;
  readonly reviewingChunks: Set<number>;
  handleReviewChunk(index: number): void;
  handleAcceptSuggestion(annotationId: string): void;
  handleDismissAnnotation(annotationId: string): void;
  handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null>;
  handleUpdateChunk(index: number, changes: Partial<Chunk>): void;
  handleRemoveChunk(index: number): Promise<void>;
  handleDestroyChunk(index: number): Promise<void>;
  dispose(): void;
}

export function createDraftStageReviewController(
  store: ProjectStore,
  commands: Commands,
): DraftStageReviewController {
  let dismissed = $state<Set<string>>(loadDismissed(store.project?.id));
  let chunkAnnotations = $state(new Map<number, EditorialAnnotation[]>());
  let reviewingChunks = $state(new Set<number>());
  let orchestrator = $state<ReviewOrchestrator | null>(null);
  let orchestratorVersion = $state(0);

  // Non-reactive closure state — lifecycle is owned by dispose()
  let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
  let prevChunkCount = 0;
  const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const llmReviewClient: LLMReviewClient = {
    review(systemPrompt, userPrompt, signal) {
      return callLLM(
        systemPrompt,
        userPrompt,
        REVIEW_MODEL,
        REVIEW_MAX_TOKENS,
        REVIEW_OUTPUT_SCHEMA as Record<string, unknown>,
        signal,
      );
    },
  };

  const rootDispose = $effect.root(() => {
    // Reload dismissed set when project changes
    $effect(() => {
      const _projectId = store.project?.id;
      dismissed = loadDismissed(store.project?.id);
    });

    // Recreate orchestrator when bible, scene, voice guide, or version changes
    $effect(() => {
      const bible = store.bible;
      const scenePlan = store.activeScenePlan;
      const _version = orchestratorVersion;
      const _voiceGuide = store.voiceGuide;

      untrack(() => {
        orchestrator?.cancelAll();
        reviewingChunks = new Set();
        prevChunkCount = 0;
        clearTimeout(autoReviewTimeout);
        autoReviewTimeout = undefined;
      });

      if (!bible || !scenePlan) {
        orchestrator = null;
        chunkAnnotations = new Map();
        return;
      }

      const loaded = loadAnnotations(store.project?.id, scenePlan.id);
      for (const [idx, anns] of loaded) {
        const filtered = anns.filter((a) => !dismissed.has(a.fingerprint));
        if (filtered.length > 0) loaded.set(idx, filtered);
        else loaded.delete(idx);
      }
      chunkAnnotations = loaded;

      orchestrator = createReviewOrchestrator(
        bible,
        scenePlan,
        () => dismissed,
        llmReviewClient,
        (chunkIndex, anns, reviewedText) => {
          const currentChunk = store.activeSceneChunks[chunkIndex];
          if (currentChunk && getCanonicalText(currentChunk) !== reviewedText) return;
          chunkAnnotations = new Map(chunkAnnotations).set(chunkIndex, anns);
          if (scenePlan) saveAnnotations(store.project?.id, scenePlan.id, chunkAnnotations);
        },
        (reviewing) => {
          reviewingChunks = reviewing;
        },
        store.voiceGuide?.editingInstructions || undefined,
      );
    });

    // Auto-review
    $effect(() => {
      const count = store.activeSceneChunks.length;
      const sceneId = store.activeScenePlan?.id;
      const generating = store.isGenerating;
      if (!sceneId || count === 0 || count <= prevChunkCount || generating) {
        if (!generating) prevChunkCount = count;
        return;
      }
      prevChunkCount = count;
      const orch = untrack(() => orchestrator);
      if (!orch) return;
      const chunks = untrack(() => store.activeSceneChunks);
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = setTimeout(() => {
        const views: ChunkView[] = chunks
          .map((c, i) => ({ chunk: c, index: i }))
          .filter(({ chunk }) => chunk.status !== "accepted")
          .map(({ chunk, index }) => ({
            index,
            text: getCanonicalText(chunk),
            sceneId,
          }));
        if (views.length > 0) orch.requestReview(views);
      }, 1500);

      return () => {
        clearTimeout(autoReviewTimeout);
        autoReviewTimeout = undefined;
      };
    });
  });

  function handleReviewChunk(index: number): void {
    // ...unchanged from DraftStage.svelte lines 218-226
  }
  function handleAcceptSuggestion(_annotationId: string): void {
    // no-op; kept for API symmetry
  }
  function handleDismissAnnotation(annotationId: string): void {
    // ...unchanged from lines 233-251, with saveDismissed / saveAnnotations calls
    // now taking store.project?.id as the first argument
  }
  async function handleRequestSuggestion(
    annotationId: string,
    feedback: string,
  ): Promise<string | null> {
    // ...unchanged from lines 255-318, with saveAnnotations taking project id,
    // and the final console.warn preserved verbatim (F2 will migrate it).
  }
  function handleUpdateChunk(index: number, changes: Partial<Chunk>): void {
    // ...unchanged from lines 413-453. console.log / console.warn calls for
    // the CIPHER path are preserved verbatim — F2's job, not D's.
  }
  async function handleRemoveChunk(index: number): Promise<void> {
    // ...unchanged
  }
  async function handleDestroyChunk(index: number): Promise<void> {
    // ...unchanged from lines 461-510, with saveAnnotations taking project id.
  }

  function dispose(): void {
    orchestrator?.cancelAll();
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = undefined;
    for (const timer of editDebounceTimers.values()) clearTimeout(timer);
    editDebounceTimers.clear();
    rootDispose();
  }

  return {
    get chunkAnnotations() {
      return chunkAnnotations;
    },
    get reviewingChunks() {
      return reviewingChunks;
    },
    handleReviewChunk,
    handleAcceptSuggestion,
    handleDismissAnnotation,
    handleRequestSuggestion,
    handleUpdateChunk,
    handleRemoveChunk,
    handleDestroyChunk,
    dispose,
  };
}
```

**Important:** copy the handler bodies **verbatim** from the current `DraftStage.svelte`. The only edits are (a) `saveAnnotations(sceneId, ...)` → `saveAnnotations(store.project?.id, sceneId, ...)` and the matching `saveDismissed` / `loadAnnotations` / `loadDismissed` calls, and (b) preserve every existing `console.*` call site unchanged. Do NOT introduce `log.info`/`log.warn` in this extraction — F2 migrates them later. The `createLogger("draft")` import is included so any genuinely-new log lines (there should be none) would have a logger ready.

- [ ] **Step 2: Slim `DraftStage.svelte` to delegate to the controller**

(This is still inside DraftStage — we'll further split into Main/Sidebar in Task 6.)

Replace every piece of review state and every handler with calls into the controller:

```ts
import { createDraftStageReviewController } from "./draftStageReview.svelte.js";

const review = createDraftStageReviewController(store, commands);

$effect(() => {
  return () => review.dispose();
});
```

Template bindings change:

- `chunkAnnotations={chunkAnnotations}` → `chunkAnnotations={review.chunkAnnotations}`
- `reviewingChunks={reviewingChunks}` → `reviewingChunks={review.reviewingChunks}`
- `onUpdateChunk={handleUpdateChunk}` → `onUpdateChunk={review.handleUpdateChunk}`
- `onRemoveChunk={handleRemoveChunk}` → `onRemoveChunk={review.handleRemoveChunk}`
- `onDestroyChunk={handleDestroyChunk}` → `onDestroyChunk={review.handleDestroyChunk}`
- `onReviewChunk={handleReviewChunk}` → `onReviewChunk={review.handleReviewChunk}`
- `onAcceptSuggestion={handleAcceptSuggestion}` → `onAcceptSuggestion={review.handleAcceptSuggestion}`
- `onDismissAnnotation={handleDismissAnnotation}` → `onDismissAnnotation={review.handleDismissAnnotation}`
- `onRequestSuggestion={handleRequestSuggestion}` → `onRequestSuggestion={review.handleRequestSuggestion}`

Delete all the imports that are now only used by the controller module (`apiFireBatchCipher`, `apiStoreSignificantEdit`, `analyzeEdits`, `applyProposal`, `BibleProposal`, `generateTuningProposals`, `TuningProposal`, `callLLM`, `shouldTriggerCipher`, `buildReviewContext`, `ChunkView`, `EditorialAnnotation`, `LLMReviewClient`, `ReviewOrchestrator`, `buildSuggestionRequestPrompt`, `createReviewOrchestrator`, `REVIEW_OUTPUT_SCHEMA`, `SUGGESTION_REQUEST_SCHEMA`, `trimSuggestionOverlap`, `untrack`).

`handleCompleteScene`, `handleVerifyIR`, `handleUpdateIR` stay in `DraftStage.svelte` for now — they are thin and will move with the sidebar/main split in Task 6.

- [ ] **Step 3: Run tests + full check**

```bash
pnpm test -- tests/ui/DraftStage.test.ts
pnpm check-all
```

Expected: all green. If the runes compiler rejects `$effect.root` inside a plain function export, adjust the test harness by ensuring the module is a `.svelte.ts` file (it is) and that the controller is constructed inside a Svelte component lifecycle (it is — `DraftStageMain`/`DraftStage` instantiates it at top-level script).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/stages/draftStageReview.svelte.ts src/app/components/stages/DraftStage.svelte
git commit -m "$(cat <<'EOF'
refactor(draft-stage): extract review controller to runes module

Moves every piece of editorial-review state (dismissed,
chunkAnnotations, reviewingChunks, orchestrator, orchestratorVersion,
prevChunkCount, autoReviewTimeout, editDebounceTimers), the three
review $effects, and all seven review/chunk handlers out of
DraftStage.svelte into draftStageReview.svelte.ts. The controller
wraps its effects in $effect.root and exposes a dispose() method
that tears down the effect root and walks the debounce-timer map.
DraftStage.svelte now owns only a single $effect whose cleanup
calls review.dispose() — this is the permanent fix for the timer
leaks the Task 2 surgical patch already addressed.

Handler bodies copied verbatim; existing console.* calls preserved
for F2.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extract `DraftStageMain.svelte` and `DraftStageSidebar.svelte`

**Files:**
- Create: `src/app/components/stages/DraftStageMain.svelte`
- Create: `src/app/components/stages/DraftStageSidebar.svelte`
- Modify: `src/app/components/stages/DraftStage.svelte`

- [ ] **Step 1: Create `DraftStageSidebar.svelte`**

```svelte
<script lang="ts">
import type { NarrativeIR } from "../../../types/index.js";
import { Tabs } from "../../primitives/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import CompilerView from "../CompilerView.svelte";
import IRInspector from "../IRInspector.svelte";
import SetupPayoffPanel from "../SetupPayoffPanel.svelte";
import StyleDriftPanel from "../StyleDriftPanel.svelte";
import VoiceSeparabilityView from "../VoiceSeparabilityView.svelte";
import { createDraftStageMetrics } from "./draftStageMetrics.svelte.js";

type TabId = "compiler" | "drift" | "voice" | "setups" | "ir";

let {
  store,
  commands,
  activeTab = $bindable(),
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  activeTab: TabId;
  onExtractIR: (sceneId?: string) => void;
} = $props();

const metrics = createDraftStageMetrics(store);

const tabItems = [
  { id: "compiler", label: "Draft Engine" },
  { id: "drift", label: "Voice Consistency" },
  { id: "voice", label: "Character Voices" },
  { id: "setups", label: "Setups" },
  { id: "ir", label: "IR" },
];

async function handleVerifyIR() {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.verifySceneIR(sceneId);
}
async function handleUpdateIR(ir: NarrativeIR) {
  const sceneId = store.activeScenePlan?.id;
  if (sceneId) await commands.saveSceneIR(sceneId, ir);
}
</script>

<div class="draft-sidebar">
  <Tabs items={tabItems} active={activeTab} onSelect={(id) => { activeTab = id as TabId; }} />
  <div class="sidebar-content">
    {#if activeTab === "compiler"}
      <CompilerView
        payload={store.compiledPayload}
        log={store.compilationLog}
        lintResult={store.lintResult}
        auditFlags={store.auditFlags}
        metrics={store.metrics}
        onResolveFlag={async (flagId, action) => { await commands.resolveAuditFlag(flagId, action, true); }}
        onDismissFlag={async (flagId) => { await commands.dismissAuditFlag(flagId); }}
      />
    {:else if activeTab === "drift"}
      <StyleDriftPanel
        reports={metrics.styleDriftReports}
        baselineSceneTitle={metrics.baselineSceneTitle}
        sceneTitles={metrics.sceneTitles}
      />
    {:else if activeTab === "voice"}
      <VoiceSeparabilityView report={metrics.voiceReport} />
    {:else if activeTab === "setups"}
      <SetupPayoffPanel
        sceneIRs={store.sceneIRs}
        sceneTitles={metrics.sceneTitles}
        sceneOrders={Object.fromEntries(store.scenes.map((s) => [s.plan.id, s.sceneOrder]))}
      />
    {:else if activeTab === "ir"}
      <IRInspector
        ir={store.activeSceneIR}
        sceneTitle={store.activeScenePlan?.title ?? "No scene"}
        isExtracting={store.isExtractingIR}
        canExtract={store.activeScene?.status === "complete"}
        onExtract={() => onExtractIR(store.activeScenePlan?.id)}
        onVerify={handleVerifyIR}
        onUpdate={handleUpdateIR}
        onClose={() => { activeTab = "compiler"; }}
      />
    {/if}
  </div>
</div>

<style>
  .draft-sidebar {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .sidebar-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Create `DraftStageMain.svelte`**

```svelte
<script lang="ts">
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import DraftingDesk from "../DraftingDesk.svelte";
import { createDraftStageReviewController } from "./draftStageReview.svelte.js";

let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
  onOpenIRTab,
  canGenerate,
  gateMessages,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
  onOpenIRTab: () => void;
  canGenerate: boolean;
  gateMessages: string[];
} = $props();

const review = createDraftStageReviewController(store, commands);

$effect(() => {
  return () => review.dispose();
});

async function handleCompleteScene() {
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  const result = await commands.completeScene(sceneId);
  if (result.ok) onExtractIR(sceneId);
}
</script>

<div class="draft-main">
  <DraftingDesk
    chunks={store.activeSceneChunks}
    scenePlan={store.activeScenePlan}
    sceneStatus={store.activeScene?.status ?? null}
    isGenerating={store.isGenerating}
    isAutopilot={store.isAutopilot}
    isAuditing={store.isAuditing}
    {canGenerate}
    {gateMessages}
    auditFlags={store.auditFlags}
    sceneIR={store.activeSceneIR}
    isExtractingIR={store.isExtractingIR}
    chunkAnnotations={review.chunkAnnotations}
    reviewingChunks={review.reviewingChunks}
    {onGenerate}
    onCancelGeneration={() => store.cancelGeneration()}
    onUpdateChunk={review.handleUpdateChunk}
    onRemoveChunk={review.handleRemoveChunk}
    onDestroyChunk={review.handleDestroyChunk}
    {onRunAudit}
    {onRunDeepAudit}
    onCompleteScene={handleCompleteScene}
    {onAutopilot}
    onCancelAutopilot={() => store.cancelAutopilot()}
    onOpenIRInspector={onOpenIRTab}
    onExtractIR={() => onExtractIR()}
    onReviewChunk={review.handleReviewChunk}
    onAcceptSuggestion={review.handleAcceptSuggestion}
    onDismissAnnotation={review.handleDismissAnnotation}
    onRequestSuggestion={review.handleRequestSuggestion}
  />
</div>

<style>
  .draft-main {
    background: var(--bg-primary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
```

- [ ] **Step 3: Shrink `DraftStage.svelte` to the orchestrator**

Replace the entire file contents:

```svelte
<script lang="ts">
import { checkChunkReviewGate, checkCompileGate, checkScenePlanGate } from "../../../gates/index.js";
import type { Commands } from "../../store/commands.js";
import type { ProjectStore } from "../../store/project.svelte.js";
import SceneAuthoringModal from "../SceneAuthoringModal.svelte";
import SceneSequencer from "../SceneSequencer.svelte";
import DraftStageMain from "./DraftStageMain.svelte";
import DraftStageSidebar from "./DraftStageSidebar.svelte";

type TabId = "compiler" | "drift" | "voice" | "setups" | "ir";

let {
  store,
  commands,
  onGenerate,
  onRunAudit,
  onRunDeepAudit,
  onAutopilot,
  onExtractIR,
}: {
  store: ProjectStore;
  commands: Commands;
  onGenerate: () => void;
  onRunAudit: () => void;
  onRunDeepAudit: () => void;
  onAutopilot: () => void;
  onExtractIR: (sceneId?: string) => void;
} = $props();

let activeTab = $state<TabId>("compiler");

let canGenerate = $derived(!!store.bible && !!store.activeScenePlan && !!store.compiledPayload);

let gateMessages = $derived.by(() => {
  const msgs: string[] = [];
  if (!store.bible) msgs.push("No bible loaded.");
  if (!store.activeScenePlan) msgs.push("No scene plan selected.");
  if (store.activeScenePlan) {
    const planGate = checkScenePlanGate(store.activeScenePlan);
    msgs.push(...planGate.messages);
  }
  if (store.lintResult) {
    const compileGate = checkCompileGate(store.lintResult);
    msgs.push(...compileGate.messages);
  }
  if (store.activeSceneChunks.length > 0) {
    const lastChunk = store.activeSceneChunks[store.activeSceneChunks.length - 1]!;
    const reviewGate = checkChunkReviewGate(lastChunk);
    msgs.push(...reviewGate.messages);
  }
  return msgs;
});
</script>

<div class="draft-stage">
  <SceneSequencer
    scenes={store.scenes}
    activeSceneIndex={store.activeSceneIndex}
    sceneChunks={store.sceneChunks}
    onSelectScene={(i) => store.setActiveScene(i)}
    onAddScene={() => store.setSceneAuthoringOpen(true)}
  />

  <div class="draft-columns">
    <DraftStageMain
      {store}
      {commands}
      {onGenerate}
      {onRunAudit}
      {onRunDeepAudit}
      {onAutopilot}
      {onExtractIR}
      {canGenerate}
      {gateMessages}
      onOpenIRTab={() => { activeTab = "ir"; }}
    />
    <DraftStageSidebar
      {store}
      {commands}
      bind:activeTab
      {onExtractIR}
    />
  </div>

  <SceneAuthoringModal {store} {commands} />
</div>

<style>
  .draft-stage {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .draft-columns {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 1px;
    background: var(--border);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
```

The resulting `DraftStage.svelte` is ~120 lines. It owns only `activeTab` (to coordinate `onOpenIRTab` from main → sidebar) and the two `$derived` gates — all of which are cheap and naturally top-level.

- [ ] **Step 4: Run tests + full check**

```bash
pnpm test -- tests/ui/DraftStage.test.ts
pnpm check-all
```

Expected: all green, including the six DraftStage tests (smoke tests continue to pass through the new composition; timer-leak tests now exercise the `dispose()` path in the controller).

- [ ] **Step 5: Commit**

```bash
git add src/app/components/stages/DraftStageMain.svelte src/app/components/stages/DraftStageSidebar.svelte src/app/components/stages/DraftStage.svelte
git commit -m "$(cat <<'EOF'
refactor(draft-stage): split DraftStage into main + sidebar + orchestrator

Extracts DraftStageMain.svelte (owns the review controller + the
DraftingDesk column + handleCompleteScene) and DraftStageSidebar.svelte
(owns activeTab, metrics derivations, and the five tab panels,
including the handleVerifyIR / handleUpdateIR handlers it delegates
to IRInspector). DraftStage.svelte shrinks from 650 to ~120 lines
and now only composes SceneSequencer + Main + Sidebar + SceneAuthoringModal
and holds the top-level canGenerate / gateMessages $derived blocks.
activeTab is bound between DraftStage and Sidebar so the Main column
can still flip it to "ir" via onOpenIRTab.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Open PR

- [ ] **Step 1: Final full check**

```bash
pnpm check-all
```

Expected: lint, typecheck, and full vitest suite all green.

- [ ] **Step 2: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "refactor(ui): package D — DraftStage split + timer fix (#34)" --body "$(cat <<'EOF'
## Summary
- Fixes the timer leaks in DraftStage: \`autoReviewTimeout\` and every entry of \`editDebounceTimers\` are now cancelled on component unmount, via a review controller's \`dispose()\` routed through an \`\$effect\` cleanup.
- Splits the 650-line god component into a ~120-line orchestrator plus \`DraftStageMain.svelte\`, \`DraftStageSidebar.svelte\`, and three helper modules (\`draftStagePersistence.ts\`, \`draftStageMetrics.svelte.ts\`, \`draftStageReview.svelte.ts\`). No store, primitive, sibling-panel, or API-client file is touched.
- Adds \`tests/ui/DraftStage.test.ts\` with timer-leak regressions (fake timers, mount/unmount, \`getTimerCount()\` assertions) and behavioral smoke tests.

Part of #34. Package D of the [p1 parallel batch spec](../blob/main/docs/superpowers/specs/2026-04-15-p1-parallel-batch-design.md).

## Test plan
- [ ] \`pnpm check-all\` green
- [ ] \`tests/ui/DraftStage.test.ts\` — 6 tests pass (3 timer-leak + 3 smoke)
- [ ] Manual: open a scene, start typing into a chunk, navigate away — no console noise from late persistChunk / apiStoreSignificantEdit calls
- [ ] Manual: auto-review still fires 1.5s after a new chunk is appended
- [ ] Manual: sidebar tab switching still works (Draft Engine / Voice Consistency / Character Voices / Setups / IR)
- [ ] Manual: \"Open IR inspector\" button in DraftingDesk still switches the sidebar to the IR tab

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done criteria

- `src/app/components/stages/DraftStage.svelte` is ≤ ~140 lines and contains no review state, no timers, no metric derivations, and no `console.*` calls.
- `src/app/components/stages/DraftStageMain.svelte`, `DraftStageSidebar.svelte`, `draftStageReview.svelte.ts`, `draftStageMetrics.svelte.ts`, and `draftStagePersistence.ts` all exist.
- `tests/ui/DraftStage.test.ts` exists with 6 tests, all passing.
- `pnpm check-all` green on the branch.
- PR open against `main` with title `refactor(ui): package D — DraftStage split + timer fix (#34)`.
- No file outside the Scope Boundary section has been modified.
- Zero pending timers reported by `vi.getTimerCount()` after `unmount()` in the regression tests.
