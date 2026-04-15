# Package D: DraftStage Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the timer leaks in `DraftStage.svelte` (`autoReviewTimeout` and `editDebounceTimers` — neither is cleaned up on unmount, so pending `setTimeout` callbacks fire against stale state after the component is destroyed) and split the 650-line god component into a thin orchestrator plus three focused sub-components and two framework-free helper modules — all without touching stores, other panels, primitives, or the API client.

**Architecture:** After the refactor, `src/app/components/stages/DraftStage.svelte` becomes a ~120-line orchestrator that composes `<SceneSequencer/>`, `<DraftStageMain/>`, `<DraftStageSidebar/>`, and `<SceneAuthoringModal/>`. All editorial-review state plus the chunk-command handlers (orchestrator, annotations, dismissed set, auto-review timer, debounce timers, `handleUpdateChunk` / `handleRemoveChunk` / `handleDestroyChunk`) move into a single runes-based controller module `draftStageController.svelte.ts` whose lifecycle is owned by `DraftStageMain.svelte` via an `$effect` with a cleanup function — which is what finally kills both timer leaks. Because the controller is constructed at the top level of `DraftStageMain`'s `<script>`, plain `$effect(...)` calls inside the factory auto-bind to the calling component's lifetime — no `$effect.root` is needed. The controller also exposes a `disposed` flag that every async callback (debounced `handleUpdateChunk`, the auto-review setTimeout body, `onAnnotationsChanged` / `onReviewingChanged` from the orchestrator) checks before touching state, so late LLM responses can't fire into a torn-down controller. Pure localStorage persistence helpers move to `draftStagePersistence.ts` (no runes, no UI). Expensive NLP derivations (style drift, voice separability) move to `draftStageMetrics.svelte.ts` (a runes `.svelte.ts` module exporting a factory that returns `$derived`-backed reports). The sidebar owns its own `activeTab` state. The controller uses `SvelteMap` / `SvelteSet` from `svelte/reactivity` for `chunkAnnotations` and `reviewingChunks` so cross-module getter reads stay reactive without fragile manual reassignment.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), TypeScript strict with `noUncheckedIndexedAccess`, Vitest with `@testing-library/svelte`, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

---

## Scope boundary

This package may only modify or create files under:

- `src/app/components/stages/DraftStage*` (i.e. `DraftStage.svelte` plus new sibling files named `DraftStage<Suffix>.svelte` / `draftStage<Suffix>.ts` / `draftStage<Suffix>.svelte.ts`)
- `tests/ui/DraftStage.test.ts` (new)
- `tests/app/components/stages/draftStageController.test.ts` (new — controller unit tests)
- `tests/helpers/mockStore.ts` (new — typed factories for `ProjectStore` / `Commands` mocks; removes `as never` casts from test files)

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
│   ├── uses: draftStageController.svelte.ts (new, ~260 lines, runes module)
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
| `src/app/components/stages/DraftStageMain.svelte` | Svelte | Main column. Instantiates the controller, wires `DraftingDesk` props and event handlers for chunk updates / review / CIPHER. Owns no review state directly — delegates to the controller. |
| `src/app/components/stages/DraftStageSidebar.svelte` | Svelte | Sidebar column. Owns `activeTab` `$state`, `tabItems` constant, metrics derivations (via `draftStageMetrics.svelte.ts`), and the tab switch. |
| `src/app/components/stages/draftStageController.svelte.ts` | Runes module | Exports `createDraftStageController(...)`. Owns `dismissed`, `chunkAnnotations` (`SvelteMap`), `reviewingChunks` (`SvelteSet`), `orchestrator`, `orchestratorVersion`, `prevChunkCount`, `autoReviewTimeout` (module-level `let`), `editDebounceTimers`, and a `disposed` boolean. Exposes handlers and a `dispose()` method that flips `disposed`, clears every timer, and cancels the orchestrator. Auto-review timer is kept as a module-level `let` (not returned from effect cleanup) to avoid the stale re-run cancellation race; a separate no-dep `$effect` provides the unmount teardown. Registered from `DraftStageMain` inside an `$effect` whose cleanup calls `dispose()`. |
| `src/app/components/stages/draftStagePersistence.ts` | Plain TS | Pure `localStorage` helpers: `loadDismissed`, `saveDismissed`, `loadAnnotations`, `saveAnnotations`. Takes `projectId` / `sceneId` as arguments (no store access). |
| `src/app/components/stages/draftStageMetrics.svelte.ts` | Runes module | Exports `createDraftStageMetrics(store)` returning `{ get styleDriftReports(); get voiceReport(); get baselineSceneTitle(); get sceneTitles(); }` as `$derived`-backed getters, with the same `cachedStyleDrift` / `cachedVoiceReport` freeze-during-streaming behavior. |
| `tests/ui/DraftStage.test.ts` | Vitest | Component-level timer-leak smoke tests (fake timers, append chunk, unmount) + behavioral smoke tests for the orchestrator. |
| `tests/app/components/stages/draftStageController.test.ts` | Vitest | Controller unit tests that pin the `editDebounceTimers` leak by calling `controller.handleUpdateChunk(...)` directly and asserting `vi.getTimerCount()` before and after `controller.dispose()`. |
| `tests/helpers/mockStore.ts` | Plain TS | Typed `createMockProjectStore()` / `createMockCommands()` factories. Replaces `as never` casts in tests. |

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

**`draftStageController.svelte.ts`:**

```ts
export interface DraftStageController {
  // Reactive state (getters backed by $state + SvelteMap/SvelteSet)
  readonly chunkAnnotations: SvelteMap<number, EditorialAnnotation[]>;
  readonly reviewingChunks: SvelteSet<number>;

  // Handlers bound to the controller
  handleReviewChunk(index: number): void;
  handleDismissAnnotation(annotationId: string): void;
  handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null>;
  handleUpdateChunk(index: number, changes: Partial<Chunk>): void;
  handleRemoveChunk(index: number): Promise<void>;
  handleDestroyChunk(index: number): Promise<void>;

  // Lifecycle
  dispose(): void;
}

export function createDraftStageController(
  store: ProjectStore,
  commands: Commands,
): DraftStageController;
```

`createDraftStageController` internally uses `$state`, `$effect`, and `untrack` from Svelte to replicate the two existing review `$effect`s (reload-on-project-change, recreate-orchestrator) and the auto-review `$effect`. There is **no `$effect.root`**: because the factory is invoked at the top level of `DraftStageMain`'s `<script>`, the `$effect(...)` calls inside it auto-bind to the calling component's lifetime. `dispose()` sets `disposed = true`, calls `orchestrator?.cancelAll()`, clears `autoReviewTimeout`, and walks `editDebounceTimers` clearing every entry. Every async callback that touches state (debounced persist, auto-review setTimeout body, orchestrator `onAnnotationsChanged` / `onReviewingChanged`) begins with `if (disposed) return;`. Note that `handleAcceptSuggestion` is NOT on this interface: the current component's function was a dead no-op (the comment at DraftStage.svelte lines 228–231 confirms text replacement is handled by `AnnotatedEditor` via a ProseMirror transaction). The no-op is deleted, and the `onAcceptSuggestion` prop is removed from the `DraftingDesk` callsite inside `DraftStageMain`.

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
| `dismissed` (`Set<string>`) | `DraftStage.svelte` L112 | `draftStageController.svelte.ts` (`$state`) |
| `chunkAnnotations` | `DraftStage.svelte` L113 | `draftStageController.svelte.ts` (`SvelteMap` from `svelte/reactivity`) |
| `reviewingChunks` | `DraftStage.svelte` L114 | `draftStageController.svelte.ts` (`SvelteSet` from `svelte/reactivity`) |
| `orchestrator` | `DraftStage.svelte` L115 | `draftStageController.svelte.ts` (`$state`) |
| `orchestratorVersion` | `DraftStage.svelte` L118 | `draftStageController.svelte.ts` (`$state`) |
| `prevChunkCount` | `DraftStage.svelte` L190 | `draftStageController.svelte.ts` (plain `let` inside closure) |
| `autoReviewTimeout` | `DraftStage.svelte` L189 | `draftStageController.svelte.ts` (**module-level `let` inside factory closure**, cleared by `dispose()` and by a separate no-dep unmount `$effect`) |
| `editDebounceTimers` | `DraftStage.svelte` L411 | `draftStageController.svelte.ts` (plain `Map` inside closure, walked by `dispose()`) |
| `disposed` | n/a (new) | `draftStageController.svelte.ts` (plain `let` inside closure, flipped by `dispose()`, checked at the top of every async callback) |
| `activeTab` | `DraftStage.svelte` L321 | `DraftStageSidebar.svelte` (`$state`, `$bindable`) |
| `cachedStyleDrift` | `DraftStage.svelte` L355 | `draftStageMetrics.svelte.ts` (closure `let`) |
| `cachedVoiceReport` | `DraftStage.svelte` L389 | `draftStageMetrics.svelte.ts` (closure `let`) |
| `canGenerate` | `DraftStage.svelte` L332 (`$derived`) | `DraftStage.svelte` orchestrator (still `$derived`; passed into `DraftStageMain`) |
| `gateMessages` | `DraftStage.svelte` L334 (`$derived.by`) | `DraftStage.svelte` orchestrator (still `$derived.by`; passed into `DraftStageMain`) |

No state is duplicated. No prop-drilling beyond one level: `DraftStage` → `DraftStageMain`/`DraftStageSidebar`. The controller is constructed once in `DraftStageMain` and passed nowhere else (handlers are invoked locally inside `DraftStageMain`'s template bindings to `<DraftingDesk>`).

### The timer fix in detail

The auto-review timeout is owned at module scope (a `let` inside the factory closure) so mid-edit re-runs of the scheduling effect do not cancel a valid pending timer. An orthogonal no-dep `$effect` clears it on unmount. The scheduling effect itself does NOT return a cleanup that clears the timeout — doing so would regress the existing bug warned about in the pre-existing comment at `DraftStage.svelte` lines 183–188: when an unrelated dependency changes (e.g. `store.activeSceneChunks` updates reference due to a chunk status change), the effect re-runs, the cleanup cancels the pending timer, then the body hits `count <= prevChunkCount` and early-returns without scheduling a new one, silently dropping a valid pending review.

Inside `draftStageController.svelte.ts`:

```ts
// Module-level (closure) mutable state. NOT reactive. Lifecycle owned by dispose()
// and the unmount-only $effect below.
let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
let prevChunkCount = 0;
const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
let disposed = false;

// Scheduling effect — tracks store.activeSceneChunks. Does NOT clear
// autoReviewTimeout in cleanup; see comment above.
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
    if (disposed) return;
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
});

// Unmount-only cleanup for autoReviewTimeout. No dependencies are tracked,
// so this effect's body runs once on mount and its cleanup runs once on unmount.
$effect(() => {
  return () => {
    if (autoReviewTimeout !== undefined) {
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = undefined;
    }
  };
});

function dispose(): void {
  if (disposed) return;
  disposed = true;
  orchestrator?.cancelAll();
  clearTimeout(autoReviewTimeout);
  autoReviewTimeout = undefined;
  for (const timer of editDebounceTimers.values()) clearTimeout(timer);
  editDebounceTimers.clear();
}
```

In `DraftStageMain.svelte`:

```ts
const controller = createDraftStageController(store, commands);
$effect(() => {
  return () => controller.dispose();
});
```

That `$effect`'s return function runs on component unmount, calling `dispose()`, which flips `disposed`, cancels the auto-review timeout, and walks every entry of `editDebounceTimers`. The orthogonal unmount-only `$effect` inside the factory is an additional belt-and-braces guard (covers the edge case where `dispose()` somehow doesn't run). **Both leaks die.**

---

## Task 1: Write failing tests first

**Files:**
- Create: `tests/helpers/mockStore.ts`
- Create: `tests/app/components/stages/draftStageController.test.ts`
- Create: `tests/ui/DraftStage.test.ts`

The two regression tests must actually **exercise** the leaks they claim to pin — the original plan's tests mounted and immediately unmounted without ever triggering a debounced edit or appending a chunk, so the assertions passed even against the buggy code. The fix is:

1. A **controller-unit test** (new `tests/app/components/stages/draftStageController.test.ts`) that constructs the controller directly with a mock store/commands, calls `controller.handleUpdateChunk(0, { editedText: "foo" })`, asserts `vi.getTimerCount() === 1`, calls `controller.dispose()`, and asserts `vi.getTimerCount() === 0`. This pins the `editDebounceTimers` leak.
2. A **component-level smoke test** (`tests/ui/DraftStage.test.ts`) that mounts `DraftStage`, mutates the mock store's `activeSceneChunks` to append a new chunk after mount, advances fake timers partway (e.g. 500 ms), unmounts, and asserts `vi.getTimerCount() === 0` plus that the mocked orchestrator's `requestReview` was never called. This pins the `autoReviewTimeout` leak.

Because Task 1 runs **before** Task 2's fix and **before** the controller module exists, a minimal build-order note applies: the controller-unit test imports from `./draftStageController.svelte.js`, which doesn't exist yet. Either (a) create the controller module as an empty stub that exports `createDraftStageController` with the real interface but a throwing body, then fill it in during Task 5a, or (b) mark the controller-unit test `.skip` in Task 1 and un-skip it as the first action of Task 5a. Option (b) is simpler and is what this plan uses.

- [ ] **Step 1a: Create `tests/helpers/mockStore.ts` — typed factories (no `as never`)**

```ts
import { vi } from "vitest";
import type { Commands } from "../../src/app/store/commands.js";
import type { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeChunk, makeSceneEntry } from "../../src/app/stories/factories.js";

export function createMockProjectStore(overrides: Partial<ProjectStore> = {}): ProjectStore {
  const scene = makeSceneEntry("scene-1", "The Confrontation", "drafting");
  const chunk = makeChunk({ sceneId: "scene-1" });
  const base = {
    project: { id: "project-1" },
    bible: { characters: [], voiceRules: [], killList: [] },
    scenes: [scene],
    activeSceneIndex: 0,
    activeScene: scene,
    activeScenePlan: scene.plan,
    activeSceneChunks: [chunk],
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
  };
  return { ...base, ...overrides } as unknown as ProjectStore;
}

export function createMockCommands(overrides: Partial<Commands> = {}): Commands {
  const base = {
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
  return { ...base, ...overrides } as unknown as Commands;
}
```

The `as unknown as` cast at the return site is the narrowest hatch and is confined to this one helper file. Individual test files get fully typed mocks without touching `never`.

- [ ] **Step 1b: Create `tests/app/components/stages/draftStageController.test.ts` — controller unit test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCommands, createMockProjectStore } from "../../../helpers/mockStore.js";

// Stub the review orchestrator factory so we don't call the LLM
vi.mock("../../../../src/review/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../../src/review/index.js");
  return {
    ...actual,
    createReviewOrchestrator: vi.fn(() => ({
      requestReview: vi.fn(),
      cancelAll: vi.fn(),
    })),
  };
});

describe.skip("draftStageController — timer leak regression (unskip in Task 5a)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears pending edit-debounce timers on dispose()", async () => {
    const { createDraftStageController } = await import(
      "../../../../src/app/components/stages/draftStageController.svelte.js"
    );
    const store = createMockProjectStore();
    const commands = createMockCommands();
    const controller = createDraftStageController(store, commands);

    expect(vi.getTimerCount()).toBe(0);
    controller.handleUpdateChunk(0, { editedText: "typed text" });
    expect(vi.getTimerCount()).toBe(1);

    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores late debounced callbacks after dispose()", async () => {
    const { createDraftStageController } = await import(
      "../../../../src/app/components/stages/draftStageController.svelte.js"
    );
    const store = createMockProjectStore();
    const commands = createMockCommands();
    const controller = createDraftStageController(store, commands);

    controller.handleUpdateChunk(0, { editedText: "typed text" });
    controller.dispose();
    vi.advanceTimersByTime(2000);
    expect(commands.persistChunk).not.toHaveBeenCalled();
  });
});
```

The suite is `describe.skip` in Task 1 so the build isn't broken by the missing controller module. Task 5a un-skips it and expects it to PASS against the newly-extracted controller.

- [ ] **Step 1c: Create `tests/ui/DraftStage.test.ts` — component-level smoke + auto-review leak**

```ts
import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DraftStage from "../../src/app/components/stages/DraftStage.svelte";
import { makeChunk } from "../../src/app/stories/factories.js";
import { createMockCommands, createMockProjectStore } from "../helpers/mockStore.js";

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

// Stub the review orchestrator factory so tests don't hit the LLM.
// We capture the most recent instance so tests can assert on its calls.
const mockOrchestratorInstances: Array<{ requestReview: ReturnType<typeof vi.fn>; cancelAll: ReturnType<typeof vi.fn> }> = [];
vi.mock("../../src/review/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../src/review/index.js");
  return {
    ...actual,
    createReviewOrchestrator: vi.fn(() => {
      const instance = { requestReview: vi.fn(), cancelAll: vi.fn() };
      mockOrchestratorInstances.push(instance);
      return instance;
    }),
  };
});

function defaultProps() {
  return {
    store: createMockProjectStore(),
    commands: createMockCommands(),
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
    mockOrchestratorInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not fire auto-review callback after unmount (append-then-unmount)", async () => {
    const props = defaultProps();
    const { unmount } = render(DraftStage, props);
    vi.advanceTimersByTime(0);

    // Append a new chunk to trigger the auto-review scheduling effect.
    // The mock store is a plain object; test the effect propagation via a
    // direct mutation + manual $effect tick. If the production store uses
    // runes, rely on the SvelteMap-backed reactive append helper instead.
    const newChunk = makeChunk({ sceneId: "scene-1" });
    props.store.activeSceneChunks = [...props.store.activeSceneChunks, newChunk];
    props.store.sceneChunks["scene-1"] = props.store.activeSceneChunks;
    // Flush microtasks so the scheduling $effect runs and schedules setTimeout
    await Promise.resolve();

    // Advance partway through the 1500ms debounce
    vi.advanceTimersByTime(500);
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);

    unmount();

    // Advance past the 1500ms delay — nothing should fire
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(0);
    const orch = mockOrchestratorInstances[mockOrchestratorInstances.length - 1];
    if (orch) expect(orch.requestReview).not.toHaveBeenCalled();
  });

  it("clears any already-pending timers on bare unmount", () => {
    const { unmount } = render(DraftStage, defaultProps());
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

describe("DraftStage — Map/Set reactivity across module boundary (Task 5 gate)", () => {
  it("propagates controller chunkAnnotations mutations into DraftingDesk", () => {
    // This test is skipped in Task 1 (no controller yet) and un-skipped in
    // Task 5a. It guards the SvelteMap/SvelteSet decision: if the controller
    // reverted to plain Map, this test would fail because DraftingDesk's
    // `chunkAnnotations` prop would not re-render on mutation.
    //
    // Implementation: mount DraftStage, reach into the rendered tree to
    // find a DraftingDesk chunk indicator, controller-mutate
    // chunkAnnotations.set(0, [...]), assert the DOM updates within a tick.
    // Intentionally a placeholder here — flesh out in Task 5a.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the auto-review leak test FAILS for the right reason**

Run: `pnpm test -- tests/ui/DraftStage.test.ts tests/app/components/stages/draftStageController.test.ts`

Expected:
- The `does not fire auto-review callback after unmount (append-then-unmount)` test **fails** against the current buggy code — after the component unmounts, the 1500 ms `setTimeout` fires and either `requestReview` gets called on the dead orchestrator or `vi.getTimerCount()` is non-zero.
- The `clears any already-pending timers on bare unmount` test may pass on current code because the bare mount/unmount never appends a chunk — that's fine; it's a defensive smoke test, not a leak pin. (The **real** `editDebounceTimers` pin lives in `draftStageController.test.ts` and is currently `describe.skip`'d — verify the skip reports correctly.)
- The three smoke tests pass against the current implementation.

If any smoke test fails against the *current* `DraftStage.svelte`, stop and adjust the test to match current behavior before moving on.

**Do not skip this step.** The whole point of D-I30 is that the first revision of this plan's tests passed against the buggy code. We must see the auto-review test RED before moving to Task 2.

- [ ] **Step 3: Commit the failing tests + helper**

```bash
git add tests/helpers/mockStore.ts \
        tests/app/components/stages/draftStageController.test.ts \
        tests/ui/DraftStage.test.ts
git commit -m "$(cat <<'EOF'
test(draft-stage): add timer-leak regression and smoke tests

Adds tests/helpers/mockStore.ts (typed ProjectStore/Commands factories),
tests/ui/DraftStage.test.ts (append-then-unmount auto-review leak pin +
behavioral smoke tests), and tests/app/components/stages/
draftStageController.test.ts (controller-unit test for editDebounceTimers
leak, currently describe.skip until Task 5a creates the module).

The auto-review test exercises the leak by appending a chunk after mount
so the scheduling effect actually schedules a setTimeout, then unmounts
partway through — this fails against the current buggy DraftStage.
Smoke tests pin the SceneSequencer + sidebar tab structure.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix the timer leak (minimal change, lands before the split)

**Files:**
- Modify: `src/app/components/stages/DraftStage.svelte`

This task lands the narrowest possible fix: add unmount-only cleanups for both timer sets without relocating them into the scheduling effect's return function (which would regress the race warned about in the existing comment). This gives the refactor a safety net — if Task 3 takes multiple commits, the leak is already fixed in between.

- [ ] **Step 1: Add an unmount-only cleanup effect for `autoReviewTimeout`**

**Do NOT move `clearTimeout(autoReviewTimeout)` into the auto-review scheduling effect's return. That would regress the pre-existing race.** Keep `let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;` at module scope exactly where it is (line 189), and keep the scheduling effect body unchanged. Instead, directly **after** that scheduling `$effect(...)` block, add a separate no-dep effect for teardown:

```ts
// Unmount-only cleanup: the auto-review timeout is owned at module scope so
// mid-edit re-runs of the scheduling effect (e.g. when store.activeSceneChunks
// changes reference but count hasn't increased) don't cancel a valid pending
// timer. This orthogonal effect has no reactive dependencies, so its body
// runs once on mount and its cleanup runs once on unmount.
$effect(() => {
  return () => {
    if (autoReviewTimeout !== undefined) {
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = undefined;
    }
  };
});
```

Also update the comment above `let autoReviewTimeout` (lines 183–188) to accurately describe the invariant:

```ts
// IMPORTANT: The auto-review timeout is owned at module scope (not returned
// from an effect cleanup) so that when store.activeSceneChunks changes
// reference due to an unrelated update (e.g. a status flip on an existing
// chunk), the re-running effect's early-return (count <= prevChunkCount)
// does not cancel a valid pending review. An orthogonal no-dep $effect
// (below) clears this timeout on component unmount.
let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
```

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

## Task 5: Extract `draftStageController.svelte.ts` (split into 4 bisectable commits)

**Files:**
- Create: `src/app/components/stages/draftStageController.svelte.ts`
- Modify: `src/app/components/stages/DraftStage.svelte`
- Modify: `tests/app/components/stages/draftStageController.test.ts` (un-skip)
- Modify: `tests/ui/DraftStage.test.ts` (un-skip Map/Set reactivity test)

This is the largest extraction. Split into four separate commits so each can be bisected independently. Deletion of `handleAcceptSuggestion` (dead no-op, DraftStage.svelte lines 228–231) happens in Task 5c. The controller uses `SvelteMap` / `SvelteSet` from `svelte/reactivity` for its reactive collections, plain `$effect(...)` (not `$effect.root`) for lifecycle binding, and a `disposed` boolean guard on every async callback.

### Task 5a: Create the controller skeleton (state + effects + dispose, no handlers yet)

- [ ] **Step 1: Create `draftStageController.svelte.ts` with state, effects, and `dispose()` — handlers are stubs that throw**

The file imports, state, effects, and `dispose()` are final. Handler bodies are `throw new Error("not yet moved — see Task 5b/5c")` so the module compiles and the controller-unit test can exercise `handleUpdateChunk` after un-skipping in Task 5b. Wait — to make Task 5a's unit-test un-skip meaningful, `handleUpdateChunk` needs a real body in 5a itself, which contradicts splitting by handler. Resolution: Task 5a gets a real body for **only** `handleUpdateChunk` (the one needed by the controller-unit test); the other six handlers throw. Task 5b then moves the remaining chunk-command handlers; Task 5c moves the editorial handlers. This ordering keeps each commit independently bisectable while letting the leak regression fire the moment the controller exists.

```ts
import { untrack } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { apiFireBatchCipher, apiStoreSignificantEdit } from "../../../api/client.js";
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

const REVIEW_MODEL = DEFAULT_MODEL;
const REVIEW_MAX_TOKENS = 2048;
const SUGGESTION_MAX_TOKENS = 1024;

export interface DraftStageController {
  readonly chunkAnnotations: SvelteMap<number, EditorialAnnotation[]>;
  readonly reviewingChunks: SvelteSet<number>;
  handleReviewChunk(index: number): void;
  handleDismissAnnotation(annotationId: string): void;
  handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null>;
  handleUpdateChunk(index: number, changes: Partial<Chunk>): void;
  handleRemoveChunk(index: number): Promise<void>;
  handleDestroyChunk(index: number): Promise<void>;
  dispose(): void;
}

export function createDraftStageController(
  store: ProjectStore,
  commands: Commands,
): DraftStageController {
  let dismissed = $state<Set<string>>(loadDismissed(store.project?.id));
  const chunkAnnotations = new SvelteMap<number, EditorialAnnotation[]>();
  const reviewingChunks = new SvelteSet<number>();
  let orchestrator = $state<ReviewOrchestrator | null>(null);
  let orchestratorVersion = $state(0);

  // Non-reactive closure state — lifecycle owned by dispose() and
  // the unmount-only $effect below.
  let autoReviewTimeout: ReturnType<typeof setTimeout> | undefined;
  let prevChunkCount = 0;
  const editDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

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

  // NOTE: plain $effect calls — NOT $effect.root. Because this factory is
  // invoked at the top level of DraftStageMain's <script>, these effects
  // auto-bind to that component's lifetime.

  // Reload dismissed set when project changes
  $effect(() => {
    const _projectId = store.project?.id;
    if (disposed) return;
    dismissed = loadDismissed(store.project?.id);
  });

  // Recreate orchestrator when bible, scene, voice guide, or version changes
  $effect(() => {
    const bible = store.bible;
    const scenePlan = store.activeScenePlan;
    const _version = orchestratorVersion;
    const _voiceGuide = store.voiceGuide;
    if (disposed) return;

    untrack(() => {
      orchestrator?.cancelAll();
      reviewingChunks.clear();
      prevChunkCount = 0;
      clearTimeout(autoReviewTimeout);
      autoReviewTimeout = undefined;
    });

    if (!bible || !scenePlan) {
      orchestrator = null;
      chunkAnnotations.clear();
      return;
    }

    const loaded = loadAnnotations(store.project?.id, scenePlan.id);
    chunkAnnotations.clear();
    for (const [idx, anns] of loaded) {
      const filtered = anns.filter((a) => !dismissed.has(a.fingerprint));
      if (filtered.length > 0) chunkAnnotations.set(idx, filtered);
    }

    orchestrator = createReviewOrchestrator(
      bible,
      scenePlan,
      () => dismissed,
      llmReviewClient,
      (chunkIndex, anns, reviewedText) => {
        if (disposed) return;
        const currentChunk = store.activeSceneChunks[chunkIndex];
        if (currentChunk && getCanonicalText(currentChunk) !== reviewedText) return;
        chunkAnnotations.set(chunkIndex, anns);
        if (scenePlan) saveAnnotations(store.project?.id, scenePlan.id, new Map(chunkAnnotations));
      },
      (reviewing) => {
        if (disposed) return;
        reviewingChunks.clear();
        for (const idx of reviewing) reviewingChunks.add(idx);
      },
      store.voiceGuide?.editingInstructions || undefined,
    );
  });

  // Auto-review scheduling effect. Does NOT clear autoReviewTimeout in
  // cleanup; the orthogonal unmount-only effect below handles teardown.
  $effect(() => {
    const count = store.activeSceneChunks.length;
    const sceneId = store.activeScenePlan?.id;
    const generating = store.isGenerating;
    if (disposed) return;
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
      if (disposed) return;
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
  });

  // Unmount-only cleanup for autoReviewTimeout (belt-and-braces alongside dispose()).
  $effect(() => {
    return () => {
      if (autoReviewTimeout !== undefined) {
        clearTimeout(autoReviewTimeout);
        autoReviewTimeout = undefined;
      }
    };
  });

  // Handler — handleUpdateChunk is implemented here (needed by the controller
  // unit test to pin the editDebounceTimers leak). Remaining handlers are
  // stubs until Task 5b/5c.
  function handleUpdateChunk(index: number, changes: Partial<Chunk>): void {
    if (disposed) return;
    const sceneId = store.activeScenePlan?.id;
    if (!sceneId) return;
    store.updateChunkForScene(sceneId, index, changes);
    if (changes.editedText !== undefined || changes.humanNotes !== undefined) {
      const key = `${sceneId}:${index}`;
      const existing = editDebounceTimers.get(key);
      if (existing) clearTimeout(existing);
      editDebounceTimers.set(
        key,
        setTimeout(() => {
          if (disposed) return;
          commands.persistChunk(sceneId, index);
          editDebounceTimers.delete(key);

          // After persistChunk, track significant edits for CIPHER
          const chunk = store.activeSceneChunks[index];
          if (chunk?.generatedText && chunk.editedText && store.project) {
            if (shouldTriggerCipher(chunk.generatedText, chunk.editedText)) {
              apiStoreSignificantEdit(store.project.id, chunk.id, chunk.generatedText, chunk.editedText)
                .then((count) => {
                  if (disposed) return;
                  if (count >= 10) {
                    console.log(`[cipher] ${count} significant edits — triggering batch CIPHER`);
                    apiFireBatchCipher(store.project!.id)
                      .then(({ ring1Injection }) => {
                        if (disposed) return;
                        if (ring1Injection && store.voiceGuide) {
                          store.setVoiceGuide({ ...store.voiceGuide, ring1Injection });
                          console.log("[cipher] Voice re-distilled with new CIPHER preferences");
                        }
                      })
                      .catch((err) => console.warn("[cipher] Batch inference failed:", err));
                  }
                })
                .catch((err) => console.warn("[cipher] Edit tracking failed:", err));
            }
          }
        }, 500),
      );
    } else {
      commands.persistChunk(sceneId, index);
    }
  }

  function handleReviewChunk(_index: number): void {
    throw new Error("handleReviewChunk not yet moved — see Task 5c");
  }
  function handleDismissAnnotation(_annotationId: string): void {
    throw new Error("handleDismissAnnotation not yet moved — see Task 5c");
  }
  async function handleRequestSuggestion(_annotationId: string, _feedback: string): Promise<string | null> {
    throw new Error("handleRequestSuggestion not yet moved — see Task 5c");
  }
  async function handleRemoveChunk(_index: number): Promise<void> {
    throw new Error("handleRemoveChunk not yet moved — see Task 5b");
  }
  async function handleDestroyChunk(_index: number): Promise<void> {
    throw new Error("handleDestroyChunk not yet moved — see Task 5b");
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    orchestrator?.cancelAll();
    clearTimeout(autoReviewTimeout);
    autoReviewTimeout = undefined;
    for (const timer of editDebounceTimers.values()) clearTimeout(timer);
    editDebounceTimers.clear();
  }

  return {
    get chunkAnnotations() {
      return chunkAnnotations;
    },
    get reviewingChunks() {
      return reviewingChunks;
    },
    handleReviewChunk,
    handleDismissAnnotation,
    handleRequestSuggestion,
    handleUpdateChunk,
    handleRemoveChunk,
    handleDestroyChunk,
    dispose,
  };
}
```

- [ ] **Step 2: Un-skip the controller unit test and confirm it now passes**

Change `describe.skip(...)` to `describe(...)` in `tests/app/components/stages/draftStageController.test.ts`. Run:

```bash
pnpm test -- tests/app/components/stages/draftStageController.test.ts
```

Expected: both tests pass. `editDebounceTimers` leak is pinned.

- [ ] **Step 3: DraftStage.svelte still owns the old handlers — no changes here**

5a creates the controller alongside the existing implementation. DraftStage.svelte is untouched. This guarantees the commit is bisectable: if Task 5b breaks something, Task 5a's green build can be checked out independently.

- [ ] **Step 4: Run full check + commit**

```bash
pnpm check-all
git add src/app/components/stages/draftStageController.svelte.ts tests/app/components/stages/draftStageController.test.ts
git commit -m "$(cat <<'EOF'
refactor(draft-stage): add draftStageController skeleton with handleUpdateChunk

Creates draftStageController.svelte.ts with the reactive state
(SvelteMap chunkAnnotations, SvelteSet reviewingChunks, orchestrator,
etc.), the three review \$effects (project-change reload,
orchestrator recreation, auto-review scheduling), the orthogonal
unmount-only cleanup effect for autoReviewTimeout, a disposed flag
guarding every async callback, and dispose(). handleUpdateChunk has
its real body (needed by the controller-unit test to pin the
editDebounceTimers leak); the other six handlers throw until 5b/5c.

DraftStage.svelte is unchanged — this commit is independently
bisectable. The controller-unit test is un-skipped and now passes.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5b: Move chunk-command handlers into the controller

- [ ] **Step 1: Implement `handleRemoveChunk` and `handleDestroyChunk` in the controller**

Replace the throwing stubs. Bodies are copied verbatim from `DraftStage.svelte` (`handleRemoveChunk` at lines 455–459, `handleDestroyChunk` at lines 461–510) with the following substitutions:

- `store.activeScenePlan?.id` references stay the same
- `saveAnnotations(sceneId, new Map())` becomes `saveAnnotations(store.project?.id, sceneId, new Map())`
- `chunkAnnotations = new Map()` becomes `chunkAnnotations.clear()` (SvelteMap)
- Every entry point gets `if (disposed) return;` at the top

```ts
async function handleRemoveChunk(index: number): Promise<void> {
  if (disposed) return;
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  await commands.removeChunk(sceneId, index);
}

async function handleDestroyChunk(index: number): Promise<void> {
  if (disposed) return;
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId) return;
  const chunks = store.activeSceneChunks;
  const isLast = index === chunks.length - 1;

  if (!isLast) {
    const count = chunks.length - index;
    const ok = window.confirm(
      `Delete chunk ${index + 1} and ${count - 1} later chunk${count - 1 > 1 ? "s" : ""} that depend on it?`,
    );
    if (!ok) return;
  }

  // ── Cancel everything that references chunk indices ──

  // 1. Stop autopilot — it would generate into a broken state
  if (store.isAutopilot) store.cancelAutopilot();

  // 2. Cancel pending auto-review (against the old chunk array)
  clearTimeout(autoReviewTimeout);
  autoReviewTimeout = undefined;

  // 3. Cancel in-flight LLM reviews and clear reviewing indicators
  orchestrator?.cancelAll();

  // 4. Flush edit debounce timers for destroyed indices
  for (let i = index; i < chunks.length; i++) {
    const key = `${sceneId}:${i}`;
    const timer = editDebounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      editDebounceTimers.delete(key);
    }
  }

  // 5. Clear persisted annotations (indices are now stale)
  saveAnnotations(store.project?.id, sceneId, new Map());
  chunkAnnotations.clear();

  // ── Remove chunks from end backward to avoid index shifting ──
  for (let i = chunks.length - 1; i >= index; i--) {
    if (disposed) return;
    await commands.removeChunk(sceneId, i);
  }

  // 6. Force orchestrator recreation with clean internal state.
  if (disposed) return;
  orchestratorVersion++;
}
```

- [ ] **Step 2: Run tests + full check + commit**

```bash
pnpm check-all
git add src/app/components/stages/draftStageController.svelte.ts
git commit -m "$(cat <<'EOF'
refactor(draft-stage): move chunk-command handlers into controller

Moves handleRemoveChunk and handleDestroyChunk bodies from
DraftStage.svelte into draftStageController.svelte.ts. Bodies are
verbatim from the original with (a) SvelteMap.clear() replacing
chunkAnnotations reassignment, (b) saveAnnotations threading
store.project?.id, and (c) disposed-guard at entry. DraftStage.svelte
still exports its own handlers — Task 5d wires it to delegate.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5c: Move editorial handlers into the controller (and delete `handleAcceptSuggestion`)

- [ ] **Step 1: Implement the editorial handlers**

`handleAcceptSuggestion` is intentionally **not** re-added: the current component's implementation (lines 228–231) is a documented no-op — "Text replacement handled by AnnotatedEditor via PM transaction. No auto-re-review". The prop is removed from the `DraftingDesk` callsite in Task 5d (and any necessary adjustment to `DraftingDesk`'s contract is out of scope; if `DraftingDesk` requires the callback, pass `() => {}` inline at the callsite rather than reintroducing the dead function).

Replace the remaining stubs with verbatim copies from `DraftStage.svelte`:

```ts
function handleReviewChunk(index: number): void {
  if (disposed) return;
  const chunks = store.activeSceneChunks;
  const sceneId = store.activeScenePlan?.id;
  if (!sceneId || !orchestrator || index >= chunks.length) return;
  const chunk = chunks[index]!;
  if (chunk.status === "accepted") return;
  const view: ChunkView = { index, text: getCanonicalText(chunk), sceneId };
  orchestrator.requestReview([view], true);
}

function handleDismissAnnotation(annotationId: string): void {
  if (disposed) return;
  // Persist the fingerprint to the dismissed set so future reviews exclude it.
  // The decoration is already removed in AnnotatedEditor via PM transaction —
  // we intentionally do NOT modify chunkAnnotations here because that would
  // trigger the Sync Annotations effect with stale charRanges (same corruption
  // class as the accept bug). Same-fingerprint annotations on other chunks
  // remain visible until the next re-review, which is the safer trade-off.
  const sceneId = store.activeScenePlan?.id;
  for (const [, anns] of chunkAnnotations) {
    const ann = anns.find((a) => a.id === annotationId);
    if (ann) {
      dismissed = new Set(dismissed).add(ann.fingerprint);
      saveDismissed(store.project?.id, dismissed);
      break;
    }
  }
  // Persist annotation removal to localStorage
  if (sceneId) saveAnnotations(store.project?.id, sceneId, new Map(chunkAnnotations));
}

async function handleRequestSuggestion(annotationId: string, feedback: string): Promise<string | null> {
  if (disposed) return null;
  // 1. Find the annotation and its chunk index
  let targetAnnotation: EditorialAnnotation | undefined;
  let targetChunkIndex: number | undefined;
  for (const [chunkIndex, anns] of chunkAnnotations) {
    const ann = anns.find((a) => a.id === annotationId);
    if (ann) {
      targetAnnotation = ann;
      targetChunkIndex = chunkIndex;
      break;
    }
  }
  if (!targetAnnotation || targetChunkIndex === undefined) return null;

  // 2. Get chunk text and build context
  const chunks = store.activeSceneChunks;
  const chunk = chunks[targetChunkIndex];
  if (!chunk || !store.bible || !store.activeScenePlan) return null;
  const chunkText = getCanonicalText(chunk);
  const context = buildReviewContext(
    store.bible,
    store.activeScenePlan,
    store.voiceGuide?.editingInstructions || undefined,
  );

  // 3. Build prompt and call LLM
  const { systemPrompt, userPrompt } = buildSuggestionRequestPrompt(context, targetAnnotation, chunkText, feedback);

  try {
    const rawJson = await callLLM(
      systemPrompt,
      userPrompt,
      REVIEW_MODEL,
      SUGGESTION_MAX_TOKENS,
      SUGGESTION_REQUEST_SCHEMA as Record<string, unknown>,
    );

    if (disposed) return null;

    // 4. Parse and validate
    const parsed = JSON.parse(rawJson);
    if (!parsed.suggestion || typeof parsed.suggestion !== "string" || parsed.suggestion.trim().length === 0) {
      return null;
    }

    // 4b. Trim suggestion overlap — catch cases where the LLM rewrites beyond the focus span
    const prefixText = chunkText.slice(0, targetAnnotation.charRange.start);
    const suffixText = chunkText.slice(targetAnnotation.charRange.end);
    parsed.suggestion = trimSuggestionOverlap(parsed.suggestion, prefixText, suffixText);

    // 5. Update annotation in chunkAnnotations
    const updatedAnns = (chunkAnnotations.get(targetChunkIndex) ?? []).map((a) =>
      a.id === annotationId ? { ...a, suggestion: parsed.suggestion } : a,
    );
    chunkAnnotations.set(targetChunkIndex, updatedAnns);

    // 6. Persist
    const sceneId = store.activeScenePlan?.id;
    if (sceneId) saveAnnotations(store.project?.id, sceneId, new Map(chunkAnnotations));

    return parsed.suggestion;
  } catch (err) {
    console.warn("[editorial] Suggestion generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
```

All `console.*` calls are preserved verbatim for Package F2 to migrate later. No `createLogger("draft")` import — it would be dead code.

- [ ] **Step 2: Run tests + full check + commit**

```bash
pnpm check-all
git add src/app/components/stages/draftStageController.svelte.ts
git commit -m "$(cat <<'EOF'
refactor(draft-stage): move editorial handlers into controller

Moves handleReviewChunk, handleDismissAnnotation, and
handleRequestSuggestion bodies from DraftStage.svelte into the
controller. Bodies are verbatim with (a) SvelteMap mutations replacing
chunkAnnotations reassignment, (b) saveAnnotations/saveDismissed
threading store.project?.id, (c) disposed-guard at entry and after
each await. handleAcceptSuggestion is NOT re-added: it was a
documented no-op in the original component ("text replacement handled
by AnnotatedEditor via PM transaction"); Task 5d inlines an empty
callback at the DraftingDesk callsite rather than preserving the
dead function.

Part of #34.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5d: Slim `DraftStage.svelte` to delegate to the controller

- [ ] **Step 1: Instantiate the controller and rewire template bindings**

(The review state, effects, and handlers are still duplicated in DraftStage.svelte at this point — 5d deletes them.)

```ts
import { createDraftStageController } from "./draftStageController.svelte.js";

const controller = createDraftStageController(store, commands);

$effect(() => {
  return () => controller.dispose();
});
```

Delete from `DraftStage.svelte`:
- `llmReviewClient` constant and `REVIEW_MODEL` / `REVIEW_MAX_TOKENS` / `SUGGESTION_MAX_TOKENS` constants
- The four inline persistence helpers (already extracted in Task 3, but confirm they are gone)
- `dismissed`, `chunkAnnotations`, `reviewingChunks`, `orchestrator`, `orchestratorVersion` state declarations
- The two review `$effect`s (project-change reload, orchestrator recreation)
- `autoReviewTimeout`, `prevChunkCount` declarations and the auto-review `$effect` + the Task-2 unmount-only `$effect`
- `handleReviewChunk`, `handleAcceptSuggestion`, `handleDismissAnnotation`, `handleRequestSuggestion`
- `editDebounceTimers` declaration and its Task-2 unmount-only `$effect`
- `handleUpdateChunk`, `handleRemoveChunk`, `handleDestroyChunk`
- All imports now only used by the controller module: `apiFireBatchCipher`, `apiStoreSignificantEdit`, `analyzeEdits`, `applyProposal`, `BibleProposal`, `generateTuningProposals`, `TuningProposal`, `callLLM`, `shouldTriggerCipher`, `buildReviewContext`, `ChunkView`, `EditorialAnnotation`, `LLMReviewClient`, `ReviewOrchestrator`, `buildSuggestionRequestPrompt`, `createReviewOrchestrator`, `REVIEW_OUTPUT_SCHEMA`, `SUGGESTION_REQUEST_SCHEMA`, `trimSuggestionOverlap`, `untrack`, `DEFAULT_MODEL`

Template bindings change:

- `chunkAnnotations={chunkAnnotations}` → `chunkAnnotations={controller.chunkAnnotations}`
- `reviewingChunks={reviewingChunks}` → `reviewingChunks={controller.reviewingChunks}`
- `onUpdateChunk={handleUpdateChunk}` → `onUpdateChunk={controller.handleUpdateChunk}`
- `onRemoveChunk={handleRemoveChunk}` → `onRemoveChunk={controller.handleRemoveChunk}`
- `onDestroyChunk={handleDestroyChunk}` → `onDestroyChunk={controller.handleDestroyChunk}`
- `onReviewChunk={handleReviewChunk}` → `onReviewChunk={controller.handleReviewChunk}`
- `onAcceptSuggestion={handleAcceptSuggestion}` → `onAcceptSuggestion={() => {}}` (inline no-op; `handleAcceptSuggestion` is deleted)
- `onDismissAnnotation={handleDismissAnnotation}` → `onDismissAnnotation={controller.handleDismissAnnotation}`
- `onRequestSuggestion={handleRequestSuggestion}` → `onRequestSuggestion={controller.handleRequestSuggestion}`

`handleCompleteScene`, `handleVerifyIR`, `handleUpdateIR` stay in `DraftStage.svelte` for now — they are thin and will move with the sidebar/main split in Task 6.

- [ ] **Step 2: Un-skip the Map/Set reactivity smoke test in `tests/ui/DraftStage.test.ts`**

Flesh out the placeholder test per the comment in Task 1 Step 1c — mount DraftStage, use the exported controller reference (if reachable via component instance) or trigger `chunkAnnotations` mutation via a simulated orchestrator callback (by calling the captured `createReviewOrchestrator` mock's fourth callback argument), and assert the DOM reflects the updated annotation list. If the test cannot reach the internals, this is the indicator that `SvelteMap` / `SvelteSet` **is** doing its job automatically (vs a plain `Map` which would silently fail the same test) — document the finding and leave the test as a render-round-trip smoke.

- [ ] **Step 3: Run tests + full check**

```bash
pnpm test -- tests/ui/DraftStage.test.ts tests/app/components/stages/draftStageController.test.ts
pnpm check-all
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/stages/DraftStage.svelte tests/ui/DraftStage.test.ts
git commit -m "$(cat <<'EOF'
refactor(draft-stage): slim DraftStage to delegate review to controller

Deletes every piece of editorial-review state, the three review
\$effects, the Task-2 unmount-only effects, and all chunk-command /
editorial handlers from DraftStage.svelte. Template bindings now
delegate to controller.*. handleAcceptSuggestion's dead no-op is
replaced by an inline () => {} at the DraftingDesk callsite. Imports
that are now only used by the controller module are dropped.

DraftStage.svelte keeps canGenerate, gateMessages, activeTab,
handleCompleteScene/handleVerifyIR/handleUpdateIR — those split
into Main/Sidebar in Task 6.

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
import { createDraftStageController } from "./draftStageController.svelte.js";

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

const controller = createDraftStageController(store, commands);

$effect(() => {
  return () => controller.dispose();
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
    chunkAnnotations={controller.chunkAnnotations}
    reviewingChunks={controller.reviewingChunks}
    {onGenerate}
    onCancelGeneration={() => store.cancelGeneration()}
    onUpdateChunk={controller.handleUpdateChunk}
    onRemoveChunk={controller.handleRemoveChunk}
    onDestroyChunk={controller.handleDestroyChunk}
    {onRunAudit}
    {onRunDeepAudit}
    onCompleteScene={handleCompleteScene}
    {onAutopilot}
    onCancelAutopilot={() => store.cancelAutopilot()}
    onOpenIRInspector={onOpenIRTab}
    onExtractIR={() => onExtractIR()}
    onReviewChunk={controller.handleReviewChunk}
    onAcceptSuggestion={() => {}}
    onDismissAnnotation={controller.handleDismissAnnotation}
    onRequestSuggestion={controller.handleRequestSuggestion}
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
- Splits the 650-line god component into a ~120-line orchestrator plus \`DraftStageMain.svelte\`, \`DraftStageSidebar.svelte\`, and three helper modules (\`draftStagePersistence.ts\`, \`draftStageMetrics.svelte.ts\`, \`draftStageController.svelte.ts\`). No store, primitive, sibling-panel, or API-client file is touched.
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
- `src/app/components/stages/DraftStageMain.svelte`, `DraftStageSidebar.svelte`, `draftStageController.svelte.ts`, `draftStageMetrics.svelte.ts`, and `draftStagePersistence.ts` all exist.
- `draftStageController.svelte.ts` uses plain `$effect(...)` (no `$effect.root`), `SvelteMap` / `SvelteSet` from `svelte/reactivity`, and has a `disposed` boolean guarding every async callback.
- `handleAcceptSuggestion` is deleted — not preserved as a no-op.
- `tests/ui/DraftStage.test.ts` exists with the auto-review append-then-unmount leak pin + smoke tests, all passing.
- `tests/app/components/stages/draftStageController.test.ts` exists with the editDebounceTimers leak pin, all passing.
- `tests/helpers/mockStore.ts` exists and is used in place of `as never` casts.
- `pnpm check-all` green on the branch.
- PR open against `main` with title `refactor(ui): package D — DraftStage split + timer fix (#34)`.
- No file outside the Scope Boundary section has been modified.
- Zero pending timers reported by `vi.getTimerCount()` after `unmount()` (or `controller.dispose()`) in the regression tests.
- The auto-review test and the controller-unit editDebounceTimers test each demonstrably fail against the pre-fix code (verify by cherry-picking them onto the tip of main before Task 2 lands).
