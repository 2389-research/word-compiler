# Sprint A: Persistence Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all store mutations to the existing REST API so data survives page reloads.

**Architecture:** Server-first with fire-and-forget for streaming tokens. The API client (`src/api/client.ts`) and backend (40+ endpoints under `/api/data`) already exist. We create an "actions" layer that calls API → updates store from response. Components call actions instead of store methods for data mutations. UI-only state (modal open/closed, tab selection) stays as direct store calls.

**Tech Stack:** Svelte 5 (`$state`), existing `src/api/client.ts` fetch functions, Vitest for tests.

**Key Design Decisions:**
- **API-first for mutations**: Since SQLite is local (~1ms), calling API before updating store is imperceptible. Store updates from server response to stay in sync.
- **Exceptions**: (1) Streaming tokens update store directly, persist chunk on completion. (2) Text edits (editedText) debounce API calls at 500ms.
- **No new dependencies**: Uses existing `src/api/client.ts` functions directly — no new ApiClient interface needed.

---

### Task 1: Create the api-actions module

**Files:**
- Create: `src/app/store/api-actions.ts`
- Test: `tests/store/api-actions.test.ts`

**Step 1: Write the test file**

The tests mock every `src/api/client.ts` function and verify that each action calls the right API function then updates the store.

```typescript
// tests/store/api-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { createApiActions } from "../../src/app/store/api-actions.js";
import { createEmptyBible, createEmptyScenePlan, generateId } from "../../src/types/index.js";
import { makeChunk, makeChapterArc, makeAuditFlag, makeNarrativeIR } from "../../src/app/stories/factories.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

describe("createApiActions", () => {
  let store: ProjectStore;
  let actions: ReturnType<typeof createApiActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
    store.setProject({ id: "proj-1", title: "Test", status: "drafting", createdAt: "", updatedAt: "" });
    actions = createApiActions(store);
  });

  describe("saveBible", () => {
    it("calls API then updates store", async () => {
      const bible = createEmptyBible("proj-1");
      const saved = { ...bible, version: 2 };
      mockedApi.apiSaveBible.mockResolvedValue(saved);

      await actions.saveBible(bible);

      expect(mockedApi.apiSaveBible).toHaveBeenCalledWith(bible);
      expect(store.bible).toEqual(saved);
    });

    it("sets store error on failure", async () => {
      mockedApi.apiSaveBible.mockRejectedValue(new Error("DB error"));

      await actions.saveBible(createEmptyBible("proj-1"));

      expect(store.error).toBe("DB error");
    });
  });

  describe("saveScenePlan", () => {
    it("calls API then adds to store", async () => {
      const plan = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockResolvedValue(plan);

      await actions.saveScenePlan(plan, 0);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledWith(plan, 0);
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0].plan.id).toBe(plan.id);
    });
  });

  describe("saveMultipleScenePlans", () => {
    it("calls API for each plan then bulk-adds to store", async () => {
      const plan1 = createEmptyScenePlan("proj-1");
      const plan2 = createEmptyScenePlan("proj-1");
      mockedApi.apiSaveScenePlan.mockImplementation(async (p) => p);

      await actions.saveMultipleScenePlans([plan1, plan2]);

      expect(mockedApi.apiSaveScenePlan).toHaveBeenCalledTimes(2);
      expect(store.scenes).toHaveLength(2);
    });
  });

  describe("saveChapterArc", () => {
    it("calls API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiSaveChapterArc.mockResolvedValue(arc);

      await actions.saveChapterArc(arc);

      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("updateChapterArc", () => {
    it("calls update API then updates store", async () => {
      const arc = makeChapterArc();
      mockedApi.apiUpdateChapterArc.mockResolvedValue(arc);

      await actions.updateChapterArc(arc);

      expect(mockedApi.apiUpdateChapterArc).toHaveBeenCalledWith(arc);
      expect(store.chapterArc).toEqual(arc);
    });
  });

  describe("saveChunk", () => {
    it("calls API to persist chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiSaveChunk.mockResolvedValue(chunk);

      await actions.saveChunk(chunk);

      expect(mockedApi.apiSaveChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("updateChunk", () => {
    it("calls API to update chunk", async () => {
      const chunk = makeChunk();
      mockedApi.apiUpdateChunk.mockResolvedValue(chunk);

      await actions.updateChunk(chunk);

      expect(mockedApi.apiUpdateChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe("completeScene", () => {
    it("calls API then updates store status", async () => {
      const plan = createEmptyScenePlan("proj-1");
      store.addScenePlan(plan);
      mockedApi.apiUpdateSceneStatus.mockResolvedValue(undefined);

      await actions.completeScene(plan.id);

      expect(mockedApi.apiUpdateSceneStatus).toHaveBeenCalledWith(plan.id, "complete");
      expect(store.scenes[0].status).toBe("complete");
    });
  });

  describe("saveSceneIR", () => {
    it("calls create API for new IR then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      mockedApi.apiCreateSceneIR.mockResolvedValue(ir);

      await actions.saveSceneIR("scene-1", ir);

      expect(mockedApi.apiCreateSceneIR).toHaveBeenCalledWith("scene-1", ir);
      expect(store.sceneIRs["scene-1"]).toEqual(ir);
    });
  });

  describe("verifySceneIR", () => {
    it("calls verify API then updates store", async () => {
      const ir = makeNarrativeIR({ sceneId: "scene-1" });
      store.setSceneIR("scene-1", ir);
      mockedApi.apiVerifySceneIR.mockResolvedValue(undefined);

      await actions.verifySceneIR("scene-1");

      expect(mockedApi.apiVerifySceneIR).toHaveBeenCalledWith("scene-1");
      expect(store.sceneIRs["scene-1"].verified).toBe(true);
    });
  });

  describe("saveAuditFlags", () => {
    it("calls API to persist flags", async () => {
      const flags = [makeAuditFlag()];
      mockedApi.apiSaveAuditFlags.mockResolvedValue(flags);

      await actions.saveAuditFlags(flags);

      expect(mockedApi.apiSaveAuditFlags).toHaveBeenCalledWith(flags);
    });
  });

  describe("resolveAuditFlag", () => {
    it("calls API then updates store", async () => {
      const flag = makeAuditFlag({ id: "flag-1" });
      store.setAudit([flag], null);
      mockedApi.apiResolveAuditFlag.mockResolvedValue(undefined);

      await actions.resolveAuditFlag("flag-1", "fixed it", true);

      expect(mockedApi.apiResolveAuditFlag).toHaveBeenCalledWith("flag-1", "fixed it", true);
      expect(store.auditFlags[0].resolved).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store/api-actions.test.ts`
Expected: FAIL — module `api-actions.js` not found

**Step 3: Write the api-actions module**

```typescript
// src/app/store/api-actions.ts
import * as api from "../../api/client.js";
import type {
  AuditFlag,
  Bible,
  ChapterArc,
  Chunk,
  CompilationLog,
  NarrativeIR,
  ScenePlan,
} from "../../types/index.js";
import type { ProjectStore } from "./project.svelte.js";

export function createApiActions(store: ProjectStore) {
  function handleError(err: unknown) {
    store.setError(err instanceof Error ? err.message : String(err));
  }

  async function saveBible(bible: Bible): Promise<void> {
    try {
      const saved = await api.apiSaveBible(bible);
      store.setBible(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveScenePlan(plan: ScenePlan, sceneOrder: number): Promise<void> {
    try {
      const saved = await api.apiSaveScenePlan(plan, sceneOrder);
      store.addScenePlan(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveMultipleScenePlans(plans: ScenePlan[]): Promise<void> {
    try {
      const saved = await Promise.all(
        plans.map((plan, i) => api.apiSaveScenePlan(plan, store.scenes.length + i)),
      );
      store.addMultipleScenePlans(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveChapterArc(arc: ChapterArc): Promise<void> {
    try {
      const saved = await api.apiSaveChapterArc(arc);
      store.setChapterArc(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function updateChapterArc(arc: ChapterArc): Promise<void> {
    try {
      const saved = await api.apiUpdateChapterArc(arc);
      store.setChapterArc(saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveChunk(chunk: Chunk): Promise<void> {
    try {
      await api.apiSaveChunk(chunk);
    } catch (err) {
      handleError(err);
    }
  }

  async function updateChunk(chunk: Chunk): Promise<void> {
    try {
      await api.apiUpdateChunk(chunk);
    } catch (err) {
      handleError(err);
    }
  }

  async function completeScene(sceneId: string): Promise<void> {
    try {
      await api.apiUpdateSceneStatus(sceneId, "complete");
      store.completeScene(sceneId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveSceneIR(sceneId: string, ir: NarrativeIR): Promise<void> {
    try {
      const saved = await api.apiCreateSceneIR(sceneId, ir);
      store.setSceneIR(sceneId, saved);
    } catch (err) {
      handleError(err);
    }
  }

  async function verifySceneIR(sceneId: string): Promise<void> {
    try {
      await api.apiVerifySceneIR(sceneId);
      store.verifySceneIR(sceneId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveAuditFlags(flags: AuditFlag[]): Promise<void> {
    try {
      await api.apiSaveAuditFlags(flags);
    } catch (err) {
      handleError(err);
    }
  }

  async function resolveAuditFlag(flagId: string, action: string, wasActionable: boolean): Promise<void> {
    try {
      await api.apiResolveAuditFlag(flagId, action, wasActionable);
      store.resolveAuditFlag(flagId, action, wasActionable);
    } catch (err) {
      handleError(err);
    }
  }

  async function dismissAuditFlag(flagId: string): Promise<void> {
    try {
      await api.apiResolveAuditFlag(flagId, "", false);
      store.dismissAuditFlag(flagId);
    } catch (err) {
      handleError(err);
    }
  }

  async function saveCompilationLog(log: CompilationLog): Promise<void> {
    try {
      await api.apiSaveCompilationLog(log);
    } catch (err) {
      handleError(err);
    }
  }

  return {
    saveBible,
    saveScenePlan,
    saveMultipleScenePlans,
    saveChapterArc,
    updateChapterArc,
    saveChunk,
    updateChunk,
    completeScene,
    saveSceneIR,
    verifySceneIR,
    saveAuditFlags,
    resolveAuditFlag,
    dismissAuditFlag,
    saveCompilationLog,
  };
}

export type ApiActions = ReturnType<typeof createApiActions>;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store/api-actions.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/app/store/api-actions.ts tests/store/api-actions.test.ts
git commit -m "feat: add api-actions module for persisted store mutations"
```

---

### Task 2: Create the startup flow

**Files:**
- Create: `src/app/store/startup.ts`
- Test: `tests/store/startup.test.ts`

**Step 1: Write the test file**

```typescript
// tests/store/startup.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { initializeApp } from "../../src/app/store/startup.js";
import { createEmptyBible, createEmptyScenePlan, generateId } from "../../src/types/index.js";
import { makeChunk, makeChapterArc } from "../../src/app/stories/factories.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

describe("initializeApp", () => {
  let store: ProjectStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
  });

  it("loads single project with all data", async () => {
    const project = { id: "proj-1", title: "Novel", status: "drafting" as const, createdAt: "", updatedAt: "" };
    const bible = createEmptyBible("proj-1");
    const arc = makeChapterArc({ id: "ch-1", projectId: "proj-1" });
    const plan = createEmptyScenePlan("proj-1");
    plan.chapterId = "ch-1";
    const chunk = makeChunk({ sceneId: plan.id });

    mockedApi.apiListProjects.mockResolvedValue([project]);
    mockedApi.apiGetLatestBible.mockResolvedValue(bible);
    mockedApi.apiListBibleVersions.mockResolvedValue([{ version: 1, createdAt: "" }]);
    mockedApi.apiListChapterArcs.mockResolvedValue([arc]);
    mockedApi.apiListScenePlans.mockResolvedValue([{ plan, status: "drafting" as const, sceneOrder: 0 }]);
    mockedApi.apiListChunks.mockResolvedValue([chunk]);

    const result = await initializeApp(store);

    expect(result).toBe("loaded");
    expect(store.project).toEqual(project);
    expect(store.bible).toEqual(bible);
    expect(store.chapterArc).toEqual(arc);
    expect(store.scenes).toHaveLength(1);
    expect(store.sceneChunks[plan.id]).toHaveLength(1);
  });

  it("returns 'no-projects' when project list is empty", async () => {
    mockedApi.apiListProjects.mockResolvedValue([]);

    const result = await initializeApp(store);

    expect(result).toBe("no-projects");
    expect(store.project).toBeNull();
  });

  it("returns 'multiple-projects' when more than one project", async () => {
    const p1 = { id: "proj-1", title: "A", status: "drafting" as const, createdAt: "", updatedAt: "" };
    const p2 = { id: "proj-2", title: "B", status: "drafting" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue([p1, p2]);

    const result = await initializeApp(store);

    expect(result).toBe("multiple-projects");
  });

  it("handles missing bible gracefully", async () => {
    const project = { id: "proj-1", title: "Novel", status: "bootstrap" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue([project]);
    mockedApi.apiGetLatestBible.mockRejectedValue(new Error("No bible found"));
    mockedApi.apiListBibleVersions.mockResolvedValue([]);
    mockedApi.apiListChapterArcs.mockResolvedValue([]);

    const result = await initializeApp(store);

    expect(result).toBe("loaded");
    expect(store.project).toEqual(project);
    expect(store.bible).toBeNull();
  });

  it("sets error on unexpected failure", async () => {
    mockedApi.apiListProjects.mockRejectedValue(new Error("Network down"));

    const result = await initializeApp(store);

    expect(result).toBe("error");
    expect(store.error).toBe("Network down");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store/startup.test.ts`
Expected: FAIL — module `startup.js` not found

**Step 3: Write the startup module**

```typescript
// src/app/store/startup.ts
import * as api from "../../api/client.js";
import type { Chunk, SceneStatus } from "../../types/index.js";
import type { SceneEntry } from "./project.svelte.js";
import type { ProjectStore } from "./project.svelte.js";

export type StartupResult = "loaded" | "no-projects" | "multiple-projects" | "error";

export async function initializeApp(store: ProjectStore): Promise<StartupResult> {
  try {
    const projects = await api.apiListProjects();

    if (projects.length === 0) return "no-projects";
    if (projects.length > 1) return "multiple-projects";

    const project = projects[0];
    return loadProject(store, project.id);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
    return "error";
  }
}

export async function loadProject(store: ProjectStore, projectId: string): Promise<StartupResult> {
  try {
    const project = await api.apiGetProject(projectId);

    // Fetch bible (may not exist yet)
    let bible = null;
    try {
      bible = await api.apiGetLatestBible(projectId);
    } catch {
      // No bible yet — that's fine
    }

    const bibleVersions = await api.apiListBibleVersions(projectId);
    const chapters = await api.apiListChapterArcs(projectId);
    const chapterArc = chapters.length > 0 ? chapters[0] : null;

    // Fetch scenes for the chapter (if one exists)
    let scenes: SceneEntry[] = [];
    if (chapterArc) {
      const sceneRows = await api.apiListScenePlans(chapterArc.id);
      scenes = sceneRows.map((row) => ({
        plan: row.plan,
        status: row.status as SceneStatus,
        sceneOrder: row.sceneOrder,
      }));
    }

    // Fetch chunks for each scene
    const sceneChunks: Record<string, Chunk[]> = {};
    for (const scene of scenes) {
      sceneChunks[scene.plan.id] = await api.apiListChunks(scene.plan.id);
    }

    store.loadFromServer({
      project,
      bible,
      chapterArc,
      scenes,
      sceneChunks,
      bibleVersions,
    });

    return "loaded";
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
    return "error";
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store/startup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/store/startup.ts tests/store/startup.test.ts
git commit -m "feat: add app startup flow with project loading"
```

---

### Task 3: Export actions from store barrel and wire App.svelte startup

**Files:**
- Modify: `src/app/store/index.svelte.ts`
- Modify: `src/app/App.svelte`

**Step 1: Update the store barrel export**

Add to `src/app/store/index.svelte.ts`:
```typescript
export { createApiActions, type ApiActions } from "./api-actions.js";
export { initializeApp } from "./startup.js";
```

**Step 2: Wire App.svelte to initialize on mount**

In `App.svelte`'s `<script>` block, add after the existing imports:

```typescript
import { createApiActions, initializeApp } from "./store/index.svelte.js";
import { onMount } from "svelte";

const actions = createApiActions(store);

let appReady = $state(false);
let startupStatus = $state<string>("loading");

onMount(async () => {
  const result = await initializeApp(store);
  startupStatus = result;
  appReady = result === "loaded" || result === "no-projects";
});
```

Replace the direct store calls in handler functions with action calls:

```typescript
// BEFORE:
function handleCompleteScene() {
  if (store.activeScenePlan) {
    store.completeScene(store.activeScenePlan.id);
  }
}
// AFTER:
async function handleCompleteScene() {
  if (store.activeScenePlan) {
    await actions.completeScene(store.activeScenePlan.id);
  }
}

// BEFORE:
function handleResolveFlag(flagId: string, action: string) {
  store.resolveAuditFlag(flagId, action, true);
}
// AFTER:
async function handleResolveFlag(flagId: string, action: string) {
  await actions.resolveAuditFlag(flagId, action, true);
}

// BEFORE:
function handleDismissFlag(flagId: string) {
  store.dismissAuditFlag(flagId);
}
// AFTER:
async function handleDismissFlag(flagId: string) {
  await actions.dismissAuditFlag(flagId);
}

// BEFORE:
function handleVerifyIR() {
  if (store.activeScenePlan) {
    store.verifySceneIR(store.activeScenePlan.id);
  }
}
// AFTER:
async function handleVerifyIR() {
  if (store.activeScenePlan) {
    await actions.verifySceneIR(store.activeScenePlan.id);
  }
}

// BEFORE:
function handleUpdateIR(ir: ...) {
  if (store.activeScenePlan) {
    store.setSceneIR(store.activeScenePlan.id, ir);
  }
}
// AFTER:
async function handleUpdateIR(ir: ...) {
  if (store.activeScenePlan) {
    await actions.saveSceneIR(store.activeScenePlan.id, ir);
  }
}
```

Add a loading state wrapper in the template:

```svelte
{#if !appReady}
  <div class="app loading-screen">
    <span class="app-title">Word Compiler</span>
    {#if startupStatus === "loading"}
      <p>Loading project...</p>
    {:else if startupStatus === "error"}
      <ErrorBanner message={store.error ?? "Failed to load"} onDismiss={() => store.setError(null)} />
    {:else if startupStatus === "multiple-projects"}
      <p>Multiple projects found. Project list coming in Phase 3.</p>
    {/if}
  </div>
{:else}
  <!-- existing app content -->
{/if}
```

Pass `actions` to child components that need it (via prop or context — prop is simpler).

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All 505+ tests pass. (Existing UI tests use mock stores and don't hit real API.)

**Step 4: Commit**

```bash
git add src/app/store/index.svelte.ts src/app/App.svelte
git commit -m "feat: wire startup flow and persisted handlers in App"
```

---

### Task 4: Wire BootstrapModal and BibleAuthoringModal

**Files:**
- Modify: `src/app/components/BootstrapModal.svelte`
- Modify: `src/app/components/BibleAuthoringModal.svelte`

**Step 1: Read current files to understand exact call sites**

Read `BootstrapModal.svelte` and `BibleAuthoringModal.svelte`.

**Step 2: Add `actions` prop and replace store.setBible calls**

In `BootstrapModal.svelte`, find where `store.setBible(bible)` is called (line ~73). Change to:
```typescript
// Add prop
let { store, actions }: { store: ProjectStore; actions: ApiActions } = $props();

// Replace:
store.setBible(bible);
// With:
await actions.saveBible(bible);
```

In `BibleAuthoringModal.svelte`, find `store.setBible()` calls (lines ~123, ~167). Change both to `await actions.saveBible()`.

**Step 3: Update App.svelte to pass actions prop**

```svelte
<BootstrapModal {store} {actions} />
<BibleAuthoringModal {store} {actions} />
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (existing tests mock the store; the new `actions` prop is optional in tests since components are tested with mock stores)

Note: If tests fail because the new `actions` prop is required, add a default no-op actions object to the test setup.

**Step 5: Commit**

```bash
git add src/app/components/BootstrapModal.svelte src/app/components/BibleAuthoringModal.svelte src/app/App.svelte
git commit -m "feat: wire BootstrapModal and BibleAuthoringModal to persist"
```

---

### Task 5: Wire BiblePane, SceneAuthoringModal, ChapterArcEditor

**Files:**
- Modify: `src/app/components/BiblePane.svelte`
- Modify: `src/app/components/SceneAuthoringModal.svelte`
- Modify: `src/app/components/ChapterArcEditor.svelte`

**Step 1: Read current files**

Read each file to find the exact store mutation call sites.

**Step 2: Add `actions` prop and replace calls**

`BiblePane.svelte` — calls `store.setBible()`, `store.addScenePlan()`, `store.setChapterArc()` in its load-from-file handlers. Replace with:
```typescript
await actions.saveBible(parsed);
await actions.saveScenePlan(parsed, 0);
await actions.saveChapterArc(parsed);
```

`SceneAuthoringModal.svelte` — calls `store.addMultipleScenePlans()`, `store.setChapterArc()`, `store.addScenePlan()`. Replace with:
```typescript
await actions.saveMultipleScenePlans(plans);
await actions.saveChapterArc(generatedArc);
await actions.saveScenePlan(formPlan, store.scenes.length);
```

`ChapterArcEditor.svelte` — calls `store.setChapterArc()`. Replace with:
```typescript
await actions.updateChapterArc({ ...arc, ...changes });
```

**Step 3: Update App.svelte to pass actions to these components**

```svelte
<BiblePane {store} {actions} onBootstrap=... onAuthor=... />
<SceneAuthoringModal {store} {actions} />
{#if showArcEditor && store.chapterArc}
  <ChapterArcEditor arc={store.chapterArc} {store} {actions} onClose=... />
{/if}
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/components/BiblePane.svelte src/app/components/SceneAuthoringModal.svelte src/app/components/ChapterArcEditor.svelte src/app/App.svelte
git commit -m "feat: wire BiblePane, SceneAuthoringModal, ChapterArcEditor to persist"
```

---

### Task 6: Wire generation actions to persist chunks, audit, and IR

**Files:**
- Modify: `src/app/store/generation.svelte.ts`

**Step 1: Read the current generation file** (already read above — `src/app/store/generation.svelte.ts`)

**Step 2: Add ApiActions parameter and persist after operations**

Change the function signature:
```typescript
export function createGenerationActions(store: ProjectStore, actions: ApiActions) {
```

In `generateChunk()`, after the stream completes and audit runs:
```typescript
// After: store.updateChunk(chunkIndex, { generatedText: fullText });
// Add: persist the finalized chunk
const finalChunk = store.activeSceneChunks[chunkIndex];
if (finalChunk) await actions.saveChunk(finalChunk);

// After: store.setAudit(flags, metrics);
// Add: persist audit flags
await actions.saveAuditFlags(flags);
```

In `extractSceneIR()`, after IR is extracted:
```typescript
// Replace: store.setSceneIR(plan.id, ir);
// With:
await actions.saveSceneIR(plan.id, ir);
```

**Step 3: Update App.svelte to pass actions to createGenerationActions**

```typescript
const { generateChunk, runAuditManual, extractSceneIR } = createGenerationActions(store, actions);
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (generation tests mock the LLM client, not the store actions)

**Step 5: Commit**

```bash
git add src/app/store/generation.svelte.ts src/app/App.svelte
git commit -m "feat: persist chunks, audit flags, and IR after generation"
```

---

### Task 7: Add debounced text edit persistence

**Files:**
- Modify: `src/app/App.svelte`

**Step 1: Add a debounce utility**

In `App.svelte`'s script section, add:

```typescript
let editDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleUpdateChunk(index: number, changes: Partial<Chunk>) {
  store.updateChunk(index, changes);

  // Debounce API persistence for text edits
  if (changes.editedText !== undefined || changes.humanNotes !== undefined) {
    if (editDebounceTimer) clearTimeout(editDebounceTimer);
    editDebounceTimer = setTimeout(async () => {
      const chunk = store.activeSceneChunks[index];
      if (chunk) await actions.updateChunk(chunk);
    }, 500);
  } else {
    // Non-text changes persist immediately
    const chunk = store.activeSceneChunks[index];
    if (chunk) actions.updateChunk(chunk);
  }
}
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/App.svelte
git commit -m "feat: debounce text edit persistence (500ms)"
```

---

### Task 8: Create project on first run

**Files:**
- Modify: `src/app/App.svelte`

**Step 1: Add project creation flow for "no-projects" state**

When `startupStatus === "no-projects"`, show a "Create Project" button:

```svelte
{:else if startupStatus === "no-projects"}
  <div class="create-project">
    <p>Welcome to Word Compiler. Create your first project to get started.</p>
    <Button onclick={createFirstProject}>Create Project</Button>
  </div>
```

Add the handler:
```typescript
async function createFirstProject() {
  try {
    const project = await apiClient.apiCreateProject({
      id: generateId(),
      title: "Untitled Novel",
      status: "bootstrap",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.setProject(project);
    appReady = true;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to create project");
  }
}
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/App.svelte
git commit -m "feat: create project on first launch"
```

---

### Task 9: Run full test suite and verify

**Step 1: Run vitest**

Run: `npx vitest run`
Expected: All tests pass (505+ existing + new api-actions + startup tests)

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npx biome check src tests`
Expected: No errors

**Step 4: Run E2E tests (if dev server is available)**

Run: `npx playwright test`
Expected: All 25 E2E tests pass (they mock the API layer, so persistence changes shouldn't affect them)

---

## Summary of Changes

| File | Action | What |
|------|--------|------|
| `src/app/store/api-actions.ts` | Create | All persisted action functions |
| `src/app/store/startup.ts` | Create | App initialization + project loading |
| `tests/store/api-actions.test.ts` | Create | Tests for api-actions |
| `tests/store/startup.test.ts` | Create | Tests for startup flow |
| `src/app/store/index.svelte.ts` | Modify | Export new modules |
| `src/app/App.svelte` | Modify | Startup flow, persisted handlers, debounce, create project |
| `src/app/components/BootstrapModal.svelte` | Modify | Accept `actions` prop, use `actions.saveBible` |
| `src/app/components/BibleAuthoringModal.svelte` | Modify | Accept `actions` prop, use `actions.saveBible` |
| `src/app/components/BiblePane.svelte` | Modify | Accept `actions` prop, persist all loads |
| `src/app/components/SceneAuthoringModal.svelte` | Modify | Accept `actions` prop, persist plans/arcs |
| `src/app/components/ChapterArcEditor.svelte` | Modify | Accept `actions` prop, persist arc updates |
| `src/app/store/generation.svelte.ts` | Modify | Accept actions, persist chunks/flags/IR |
