# Package E: Test Coverage Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for the 11 untested API routes and the 2 untested core stores identified in issue #36, exclusively by adding new files under `tests/**`. Every test must be exercised against the **current** (pre-Package-B) API shapes.

**Tech Stack:** TypeScript strict, Vitest, Supertest (already a dev dep — used by `tests/server/routes/projects.test.ts`), Svelte 5 runes, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies. Uses the shared `tests/helpers/apiTestApp.ts` harness and `tests/helpers/factories.ts` / `src/app/stories/factories.ts` for mock data.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

**Resolves:** #36

---

## Scope boundary (strict)

This package may **ONLY add new files under `tests/**`**. It may NOT:

- Modify any file under `server/**`
- Modify any file under `src/**`
- Modify any file under `docs/**` (except this plan)
- Modify any **existing** file under `tests/**` — including `tests/helpers/apiTestApp.ts`, `tests/helpers/factories.ts`, `tests/setup.ts`, or any existing `.test.ts`

If a route or store cannot be tested without a source-side change (for example, a function isn't exported, or `makeApiTestApp()` needs to accept an Anthropic client), the correct move is:

1. Test whatever IS reachable from outside (e.g., the no-Anthropic-client 500 branch of the route)
2. Add a **new sibling helper file** under `tests/helpers/` — adding files is allowed
3. Leave a `// TODO(#36 follow-up):` comment pointing at the uncovered branch and flag it in the PR body

Widening Package E's scope to touch source is explicitly forbidden — it would collide with Packages A/B/C/D running in parallel.

---

## Coordination with Package A (read before starting)

Package A (voice-guide repo refactor + migration 002) also touches files E's tests exercise. The collisions are silent but real:

- **Named exports preserved.** A keeps `saveVoiceGuide`, `saveVoiceGuideVersion`, `saveProjectVoiceGuide` as named exports (A adds `saveVoiceGuideAndVersion` alongside, and wraps `saveVoiceGuide` / `saveProjectVoiceGuide` in transactions). E's tests import the old names directly and must continue to work after A merges.
- **CHECK triggers on enum columns.** A's migration 002 adds CHECK triggers that enforce the TS union types. Every fixture in Package E's new tests **MUST** use values from these unions:
  - `Project.status` — values from `src/types/metadata.ts`
  - `SceneStatus` — values from `src/types/scene.ts` (`"planned" | "drafting" | "complete"`)
  - `AuditFlag.severity` — values from `src/types/quality.ts`
  - `AuditFlag.category` — canonical form uses **hyphens**, e.g. `"kill-list"` (NOT `"kill_list"`)
  - `TuningProposal.status` — `"pending" | "accepted" | "rejected"`
  - `LearnedPattern.status` — `"proposed" | "accepted" | "rejected" | "expired"`
- **Schema boot.** If A lands first, `makeApiTestApp()` will start calling `runMigrations(db)` during schema boot. E's new `apiTestAppWithAnthropic.ts` must mirror that call — see Task 1 Step 3 for the follow-up task marker.

Use `makeAuditFlag` from `src/app/stories/factories.ts` for audit fixtures instead of inline object literals — that factory already uses the canonical `"kill-list"` category and will stay in sync with future schema changes.

## Coordination with Package B (read before starting)

Package B (#29, #30) is landing in parallel and **will change** API response shapes:

- Unified envelope: `{ ok: true, data: T } | { ok: false, error: { code, message } }`
- Cursor pagination on list endpoints: `?limit&cursor` → `{ data, nextCursor }` inside the envelope

**Package E writes tests against the CURRENT shapes** (bare payloads, `{ error: "..." }`, `res.json(list)`), but routes assertions through the new `tests/helpers/unwrap.ts` helper (see Task 1 Step 4) so that when B merges, B's author only has to update `unwrap.ts` — not ~30 scattered assertions. Every route test also asserts `res.status` **independently** of the body, so the status-code contract survives the envelope change.

**Concrete pre-flight.** Task 1 Step 1 runs this bash script to detect whether B has landed and branches behavior:

```bash
git fetch origin main
if git log origin/main --oneline -- server/api/envelope.ts | head -1 | grep -q .; then
  echo "Package B has landed — use post-envelope unwrap() shape (res.body.ok === true)"
  B_LANDED=1
else
  echo "Package B has not landed — use pre-envelope bare-body shape"
  B_LANDED=0
fi
```

If B has landed, `unwrap.ts` is updated to the post-envelope form before tests are written. If not, `unwrap.ts` uses the pre-envelope pass-through form and B's author swaps it in their PR.

If B merges first, **E is NOT responsible for rebasing test assertions onto B's shapes** — per the batch design (`specs/2026-04-15-p1-parallel-batch-design.md` lines 59–70), Package B's author owns updating `unwrap.ts` in the B PR.

---

## Untested files enumerated (derived from issue #36)

### 11 API routes (all live in `server/api/routes.ts`)

| # | Method | Path | New test file |
|---|---|---|---|
| 1 | GET | `/voice-guide` | `tests/server/routes/voice-guide-get.test.ts` |
| 2 | POST | `/voice-guide/generate` | `tests/server/routes/voice-guide-generate.test.ts` |
| 3 | GET | `/voice-guide/versions` | `tests/server/routes/voice-guide-versions.test.ts` |
| 4 | GET | `/writing-samples` | `tests/server/routes/writing-samples-list.test.ts` |
| 5 | POST | `/writing-samples` | `tests/server/routes/writing-samples-create.test.ts` |
| 6 | DELETE | `/writing-samples/:id` | `tests/server/routes/writing-samples-delete.test.ts` |
| 7 | POST | `/projects/:projectId/significant-edits` | `tests/server/routes/significant-edits.test.ts` |
| 8 | POST | `/projects/:projectId/cipher/batch` | `tests/server/routes/cipher-batch.test.ts` |
| 9 | GET | `/projects/:projectId/project-voice-guide` | `tests/server/routes/project-voice-guide-get.test.ts` |
| 10 | POST | `/projects/:projectId/voice/redistill` | `tests/server/routes/voice-redistill.test.ts` |
| 11 | POST | `/projects/:projectId/project-voice-guide/update` | `tests/server/routes/project-voice-guide-update.test.ts` |

### 2 core stores

| # | Source file | New test file |
|---|---|---|
| 12 | `src/app/store/project.svelte.ts` | `tests/store/project.test.ts` |
| 13 | `src/app/store/generation.svelte.ts` | `tests/store/generation.test.ts` |

**Note on `generation.svelte.ts`:** this file imports `generateStream` and `callLLM` from `src/llm/client.js` and is built around streaming side effects. Several code paths are only reachable by mocking those LLM calls. The plan tests what can be exercised with `vi.mock("../../src/llm/client.js", ...)` from the test file (allowed — test-file-local mocks do not modify source) and flags the rest as deferred.

**Note on server modules in the issue body:** the issue also mentions `server/profile/stage3.ts`, `stage4.ts`, `llm.ts` as untested. These are pure functions and can be tested without touching source, but the issue's primary deliverable is the 11 routes + 2 stores. Server-profile module coverage is **deferred to a follow-up issue** to keep this package scoped.

---

## Task 1: Pre-flight check and test helpers

- [ ] **Step 1: Run the Package B pre-flight script**

```bash
git fetch origin main
if git log origin/main --oneline -- server/api/envelope.ts | head -1 | grep -q .; then
  echo "B_LANDED=1  # Package B has landed"
  git log origin/main --oneline -- server/api/envelope.ts | head -5
else
  echo "B_LANDED=0  # Package B has not landed"
fi
```

If `B_LANDED=1`: write `unwrap.ts` (Step 4) in its post-envelope form, record the commit SHA in the PR body under a "Coordination" heading, and add the note: `"Package B merged at <SHA>. Assertions go through unwrap() so the conversion is mechanical."`

If `B_LANDED=0`: write `unwrap.ts` in its pre-envelope pass-through form and proceed normally. B's author owns updating `unwrap.ts` when they merge.

In **both** branches, test files always call `unwrap(res)` instead of reading `res.body.*` directly, and always assert `res.status` independently.

- [ ] **Step 2: Read the shared harness and factory files once**

Read (do not modify):

- `tests/helpers/apiTestApp.ts` — `makeApiTestApp()` returns `{ app, db }` with an in-memory SQLite schema and `createApiRouter(db)` mounted at `/api`. **It does not pass an Anthropic client** — the Anthropic-dependent routes will return 500 unless a new test helper is added (see Step 3).
- `tests/helpers/factories.ts` — `makeProject`, `makeChapterArc`, `makeChunk`, `makeAuditFlag`, `makeCompilationLog` (existing server-side test factories)
- `src/app/stories/factories.ts` — client-side factories (`makeScenePlan`, `makeNarrativeIR`, etc.) used by existing store tests
- `tests/server/routes/projects.test.ts` and `tests/server/routes/bibles.test.ts` — existing route test patterns (supertest + `vi.spyOn(console, ...)` + `makeApiTestApp`)
- `tests/store/commands.test.ts` — store test pattern (direct class construction, `vi.fn()` for dependencies)

- [ ] **Step 3: Add a new helper for Anthropic-mocked route tests**

Four routes (#2, #8, #10, #11) require an Anthropic client. `tests/helpers/apiTestApp.ts` does not accept one, and modifying it is out of scope. Create a **new** sibling helper:

> **Drift note (follow-up task).** After Package A lands, update `apiTestAppWithAnthropic.ts` to match any schema-boot changes that A makes in `apiTestApp.ts`. Specifically: A adds `runMigrations(db)` to the schema boot sequence. Mirror that call here when A merges. Leave a `// TODO(#36/A follow-up):` comment at the top of the file to flag the sync point.

File: `tests/helpers/apiTestAppWithAnthropic.ts`

```ts
import Database from "better-sqlite3";
import express from "express";
import { createApiRouter } from "../../server/api/routes.js";
import { createSchema } from "../../server/db/schema.js";

/**
 * Minimal Anthropic client stub accepted by server/api/routes.ts.
 *
 * The route code only checks `anthropicClient` for truthiness before
 * delegating to server/profile/* functions. Those functions are mocked
 * at the test-file level via vi.mock(), so this object never actually
 * receives a call — it only needs to exist and be typed loosely.
 */
export function makeAnthropicStub(): unknown {
  return {
    // Shape is irrelevant; real calls are vi.mocked at the importer.
    messages: { create: async () => ({}) },
  };
}

export function makeApiTestAppWithAnthropic() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);

  const app = express();
  app.use(express.json());
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  app.use("/api", createApiRouter(db, makeAnthropicStub() as any));

  return { app, db };
}
```

- [ ] **Step 4: Add `tests/helpers/unwrap.ts`**

A ~15-line envelope-agnostic body reader. Every route test calls `unwrap(res)` instead of reading `res.body.*` directly, so Package B's envelope migration becomes a one-file change.

File: `tests/helpers/unwrap.ts`

```ts
import type { Response } from "supertest";

/**
 * Envelope-agnostic body reader for route tests.
 *
 * Pre-envelope (current `main`): returns `res.body` as-is.
 * Post-envelope (Package B landed): unwraps `{ ok, data }` and throws on
 * `{ ok: false, error }`.
 *
 * Package B's author swaps the implementation in their PR; all
 * ~30+ call sites across Package E's new tests stay unchanged.
 */
export function unwrap<T>(res: Response): T {
  if (res.body && typeof res.body === "object" && "ok" in res.body) {
    if ((res.body as { ok: boolean }).ok === true) {
      return (res.body as { data: T }).data;
    }
    const err = (res.body as { error?: { code?: string; message?: string } }).error ?? {};
    throw new Error(`API error: ${err.code ?? "UNKNOWN"}: ${err.message ?? ""}`);
  }
  return res.body as T;
}
```

Every route test in Package E uses:

```ts
const res = await request(app).get("/api/...");
expect(res.status).toBe(200);
const body = unwrap<ExpectedShape>(res);
expect(body.field).toBe(...);
```

The status assertion is independent of the body-shape assertion, so the HTTP contract survives the envelope change.

- [ ] **Step 5: Add `tests/helpers/silenceConsole.ts`**

The `vi.spyOn(console, ...)` boilerplate is duplicated across 13 files. Extract it into a one-line helper.

File: `tests/helpers/silenceConsole.ts`

```ts
import { vi } from "vitest";

/** Silence the four console methods that server route handlers touch. */
export function silenceConsole(): void {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}
```

Every `beforeEach` in Package E's new test files calls `silenceConsole()` at the top — no inline spy setup.

- [ ] **Step 6: Add `tests/helpers/serverFactories.ts`**

Replace the ~14 `as any` casts scattered through Tasks 2–11 with typed factories.

File: `tests/helpers/serverFactories.ts`

```ts
import type { VoiceGuide, WritingSample, PreferenceStatement } from "../../src/profile/types.js";
import type { SignificantEdit } from "../../src/learner/types.js"; // adjust to real path

export function makeVoiceGuide(overrides: Partial<VoiceGuide> = {}): VoiceGuide {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    ring1Injection: "Write in a literary voice.",
    // fill in required fields from VoiceGuide interface
    ...overrides,
  };
}

export function makeWritingSample(overrides: Partial<WritingSample> = {}): WritingSample {
  return {
    id: `ws-${Math.random().toString(36).slice(2, 10)}`,
    filename: "sample.md",
    domain: "fiction",
    text: "Sample prose body.",
    wordCount: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSignificantEdit(overrides: Partial<SignificantEdit> = {}): SignificantEdit {
  return {
    id: `se-${Math.random().toString(36).slice(2, 10)}`,
    projectId: "proj-test",
    chunkId: "c1",
    originalText: "before",
    editedText: "after",
    processed: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeProjectVoiceGuide(overrides: Partial<VoiceGuide> = {}): VoiceGuide {
  return makeVoiceGuide({ ring1Injection: "Project-scoped voice.", ...overrides });
}

export function makePreferenceStatement(overrides: Partial<PreferenceStatement> = {}): PreferenceStatement {
  return {
    id: `ps-${Math.random().toString(36).slice(2, 10)}`,
    projectId: "proj-test",
    statement: "Prefer concise dialogue tags.",
    editCount: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

**Implementation note:** before committing, open each referenced type file and copy the full required-field list into the factory. If any interface has fields these stubs omit, add them — the goal is `as any` elimination with real types. If a type isn't exported, add a `// TODO(#36 follow-up):` note and keep that one factory loose.

- [ ] **Step 7: Verify helpers compile**

```bash
pnpm typecheck
```

Expected: exits 0. (No tests import them yet.)

- [ ] **Step 8: Commit the helpers**

```bash
git add tests/helpers/apiTestAppWithAnthropic.ts tests/helpers/unwrap.ts tests/helpers/silenceConsole.ts tests/helpers/serverFactories.ts
git commit -m "$(cat <<'EOF'
test(helpers): add package E test scaffolding

- apiTestAppWithAnthropic: wires createApiRouter with a stub client
  so Anthropic-dependent routes can be exercised with vi.mock().
- unwrap: envelope-agnostic response body reader for Package B
  coordination. One-file swap when B merges.
- silenceConsole: one-line helper to replace ~13 copies of
  vi.spyOn(console, ...) boilerplate.
- serverFactories: typed factories to eliminate `as any` casts
  in route test fixtures.

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Shared test-file conventions

Every route test file uses this skeleton (adapt `describe` label and imports per file):

```ts
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  silenceConsole();
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});
```

**Rules for every route test:**

1. Assert `res.status` **independently** of body shape.
2. Route the body through `unwrap<T>(res)` — never read `res.body.*` directly.
3. Build fixtures via `tests/helpers/serverFactories.ts`. No `as any` casts.
4. For audit-flag fixtures, use `makeAuditFlag` from `src/app/stories/factories.ts` — it uses the canonical `"kill-list"` (hyphen) category.

---

> **Global note for Tasks 2–12.** The route-test code blocks below are reference skeletons. Every task **MUST** apply the shared conventions from the preceding section: use `silenceConsole()` from `tests/helpers/silenceConsole.ts`; route body assertions through `unwrap<T>(res)` from `tests/helpers/unwrap.ts`; assert `res.status` independently of the body; replace every `{...} as any` fixture with the corresponding factory in `tests/helpers/serverFactories.ts` (`makeVoiceGuide`, `makeWritingSample`, `makeSignificantEdit`, `makeProjectVoiceGuide`, `makePreferenceStatement`). No `as any` in fixture code. Audit-flag fixtures use `makeAuditFlag` from `src/app/stories/factories.ts` (canonical `"kill-list"` category).

## Task 2: Test `GET /voice-guide`

**File:** `tests/server/routes/voice-guide-get.test.ts`

Route reference (`server/api/routes.ts:386-392`): returns `{ guide: null }` when absent, `{ guide }` when present.

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as voiceGuideRepo from "../../../server/db/repositories/voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("GET /api/voice-guide", () => {
  it("returns { guide: null } when no voice guide exists", async () => {
    const res = await request(app).get("/api/voice-guide");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ guide: null });
  });

  it("returns { guide } when a guide exists", async () => {
    voiceGuideRepo.saveVoiceGuide(db, {
      version: 1,
      createdAt: new Date().toISOString(),
      ring1Injection: "Write in a literary voice.",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).get("/api/voice-guide");
    expect(res.status).toBe(200);
    expect(res.body.guide).not.toBeNull();
    expect(res.body.guide.ring1Injection).toBe("Write in a literary voice.");
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm test -- tests/server/routes/voice-guide-get.test.ts
```

Expected: both tests pass.

- [ ] **Step 3: `pnpm check-all`**

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add tests/server/routes/voice-guide-get.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover GET /voice-guide

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Test `POST /voice-guide/generate`

**File:** `tests/server/routes/voice-guide-generate.test.ts`

Route reference (`routes.ts:394-423`). Branches:
- 400 when `sampleIds` is missing/empty
- 404 when no samples match the IDs
- 500 when no Anthropic client is configured (exercised via plain `makeApiTestApp`)
- 500 when `runPipeline` itself throws (catch-branch coverage — `vi.mocked(runPipeline).mockRejectedValueOnce(new Error("pipeline crash"))`, assert 500 with the error envelope)
- 201 happy path (exercised via `makeApiTestAppWithAnthropic` with `vi.mock` of `server/profile/pipeline.js`)

**Apply the shared conventions (unwrap, silenceConsole, serverFactories, no `as any`).** Replace the current Step 1 test body's inline `{...} as any` writing-sample fixture with `makeWritingSample()` from `tests/helpers/serverFactories.ts`, route error-body assertions through `unwrap`, and add the 5th test:

```ts
it("returns 500 when runPipeline throws", async () => {
  vi.mocked(runPipeline).mockRejectedValueOnce(new Error("pipeline crash"));
  const { app, db } = makeApiTestAppWithAnthropic();
  writingSampleRepo.createWritingSampleRecord(db, makeWritingSample({ id: "s-throw" }));
  const res = await request(app).post("/api/voice-guide/generate").send({ sampleIds: ["s-throw"] });
  expect(res.status).toBe(500);
  // Body may be pre- or post-envelope; assert via unwrap or direct error field.
  const body = res.body as { error?: string | { message?: string } };
  const msg = typeof body.error === "string" ? body.error : body.error?.message;
  expect(msg).toContain("pipeline crash");
});
```

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";

// Mock the pipeline for the happy-path test. The mock is hoisted by Vitest
// and applies to every import of the module in this file.
vi.mock("../../../server/profile/pipeline.js", () => ({
  runPipeline: vi.fn(async () => ({
    version: 1,
    createdAt: new Date().toISOString(),
    ring1Injection: "generated injection",
    // biome-ignore lint/suspicious/noExplicitAny: stub shape
  })) as any,
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/voice-guide/generate", () => {
  it("returns 400 when sampleIds is missing", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/voice-guide/generate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sampleIds");
  });

  it("returns 400 when sampleIds is an empty array", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/voice-guide/generate").send({ sampleIds: [] });
    expect(res.status).toBe(400);
  });

  it("returns 404 when no writing samples match the supplied IDs", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: ["nonexistent-id"] });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("No writing samples");
  });

  it("returns 500 when Anthropic client is not configured", async () => {
    const { app, db } = makeApiTestApp();
    const sample = writingSampleRepo.createWritingSampleRecord(db, {
      id: "s1",
      filename: "f.md",
      domain: "fiction",
      text: "Some text.",
      wordCount: 2,
      createdAt: new Date().toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: [sample.id] });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 201 with generated guide when pipeline succeeds", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    const sample = writingSampleRepo.createWritingSampleRecord(db, {
      id: "s2",
      filename: "g.md",
      domain: "fiction",
      text: "Sample prose.",
      wordCount: 2,
      createdAt: new Date().toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: [sample.id] });
    expect(res.status).toBe(201);
    expect(res.body.ring1Injection).toBe("generated injection");
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm test -- tests/server/routes/voice-guide-generate.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: `pnpm check-all`** — Expected: green.

- [ ] **Step 4: Commit**

```bash
git add tests/server/routes/voice-guide-generate.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /voice-guide/generate

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Test `GET /voice-guide/versions`

**File:** `tests/server/routes/voice-guide-versions.test.ts`

Route reference (`routes.ts:425-427`). Returns array from `voiceGuideRepo.listVoiceGuideVersions`.

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as voiceGuideRepo from "../../../server/db/repositories/voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("GET /api/voice-guide/versions", () => {
  it("returns an empty array when no versions exist", async () => {
    const res = await request(app).get("/api/voice-guide/versions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists saved voice-guide versions", async () => {
    voiceGuideRepo.saveVoiceGuideVersion(db, {
      version: 1,
      createdAt: "2024-01-01T00:00:00Z",
      ring1Injection: "v1",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);
    voiceGuideRepo.saveVoiceGuideVersion(db, {
      version: 2,
      createdAt: "2024-02-01T00:00:00Z",
      ring1Injection: "v2",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).get("/api/voice-guide/versions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/voice-guide-versions.test.ts
pnpm check-all
git add tests/server/routes/voice-guide-versions.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover GET /voice-guide/versions

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Test `GET /writing-samples`

**File:** `tests/server/routes/writing-samples-list.test.ts`

Route reference (`routes.ts:431-433`).

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("GET /api/writing-samples", () => {
  it("returns [] when no samples exist", async () => {
    const res = await request(app).get("/api/writing-samples");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists stored writing samples", async () => {
    writingSampleRepo.createWritingSampleRecord(db, {
      id: "s1",
      filename: "a.md",
      domain: "fiction",
      text: "Hello there.",
      wordCount: 2,
      createdAt: "2024-01-01T00:00:00Z",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).get("/api/writing-samples");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("s1");
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/writing-samples-list.test.ts
pnpm check-all
git add tests/server/routes/writing-samples-list.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover GET /writing-samples

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Test `POST /writing-samples`

**File:** `tests/server/routes/writing-samples-create.test.ts`

Route reference (`routes.ts:435-441`). Delegates to `createWritingSample(filename ?? null, domain, text)` from `src/profile/types.js`, which computes `wordCount`.

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("POST /api/writing-samples", () => {
  it("creates a writing sample and returns 201 with the persisted row", async () => {
    const res = await request(app)
      .post("/api/writing-samples")
      .send({ filename: "story.md", domain: "fiction", text: "One two three four." });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.domain).toBe("fiction");
    expect(res.body.filename).toBe("story.md");
    // Known input "One two three four." → 4 words (tightened per review E-M6).
    expect(res.body.wordCount).toBe(4);

    const stored = writingSampleRepo.listWritingSamples(db);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(res.body.id);
  });

  it("accepts a missing filename (defaults to null)", async () => {
    const res = await request(app)
      .post("/api/writing-samples")
      .send({ domain: "nonfiction", text: "A body of text." });

    expect(res.status).toBe(201);
    expect(res.body.filename).toBeNull();
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/writing-samples-create.test.ts
pnpm check-all
git add tests/server/routes/writing-samples-create.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /writing-samples

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Test `DELETE /writing-samples/:id`

**File:** `tests/server/routes/writing-samples-delete.test.ts`

Route reference (`routes.ts:443-451`). Returns 204 on success, 404 when not found.

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("DELETE /api/writing-samples/:id", () => {
  it("returns 204 and removes the sample on success", async () => {
    writingSampleRepo.createWritingSampleRecord(db, {
      id: "to-delete",
      filename: "x.md",
      domain: "fiction",
      text: "x",
      wordCount: 1,
      createdAt: new Date().toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).delete("/api/writing-samples/to-delete");
    expect(res.status).toBe(204);
    // RFC 7230: 204 responses MUST have an empty body (tightened per review E-M7).
    expect(res.text).toBe("");
    expect(writingSampleRepo.getWritingSample(db, "to-delete")).toBeNull();
  });

  it("returns 404 when the sample does not exist", async () => {
    const res = await request(app).delete("/api/writing-samples/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/writing-samples-delete.test.ts
pnpm check-all
git add tests/server/routes/writing-samples-delete.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover DELETE /writing-samples/:id

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Test `POST /projects/:projectId/significant-edits`

**File:** `tests/server/routes/significant-edits.test.ts`

Route reference (`routes.ts:455-476`). Auto-creates the project via `ensureProject`, inserts the edit, returns `{ count }` (unprocessed count).

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as significantEditsRepo from "../../../server/db/repositories/significant-edits.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("POST /api/projects/:projectId/significant-edits", () => {
  it("creates an edit and returns the unprocessed count", async () => {
    const res = await request(app)
      .post("/api/projects/proj-1/significant-edits")
      .send({ chunkId: "c-1", originalText: "Before edit.", editedText: "After edit." });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(1);

    const stored = significantEditsRepo.listUnprocessedEdits(db, "proj-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.originalText).toBe("Before edit.");
    expect(stored[0]!.editedText).toBe("After edit.");
    // Tightened per review E-M8: verify full row shape.
    expect(stored[0]!.processed).toBe(false);
    expect(stored[0]!.id).toBeDefined();
  });

  it("increments the count for subsequent edits on the same project", async () => {
    await request(app)
      .post("/api/projects/proj-2/significant-edits")
      .send({ chunkId: "c-a", originalText: "o1", editedText: "e1" });
    const res = await request(app)
      .post("/api/projects/proj-2/significant-edits")
      .send({ chunkId: "c-b", originalText: "o2", editedText: "e2" });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
  });

  it("auto-creates the project row if it does not exist yet", async () => {
    const res = await request(app)
      .post("/api/projects/auto-created/significant-edits")
      .send({ chunkId: "c-x", originalText: "a", editedText: "b" });

    expect(res.status).toBe(201);
    const projectRow = db.prepare("SELECT id FROM projects WHERE id = ?").get("auto-created");
    expect(projectRow).toBeDefined();
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/significant-edits.test.ts
pnpm check-all
git add tests/server/routes/significant-edits.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /projects/:projectId/significant-edits

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Test `POST /projects/:projectId/cipher/batch`

**File:** `tests/server/routes/cipher-batch.test.ts`

Route reference (`routes.ts:478-521`). Branches:
- `{ statement: null }` when there are no unprocessed edits
- 500 when no Anthropic client
- 201 happy path (mock `inferBatchPreferences` and `distillVoice`)

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as significantEditsRepo from "../../../server/db/repositories/significant-edits.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";

// IMPORTANT: the returned statement object must match every column in the
// `preference_statements` table, because the route calls
// preferenceStatementsRepo.createPreferenceStatement(db, statement) which
// runs a real INSERT. Required columns per
// `server/db/repositories/preference-statements.ts`:
//   id, projectId, statement, editCount, createdAt
// If `editCount` is omitted, the INSERT binds `undefined` and throws,
// which would put the test on the 500 branch instead of the 201 branch.
vi.mock("../../../server/profile/cipher.js", () => ({
  CIPHER_BATCH_SIZE: 10,
  inferBatchPreferences: vi.fn(async (_client, projectId) => ({
    id: "stmt-1",
    projectId,
    statement: "Mocked preference statement.",
    editCount: 1,
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: vi.fn(async () => ({ ring1Injection: "updated" })),
  distillVoice: vi.fn(async () => "redistilled ring1 injection"),
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/projects/:projectId/cipher/batch", () => {
  it("returns { statement: null } when there are no unprocessed edits", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app).post("/api/projects/proj-empty/cipher/batch");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statement: null });
  });

  it("returns 500 when Anthropic client is not configured", async () => {
    const { app, db } = makeApiTestApp();
    significantEditsRepo.createSignificantEdit(db, {
      id: "e1",
      projectId: "proj-x",
      chunkId: "c1",
      originalText: "o",
      editedText: "e",
      processed: false,
      createdAt: new Date().toISOString(),
    });
    const res = await request(app).post("/api/projects/proj-x/cipher/batch");
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 201 with statement and marks edits processed on success", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    significantEditsRepo.createSignificantEdit(db, {
      id: "e2",
      projectId: "proj-y",
      chunkId: "c2",
      originalText: "o2",
      editedText: "e2",
      processed: false,
      createdAt: new Date().toISOString(),
    });

    const res = await request(app).post("/api/projects/proj-y/cipher/batch");
    expect(res.status).toBe(201);
    expect(res.body.statement).toBeDefined();
    expect(res.body.statement.statement).toBe("Mocked preference statement.");
    expect(res.body.ring1Injection).toBe("redistilled ring1 injection");

    // Edits marked processed
    const remaining = significantEditsRepo.listUnprocessedEdits(db, "proj-y");
    expect(remaining).toHaveLength(0);
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/cipher-batch.test.ts
pnpm check-all
git add tests/server/routes/cipher-batch.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /projects/:projectId/cipher/batch

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Test `GET /projects/:projectId/project-voice-guide`

**File:** `tests/server/routes/project-voice-guide-get.test.ts`

Route reference (`routes.ts:523-526`). Always returns `{ guide: X | null }`.

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as projectVoiceGuideRepo from "../../../server/db/repositories/project-voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("GET /api/projects/:projectId/project-voice-guide", () => {
  it("returns { guide: null } when no guide is saved for the project", async () => {
    const res = await request(app).get("/api/projects/no-guide/project-voice-guide");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ guide: null });
  });

  it("returns the saved guide when present", async () => {
    projectVoiceGuideRepo.saveProjectVoiceGuide(db, "proj-42", {
      version: 1,
      createdAt: "2024-03-01T00:00:00Z",
      ring1Injection: "project voice",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).get("/api/projects/proj-42/project-voice-guide");
    expect(res.status).toBe(200);
    expect(res.body.guide).not.toBeNull();
    expect(res.body.guide.ring1Injection).toBe("project voice");
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/project-voice-guide-get.test.ts
pnpm check-all
git add tests/server/routes/project-voice-guide-get.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover GET /projects/:projectId/project-voice-guide

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Test `POST /projects/:projectId/voice/redistill`

**File:** `tests/server/routes/voice-redistill.test.ts`

Route reference (`routes.ts:530-566`). Branches:
- 500 when no Anthropic client
- `{ ring1Injection: "", skipped: true }` when all three sources are empty
- 200 happy path (with at least one source, mocked `distillVoice`)

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as voiceGuideRepo from "../../../server/db/repositories/voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: vi.fn(),
  distillVoice: vi.fn(async () => "distilled output"),
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/projects/:projectId/voice/redistill", () => {
  it("returns 500 when Anthropic client is not configured", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/projects/p/voice/redistill");
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns { skipped: true } when there are no sources at all", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app).post("/api/projects/empty-proj/voice/redistill");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ring1Injection: "", skipped: true });
  });

  it("returns the distilled ring1Injection when a source exists", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    voiceGuideRepo.saveVoiceGuide(db, {
      version: 1,
      createdAt: new Date().toISOString(),
      ring1Injection: "existing",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any);

    const res = await request(app).post("/api/projects/proj-rd/voice/redistill");
    expect(res.status).toBe(200);
    expect(res.body.ring1Injection).toBe("distilled output");
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/voice-redistill.test.ts
pnpm check-all
git add tests/server/routes/voice-redistill.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /projects/:projectId/voice/redistill

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Test `POST /projects/:projectId/project-voice-guide/update`

**File:** `tests/server/routes/project-voice-guide-update.test.ts`

Route reference (`routes.ts:568-606`). Branches:
- 500 when no Anthropic client
- 201 happy path (mock `updateProjectVoice` and `distillVoice`)
- 500 on downstream failure (one of the mocked functions throws)

- [ ] **Step 1: Write the test**

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as projectVoiceGuideRepo from "../../../server/db/repositories/project-voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";

const updateProjectVoice = vi.fn();
const distillVoice = vi.fn();

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: (...args: unknown[]) => updateProjectVoice(...args),
  distillVoice: (...args: unknown[]) => distillVoice(...args),
}));

beforeEach(() => {
  updateProjectVoice.mockReset();
  distillVoice.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/projects/:projectId/project-voice-guide/update", () => {
  it("returns 500 when Anthropic client is not configured", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app)
      .post("/api/projects/p/project-voice-guide/update")
      .send({ sceneId: "s1", sceneText: "Text." });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 201 with updated project guide and distilled injection", async () => {
    updateProjectVoice.mockResolvedValue({ ring1Injection: "new project voice" });
    distillVoice.mockResolvedValue("final distilled");

    const { app, db } = makeApiTestAppWithAnthropic();
    const res = await request(app)
      .post("/api/projects/proj-upd/project-voice-guide/update")
      .send({ sceneId: "s1", sceneText: "Scene prose." });

    expect(res.status).toBe(201);
    expect(res.body.projectGuide.ring1Injection).toBe("new project voice");
    expect(res.body.ring1Injection).toBe("final distilled");
    expect(updateProjectVoice).toHaveBeenCalledTimes(1);
    expect(distillVoice).toHaveBeenCalledTimes(1);

    // Tightened per review E-M9: verify the DB side effect, not just the
    // mock return value. The route saves via projectVoiceGuideRepo.saveProjectVoiceGuide.
    const stored = projectVoiceGuideRepo.getProjectVoiceGuide(db, "proj-upd");
    expect(stored).not.toBeNull();
    expect(stored!.ring1Injection).toBe("new project voice");
  });

  it("returns 500 when a downstream profile call throws", async () => {
    updateProjectVoice.mockRejectedValue(new Error("profile crash"));

    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app)
      .post("/api/projects/proj-err/project-voice-guide/update")
      .send({ sceneId: "s2", sceneText: "x" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("profile crash");
  });
});
```

- [ ] **Step 2-4: Run, check-all, commit**

```bash
pnpm test -- tests/server/routes/project-voice-guide-update.test.ts
pnpm check-all
git add tests/server/routes/project-voice-guide-update.test.ts
git commit -m "$(cat <<'EOF'
test(routes): cover POST /projects/:projectId/project-voice-guide/update

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Test `src/app/store/project.svelte.ts`

**File:** `tests/store/project.test.ts`

The issue notes this store is 442 lines and is currently only tested indirectly through `commands.test.ts`. Add a direct unit test over its **full public surface**. Per review E-C3, the plan must cover every public method and getter enumerated from the real source file, not a sampled subset.

**`ProjectStore` public surface (enumerated from `src/app/store/project.svelte.ts`):**

*State fields (directly assignable via setters below).*

*Derived getters:* `activeScene`, `activeScenePlan`, `activeSceneChunks`, `previousSceneLastChunk`, `activeSceneIR`, `previousSceneIRs`, `isExtractingIR`.

*Methods:* `setProject`, `setBible`, `setBibleVersions`, `setVoiceGuide`, `setProjectVoiceGuide`, `setChapterArc`, `setScenes`, `setActiveScene`, `updateSceneStatus`, `setSceneChunks`, `setConfig`, `setModels`, `addChunk`, `updateChunk`, `updateChunkForScene`, `removeChunk`, `removeChunkForScene`, `setCompiled`, `setAudit`, `resolveAuditFlag`, `dismissAuditFlag`, `setGenerating`, `cancelGeneration`, `setAuditing`, `setReviewingChunks`, `setAutopilot`, `cancelAutopilot`, `setExtractingIR`, `setBootstrapOpen`, `setBibleAuthoringOpen`, `setSceneAuthoringOpen`, `addMultipleScenePlans`, `setSceneIR`, `verifySceneIR`, `setEditorialAnnotations`, `getEditorialAnnotations`, `clearEditorialAnnotations`, `setIRInspectorOpen`, `setError`, `selectChunk`, `completeScene`, `setScenePlan`, `addScenePlan`, `loadFromServer`, `resetForProjectSwitch`, `selectModel`. (`loadFile`/`saveFile` require a DOM and are explicitly skipped — leave a `// TODO(#36 follow-up):` note.)

**Important:** `ProjectStore`'s constructor unconditionally calls `fetchModels()` from `src/llm/client.js`. The test file **MUST** mock that import at the top, or every `beforeEach` throws `TypeError: fetchModels is not a function` (review E-C2).

Write at least one test per method (happy path) plus 1–2 edge cases where applicable. For setters that are pure assignments, one happy-path test is fine. Reference `tests/store/commands.test.ts` for the direct-construction pattern.

Since this file uses Svelte 5 runes, reference `tests/store/commands.test.ts` for the existing pattern: construct `new ProjectStore()` directly and assert on its fields. The runes compile to plain reactive state that works inside `describe` blocks.

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// CRITICAL (review E-C2): ProjectStore's constructor calls fetchModels()
// from src/llm/client.js. Without this mock, every `new ProjectStore()`
// call crashes with `TypeError: fetchModels is not a function`.
vi.mock("../../src/llm/client.js", () => ({
  fetchModels: vi.fn().mockResolvedValue([]),
  generateStream: vi.fn(),
  callLLM: vi.fn(),
}));

import { ProjectStore } from "../../src/app/store/project.svelte.js";
import {
  makeAuditFlag,
  makeChunk,
  makeNarrativeIR,
  makeScenePlan,
} from "../../src/app/stories/factories.js";
import { createDefaultCompilationConfig, createEmptyBible } from "../../src/types/index.js";

describe("ProjectStore", () => {
  let store: ProjectStore;

  beforeEach(() => {
    store = new ProjectStore();
  });

  describe("setProject", () => {
    it("stores the project", () => {
      store.setProject({ id: "p1", title: "X", status: "drafting", createdAt: "", updatedAt: "" });
      expect(store.project?.id).toBe("p1");
    });

    it("accepts null to clear", () => {
      store.setProject({ id: "p1", title: "X", status: "drafting", createdAt: "", updatedAt: "" });
      store.setProject(null);
      expect(store.project).toBeNull();
    });
  });

  describe("setBible / setChapterArc / setVoiceGuide", () => {
    it("round-trips bible", () => {
      const bible = createEmptyBible("p1");
      store.setBible(bible);
      expect(store.bible).toEqual(bible);
    });
  });

  describe("scenes and active scene", () => {
    it("exposes the active scene plan via the getter", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting" }]);
      store.setActiveScene(0);
      expect(store.activeScenePlan?.id).toBe("s1");
    });

    it("returns null for activeScene when no scenes exist", () => {
      expect(store.activeScene).toBeNull();
      expect(store.activeScenePlan).toBeNull();
    });

    it("addMultipleScenePlans appends entries", () => {
      store.addMultipleScenePlans([makeScenePlan(), makeScenePlan()]);
      expect(store.scenes).toHaveLength(2);
    });

    it("updateSceneStatus mutates the matching scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting" }]);
      store.updateSceneStatus("s1", "complete");
      expect(store.scenes[0]!.status).toBe("complete");
    });
  });

  describe("scene chunks", () => {
    it("setSceneChunks replaces the per-scene chunk list", () => {
      const c1 = makeChunk({ sceneId: "s1", sequenceNumber: 0 });
      store.setSceneChunks("s1", [c1]);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });

    it("addChunk appends to the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting" }]);
      store.setActiveScene(0);
      store.addChunk(makeChunk({ sceneId: "s1", sequenceNumber: 0 }));
      expect(store.activeSceneChunks).toHaveLength(1);
    });

    it("updateChunkForScene mutates the chunk at the given index", () => {
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.updateChunkForScene("s1", 0, { status: "accepted" });
      expect(store.sceneChunks.s1![0]!.status).toBe("accepted");
    });

    it("removeChunkForScene drops the chunk at the given index", () => {
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0 }),
        makeChunk({ sceneId: "s1", sequenceNumber: 1 }),
      ]);
      store.removeChunkForScene("s1", 0);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });
  });

  describe("previousSceneLastChunk", () => {
    it("returns null when active scene is the first", () => {
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting" }]);
      store.setActiveScene(0);
      expect(store.previousSceneLastChunk).toBeNull();
    });

    it("returns the last chunk of the prior scene when index > 0", () => {
      const prev = makeChunk({ sceneId: "s0", sequenceNumber: 1, generatedText: "prev text" });
      store.setScenes([
        { plan: makeScenePlan({ id: "s0" }), status: "complete" },
        { plan: makeScenePlan({ id: "s1" }), status: "drafting" },
      ]);
      store.setSceneChunks("s0", [makeChunk({ sceneId: "s0", sequenceNumber: 0 }), prev]);
      store.setActiveScene(1);
      expect(store.previousSceneLastChunk?.generatedText).toBe("prev text");
    });
  });

  describe("scene IRs", () => {
    it("setSceneIR stores the IR", () => {
      const ir = makeNarrativeIR();
      store.setSceneIR("s1", ir);
      expect(store.sceneIRs.s1).toEqual(ir);
    });

    it("verifySceneIR marks the stored IR as verified", () => {
      store.setSceneIR("s1", makeNarrativeIR({ verified: false }));
      store.verifySceneIR("s1");
      expect(store.sceneIRs.s1!.verified).toBe(true);
    });

    it("previousSceneIRs returns IRs from scenes before the active one", () => {
      store.setScenes([
        { plan: makeScenePlan({ id: "s0" }), status: "complete" },
        { plan: makeScenePlan({ id: "s1" }), status: "drafting" },
      ]);
      store.setSceneIR("s0", makeNarrativeIR());
      store.setActiveScene(1);
      expect(store.previousSceneIRs).toHaveLength(1);
    });
  });

  describe("audit flags", () => {
    it("setAudit replaces flags and metrics", () => {
      store.setAudit([], null);
      expect(store.auditFlags).toEqual([]);
      expect(store.metrics).toBeNull();
    });

    // Review E-C1: use makeAuditFlag factory — it already uses the canonical
    // hyphen form `category: "kill-list"` (NOT `"kill_list"`).
    it("resolveAuditFlag sets resolved and wasActionable on the matching flag", () => {
      store.setAudit([makeAuditFlag({ id: "f1", sceneId: "s1" })], null);
      store.resolveAuditFlag("f1", "fixed", true);
      expect(store.auditFlags[0]!.resolved).toBe(true);
      expect(store.auditFlags[0]!.resolvedAction).toBe("fixed");
      expect(store.auditFlags[0]!.wasActionable).toBe(true);
    });

    it("dismissAuditFlag marks the flag resolved and non-actionable", () => {
      store.setAudit([makeAuditFlag({ id: "f1", sceneId: "s1" })], null);
      store.dismissAuditFlag("f1");
      expect(store.auditFlags[0]!.resolved).toBe(true);
      expect(store.auditFlags[0]!.wasActionable).toBe(false);
    });
  });

  describe("error and selection", () => {
    it("setError stores the error message", () => {
      store.setError("boom");
      expect(store.error).toBe("boom");
      store.setError(null);
      expect(store.error).toBeNull();
    });

    it("selectChunk stores the selected index", () => {
      store.selectChunk(3);
      expect(store.selectedChunkIndex).toBe(3);
      store.selectChunk(null);
      expect(store.selectedChunkIndex).toBeNull();
    });
  });

  // ─── Added per review E-C3: missing public-API coverage ────────

  describe("loadFromServer", () => {
    it("populates project, bible, scenes, chunks, IRs, versions, voice guides", () => {
      const plan = makeScenePlan({ id: "s1" });
      const chunk = makeChunk({ sceneId: "s1", sequenceNumber: 0 });
      const ir = makeNarrativeIR();
      store.loadFromServer({
        project: { id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" },
        bible: createEmptyBible("p1"),
        chapterArc: null,
        scenes: [{ plan, status: "drafting", sceneOrder: 0 }],
        sceneChunks: { s1: [chunk] },
        sceneIRs: { s1: ir },
        bibleVersions: [{ version: 1, createdAt: "2024-01-01T00:00:00Z" }],
        voiceGuide: null,
        projectVoiceGuide: null,
      });
      expect(store.project?.id).toBe("p1");
      expect(store.scenes).toHaveLength(1);
      expect(store.sceneChunks.s1).toHaveLength(1);
      expect(store.sceneIRs.s1).toEqual(ir);
      expect(store.bibleVersions).toHaveLength(1);
      expect(store.error).toBeNull();
    });

    it("defaults projectVoiceGuide to null when omitted", () => {
      store.loadFromServer({
        project: { id: "p", title: "", status: "drafting", createdAt: "", updatedAt: "" },
        bible: null,
        chapterArc: null,
        scenes: [],
        sceneChunks: {},
        sceneIRs: {},
        bibleVersions: [],
        voiceGuide: null,
      });
      expect(store.projectVoiceGuide).toBeNull();
    });
  });

  describe("resetForProjectSwitch", () => {
    it("clears all project-scoped state back to defaults", () => {
      store.setProject({ id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" });
      store.setBible(createEmptyBible("p1"));
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.setError("boom");
      store.resetForProjectSwitch();
      expect(store.project).toBeNull();
      expect(store.bible).toBeNull();
      expect(store.scenes).toEqual([]);
      expect(store.sceneChunks).toEqual({});
      expect(store.sceneIRs).toEqual({});
      expect(store.auditFlags).toEqual([]);
      expect(store.error).toBeNull();
      expect(store.isGenerating).toBe(false);
      expect(store.isAutopilot).toBe(false);
    });
  });

  describe("addScenePlan and setScenePlan", () => {
    it("addScenePlan appends a new plan and makes it active", () => {
      store.addScenePlan(makeScenePlan({ id: "s1" }));
      store.addScenePlan(makeScenePlan({ id: "s2" }));
      expect(store.scenes).toHaveLength(2);
      expect(store.activeSceneIndex).toBe(1);
    });

    it("addScenePlan replaces a scene with the same id in place", () => {
      const first = makeScenePlan({ id: "s1", title: "first" });
      const replacement = makeScenePlan({ id: "s1", title: "replaced" });
      store.addScenePlan(first);
      store.addScenePlan(replacement);
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.title).toBe("replaced");
    });

    it("setScenePlan(null) clears scenes", () => {
      store.setScenePlan(makeScenePlan({ id: "s1" }));
      store.setScenePlan(null);
      expect(store.scenes).toEqual([]);
      expect(store.activeSceneIndex).toBe(0);
    });

    it("setScenePlan(plan) replaces scenes with a single entry", () => {
      store.setScenePlan(makeScenePlan({ id: "s1" }));
      expect(store.scenes).toHaveLength(1);
      expect(store.scenes[0]!.plan.id).toBe("s1");
    });
  });

  describe("completeScene", () => {
    it("marks the matching scene as complete", () => {
      store.setScenes([
        { plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 },
        { plan: makeScenePlan({ id: "s2" }), status: "drafting", sceneOrder: 1 },
      ]);
      store.completeScene("s1");
      expect(store.scenes[0]!.status).toBe("complete");
      expect(store.scenes[1]!.status).toBe("drafting");
    });
  });

  describe("setBibleVersions / setEditorialAnnotations / setExtractingIR", () => {
    it("setBibleVersions stores version list", () => {
      store.setBibleVersions([{ version: 1, createdAt: "2024-01-01" }]);
      expect(store.bibleVersions).toHaveLength(1);
    });

    it("setEditorialAnnotations and getEditorialAnnotations round-trip", () => {
      store.setEditorialAnnotations("s1", 0, [
        // biome-ignore lint/suspicious/noExplicitAny: minimal annotation shape
        { id: "a1", chunkIndex: 0, comment: "nice" } as any,
      ]);
      const anns = store.getEditorialAnnotations("s1");
      expect(anns.get(0)).toHaveLength(1);
    });

    it("clearEditorialAnnotations removes the scene's annotations", () => {
      // biome-ignore lint/suspicious/noExplicitAny: annotation shape
      store.setEditorialAnnotations("s1", 0, [{ id: "a1" } as any]);
      store.clearEditorialAnnotations("s1");
      expect(store.getEditorialAnnotations("s1").size).toBe(0);
    });

    it("setExtractingIR updates extractingIRSceneId and isExtractingIR derives correctly", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.isExtractingIR).toBe(false);
      store.setExtractingIR("s1");
      expect(store.extractingIRSceneId).toBe("s1");
      expect(store.isExtractingIR).toBe(true);
      store.setExtractingIR(null);
      expect(store.isExtractingIR).toBe(false);
    });
  });

  describe("activeSceneIR", () => {
    it("returns null when no IR is stored for the active scene", () => {
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      expect(store.activeSceneIR).toBeNull();
    });

    it("returns the stored IR for the active scene", () => {
      const ir = makeNarrativeIR();
      store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneIR("s1", ir);
      expect(store.activeSceneIR).toEqual(ir);
    });
  });

  describe("cancelGeneration / cancelAutopilot / setGenerating / setAutopilot", () => {
    it("setGenerating(true) creates an AbortController; (false) clears it", () => {
      store.setGenerating(true);
      expect(store.isGenerating).toBe(true);
      expect(store.generationAbortController).not.toBeNull();
      store.setGenerating(false);
      expect(store.generationAbortController).toBeNull();
    });

    it("cancelGeneration aborts the in-flight controller without flipping isGenerating", () => {
      store.setGenerating(true);
      const ctrl = store.generationAbortController!;
      store.cancelGeneration();
      expect(ctrl.signal.aborted).toBe(true);
      // isGenerating stays true — the finally block in generateChunk clears it.
      expect(store.isGenerating).toBe(true);
    });

    it("setAutopilot(true) resets autopilotCancelled", () => {
      store.autopilotCancelled = true;
      store.setAutopilot(true);
      expect(store.isAutopilot).toBe(true);
      expect(store.autopilotCancelled).toBe(false);
    });

    it("cancelAutopilot sets autopilotCancelled, clears isAutopilot, aborts stream", () => {
      store.setAutopilot(true);
      store.setGenerating(true);
      const ctrl = store.generationAbortController!;
      store.cancelAutopilot();
      expect(store.autopilotCancelled).toBe(true);
      expect(store.isAutopilot).toBe(false);
      expect(ctrl.signal.aborted).toBe(true);
    });
  });

  describe("selectModel", () => {
    it("no-ops when model id is not in availableModels", () => {
      const before = store.compilationConfig.defaultModel;
      store.selectModel("nonexistent");
      expect(store.compilationConfig.defaultModel).toBe(before);
    });

    it("updates defaultModel, modelContextWindow, and reservedForOutput when spec is found", () => {
      store.setModels([
        // biome-ignore lint/suspicious/noExplicitAny: test-local model spec
        { id: "m1", contextWindow: 200_000, maxOutput: 4096 } as any,
      ]);
      store.selectModel("m1");
      expect(store.compilationConfig.defaultModel).toBe("m1");
      expect(store.compilationConfig.modelContextWindow).toBe(200_000);
      expect(store.compilationConfig.reservedForOutput).toBeLessThanOrEqual(4096);
    });
  });

  describe("setCompiled", () => {
    it("stores compiled payload, log, and lint together", () => {
      // biome-ignore lint/suspicious/noExplicitAny: partial fixtures for this store-level test
      store.setCompiled({ systemMessage: "s", userMessage: "u" } as any, { steps: [] } as any, { issues: [] } as any);
      expect(store.compiledPayload).not.toBeNull();
      expect(store.compilationLog).not.toBeNull();
      expect(store.lintResult).not.toBeNull();
    });
  });

  describe("setConfig and setModels", () => {
    it("setConfig replaces the compilation config", () => {
      const cfg = createDefaultCompilationConfig();
      store.setConfig(cfg);
      expect(store.compilationConfig).toEqual(cfg);
    });

    it("setModels replaces the models list", () => {
      // biome-ignore lint/suspicious/noExplicitAny: minimal spec
      store.setModels([{ id: "m1", contextWindow: 100, maxOutput: 50 } as any]);
      expect(store.availableModels).toHaveLength(1);
    });
  });

  describe("voice guide setters", () => {
    it("setVoiceGuide / setProjectVoiceGuide store and clear", () => {
      // biome-ignore lint/suspicious/noExplicitAny: minimal guide
      const g = { version: 1, createdAt: "", ring1Injection: "x" } as any;
      store.setVoiceGuide(g);
      expect(store.voiceGuide).toEqual(g);
      store.setVoiceGuide(null);
      expect(store.voiceGuide).toBeNull();
      store.setProjectVoiceGuide(g);
      expect(store.projectVoiceGuide).toEqual(g);
    });
  });

  describe("setChapterArc", () => {
    it("stores and clears the chapter arc", () => {
      // biome-ignore lint/suspicious/noExplicitAny: minimal arc
      const arc = { id: "a1", title: "Ch1" } as any;
      store.setChapterArc(arc);
      expect(store.chapterArc).toEqual(arc);
      store.setChapterArc(null);
      expect(store.chapterArc).toBeNull();
    });
  });

  describe("updateChunk / removeChunk (active-scene wrappers)", () => {
    it("updateChunk delegates to updateChunkForScene for the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      store.updateChunk(0, { status: "accepted" });
      expect(store.sceneChunks.s1![0]!.status).toBe("accepted");
    });

    it("updateChunk is a no-op when no scene is active", () => {
      store.updateChunk(0, { status: "accepted" });
      expect(store.sceneChunks).toEqual({});
    });

    it("removeChunk delegates to removeChunkForScene for the active scene", () => {
      const plan = makeScenePlan({ id: "s1" });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0 }),
        makeChunk({ sceneId: "s1", sequenceNumber: 1 }),
      ]);
      store.removeChunk(0);
      expect(store.sceneChunks.s1).toHaveLength(1);
    });
  });

  describe("UI state setters", () => {
    it("setBootstrapOpen / setBibleAuthoringOpen / setSceneAuthoringOpen / setIRInspectorOpen", () => {
      store.setBootstrapOpen(true);
      store.setBibleAuthoringOpen(true);
      store.setSceneAuthoringOpen(true);
      store.setIRInspectorOpen(true);
      expect(store.bootstrapModalOpen).toBe(true);
      expect(store.bibleAuthoringOpen).toBe(true);
      expect(store.sceneAuthoringOpen).toBe(true);
      expect(store.irInspectorOpen).toBe(true);
    });

    it("setAuditing / setReviewingChunks", () => {
      store.setAuditing(true);
      expect(store.isAuditing).toBe(true);
      store.setReviewingChunks(new Set([1, 2]));
      expect(store.reviewingChunks.size).toBe(2);
    });
  });

  // loadFile / saveFile require a real DOM and are skipped here.
  // TODO(#36 follow-up): exercise them in a jsdom-specific spec.
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm test -- tests/store/project.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: `pnpm check-all`** — Expected: green.

- [ ] **Step 4: Commit**

```bash
git add tests/store/project.test.ts
git commit -m "$(cat <<'EOF'
test(store): direct unit tests for ProjectStore

Covers setProject/setBible/setScenes/addChunk/updateChunkForScene/
removeChunkForScene/setSceneIR/verifySceneIR/setAudit/resolveAuditFlag/
dismissAuditFlag/setError/selectChunk plus the activeScenePlan,
previousSceneLastChunk, and previousSceneIRs derived getters.

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Test `src/app/store/generation.svelte.ts`

**File:** `tests/store/generation.test.ts`

`createGenerationActions(store, commands)` returns an object with **exactly six** methods, unambiguously visible at the bottom of `src/app/store/generation.svelte.ts`:

```ts
return { generateChunk, runAuditManual, runDeepAudit, extractSceneIR, runAutopilot, requestRefinement };
```

Per review E-C4, **no `if (typeof x === "function")` conditional guards.** All six exist; test them directly.

Per review E-C2, `ProjectStore`'s constructor calls `fetchModels()`, so the test file's `vi.mock("../../src/llm/client.js", ...)` block **MUST** stub `fetchModels` in addition to `generateStream` and `callLLM`.

### Required coverage (per method)

- **`generateChunk`**
  - Error branch: `generateStream` invokes `onError("llm failure")` → `store.error` contains `"Generation failed"`, `commands.saveChunk` not called, pending chunk removed.
  - Empty-text branch: `onDone({}, "max_tokens")` with no tokens → `store.error` contains `"Empty generation"`, pending chunk removed, no persist/audit.
  - Abort branch: abort signal fires (`store.cancelGeneration()`) → pending chunk removed, `store.error` stays null for abort errors.
  - Happy path: stream emits tokens then `onDone({}, "end_turn")` → `commands.saveChunk` called once, `commands.saveAuditFlags` called once, chunk `generatedText` matches concatenated tokens.

- **`runAuditManual`**
  - Missing bible: `store.setBible(null)` → `store.error` contains `"missing bible"`, no `commands.saveAuditFlags` call.
  - Missing chunks: scene exists but `sceneChunks[sceneId]` empty → `store.error` contains `"no chunks"`.
  - Happy path: `runAudit` mock returns `{ flags: [], metrics: null }` → `store.auditFlags` updated, `commands.saveAuditFlags` invoked with the flags.

- **`runDeepAudit`**
  - Missing bible, missing chunks, happy path — same structure as `runAuditManual`, plus assert `store.isAuditing` toggles true → false across the call and that both `runAudit` and `checkSubtext` fire.

- **`extractSceneIR`**
  - Missing plan: `store.setScenes([])` → `store.error` contains `"no active scene plan"`, `callLLM` NOT invoked.
  - Missing chunks: scene exists, chunks empty → `store.error` contains `"no chunks"`.
  - Empty-prose: chunks exist but `generatedText` is whitespace → `store.error` contains `"all chunks are empty"`.
  - Happy path: chunks with real prose → `callLLM` invoked via `extractIR`, `commands.saveSceneIR` called with the returned IR, `reconcileSetupsAfterIR` triggers `commands.saveBible` when the mocked reconciler returns a change. Assert `store.setIRInspectorOpen(true)` took effect.

- **`runAutopilot`** — this is the method recent PR #68 regressed; coverage is load-bearing.
  - Missing scene: `store.setScenes([])` → `store.error` contains `"missing scene plan"`.
  - `autopilotCancelled` short-circuit: set `store.autopilotCancelled = true` before invoking → zero `generateStream` calls.
  - **Guardrail cap.** Set `compilationConfig.autopilotMaxChunks = 2` and `plan.chunkCount = 5`. Drive `generateStream` to accept each call. Assert only 2 chunks were generated this run AND `commands.completeScene` was **NOT** called (because `willCompleteScene === false`). This is exactly the regression PR #68 fixed.
  - `willCompleteScene=false` → `finalizeAutopilot` skipped (follows from the cap case above; assert both `commands.completeScene` and `commands.saveSceneIR` were NOT called).
  - Happy path: `plan.chunkCount = 2`, cap = 20 → two iterations, `commands.completeScene` called, `extractSceneIR` path fires (assert `commands.saveSceneIR`).

- **`requestRefinement`**
  - Missing bible: → returns `null`, `store.error` contains `"missing bible"`.
  - No chunks for scene: → returns `null`, `store.error` contains `"no chunks"`.
  - Zero-variants parse error: mock `callLLM` returns raw that `parseRefinementResponse` produces `variants=[]` — either mock the refine module or feed unparseable JSON — assert returned value is `null`, `store.error` contains "no usable variants" or the parse-error message.
  - Happy path: mock `callLLM` returns JSON that parses to ≥1 variant → returns `{ variants, requestedAt, completedAt }`.

- [ ] **Step 1: Write the test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the LLM client module BEFORE importing anything that imports it.
// CRITICAL (review E-C2): fetchModels MUST be stubbed too — ProjectStore's
// constructor calls it unconditionally.
const generateStream = vi.fn();
const callLLM = vi.fn();
const fetchModels = vi.fn().mockResolvedValue([]);
vi.mock("../../src/llm/client.js", () => ({
  fetchModels: (...args: unknown[]) => fetchModels(...args),
  generateStream: (...args: unknown[]) => generateStream(...args),
  callLLM: (...args: unknown[]) => callLLM(...args),
}));

// Mock the auditor so we don't need a real bible.
vi.mock("../../src/auditor/index.js", () => ({
  runAudit: vi.fn(() => ({ flags: [], metrics: null })),
}));
vi.mock("../../src/auditor/setupReconciler.js", () => ({
  reconcileSetupStatuses: vi.fn((flags: unknown) => flags),
}));
vi.mock("../../src/auditor/subtext.js", () => ({
  checkSubtext: vi.fn(() => []),
}));

import { createGenerationActions } from "../../src/app/store/generation.svelte.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { makeScenePlan } from "../../src/app/stories/factories.js";
import { createEmptyBible } from "../../src/types/index.js";

function makeCommands() {
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
    deleteChunk: vi.fn().mockResolvedValue({ ok: true }),
    completeScene: vi.fn().mockResolvedValue({ ok: true }),
    saveSceneIR: vi.fn().mockResolvedValue({ ok: true }),
    verifySceneIR: vi.fn().mockResolvedValue({ ok: true }),
    saveAuditFlags: vi.fn().mockResolvedValue({ ok: true }),
    resolveAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    dismissAuditFlag: vi.fn().mockResolvedValue({ ok: true }),
    saveCompilationLog: vi.fn().mockResolvedValue({ ok: true }),
    applyRefinement: vi.fn().mockResolvedValue({ ok: true }),
    // biome-ignore lint/suspicious/noExplicitAny: test seam
  } as any;
}

function makeStoreWithScene(): ProjectStore {
  const store = new ProjectStore();
  store.setProject({ id: "p1", title: "t", status: "drafting", createdAt: "", updatedAt: "" });
  store.setBible(createEmptyBible("p1"));
  store.setScenes([{ plan: makeScenePlan({ id: "s1" }), status: "drafting" }]);
  store.setActiveScene(0);
  // Minimal compiled payload so generation can read model/temperature/topP.
  store.setCompiled(
    {
      systemMessage: "sys",
      userMessage: "user",
      model: "claude-test",
      temperature: 0.8,
      topP: 0.92,
      maxTokens: 1000,
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any,
    null,
    null,
  );
  return store;
}

describe("createGenerationActions", () => {
  beforeEach(() => {
    generateStream.mockReset();
    callLLM.mockReset();
    fetchModels.mockClear();
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── generateChunk ───────────────────────────────────

  describe("generateChunk", () => {
    it("sets store.error and removes pending chunk when onError fires", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(
        async (_p: unknown, h: { onError: (e: string) => void }) => h.onError("llm failure"),
      );
      await actions.generateChunk();
      expect(store.error).toContain("Generation failed");
      expect(commands.saveChunk).not.toHaveBeenCalled();
      expect(store.activeSceneChunks).toHaveLength(0);
    });

    it("treats onDone with empty text and stop reason max_tokens as an error", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(
        async (_p: unknown, h: { onDone: (u: unknown, r: string) => void }) => h.onDone({}, "max_tokens"),
      );
      await actions.generateChunk();
      expect(store.error).toContain("Empty generation");
      expect(commands.saveChunk).not.toHaveBeenCalled();
      expect(store.activeSceneChunks).toHaveLength(0);
    });

    it("persists the chunk and runs audit on happy-path onDone", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(
        async (
          _p: unknown,
          h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void },
        ) => {
          h.onToken("Hello ");
          h.onToken("world.");
          h.onDone({}, "end_turn");
        },
      );
      await actions.generateChunk();
      expect(commands.saveChunk).toHaveBeenCalledTimes(1);
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.activeSceneChunks[0]!.generatedText).toBe("Hello world.");
      expect(store.error).toBeNull();
    });

    it("removes pending chunk on AbortError and does not set error", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      const actions = createGenerationActions(store, commands);
      generateStream.mockImplementation(async () => {
        throw new DOMException("aborted", "AbortError");
      });
      await actions.generateChunk();
      expect(store.activeSceneChunks).toHaveLength(0);
      expect(store.error).toBeNull();
      expect(commands.saveChunk).not.toHaveBeenCalled();
    });
  });

  // ─── runAuditManual ──────────────────────────────────

  describe("runAuditManual", () => {
    it("sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(store.error).toContain("missing bible");
      expect(commands.saveAuditFlags).not.toHaveBeenCalled();
    });

    it("sets error when the active scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(store.error).toContain("no chunks");
      expect(commands.saveAuditFlags).not.toHaveBeenCalled();
    });

    it("runs audit and persists flags on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAuditManual();
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.auditFlags).toEqual([]);
    });
  });

  // ─── runDeepAudit ────────────────────────────────────

  describe("runDeepAudit", () => {
    it("sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(store.error).toContain("missing bible");
    });

    it("sets error when the active scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(store.error).toContain("no chunks");
    });

    it("toggles isAuditing and persists combined flags on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).runDeepAudit();
      expect(commands.saveAuditFlags).toHaveBeenCalledTimes(1);
      expect(store.isAuditing).toBe(false);
    });
  });

  // ─── extractSceneIR ──────────────────────────────────

  describe("extractSceneIR", () => {
    it("sets error when no active scene plan", async () => {
      const store = new ProjectStore();
      store.setBible(createEmptyBible("p1"));
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("no active scene plan");
      expect(callLLM).not.toHaveBeenCalled();
    });

    it("sets error when there are no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("no chunks");
    });

    it("sets error when all chunks are empty prose", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "   " })]);
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(store.error).toContain("all chunks are empty");
    });

    it("happy path: saves IR, reconciles setups, opens inspector", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [
        makeChunk({ sceneId: "s1", sequenceNumber: 0, generatedText: "Real prose here." }),
      ]);
      // extractIR under the hood delegates to callLLM — return a minimal IR-shaped JSON.
      callLLM.mockResolvedValue(JSON.stringify({
        sceneId: "s1",
        characterStates: [],
        setups: [],
        payoffs: [],
        verified: false,
      }));
      const commands = makeCommands();
      await createGenerationActions(store, commands).extractSceneIR();
      expect(callLLM).toHaveBeenCalled();
      expect(commands.saveSceneIR).toHaveBeenCalledTimes(1);
      expect(store.irInspectorOpen).toBe(true);
    });
  });

  // ─── runAutopilot ────────────────────────────────────

  describe("runAutopilot", () => {
    it("sets error when no active scene plan / payload / bible", async () => {
      const store = new ProjectStore();
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();
      expect(store.error).toContain("missing scene plan");
    });

    it("short-circuits when autopilotCancelled is already true", async () => {
      const store = makeStoreWithScene();
      store.autopilotCancelled = true;
      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();
      expect(generateStream).not.toHaveBeenCalled();
      expect(commands.completeScene).not.toHaveBeenCalled();
    });

    // REGRESSION GUARD for PR #68.
    // Scene wants 5 chunks, cap is 2 → generate exactly 2 and do NOT finalize.
    it("honors autopilotMaxChunks cap and skips finalize when willCompleteScene=false", async () => {
      const store = makeStoreWithScene();
      const plan = makeScenePlan({ id: "s1", chunkCount: 5 });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.compilationConfig = { ...store.compilationConfig, autopilotMaxChunks: 2 };

      generateStream.mockImplementation(
        async (
          _p: unknown,
          h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void },
        ) => {
          h.onToken("chunk body");
          h.onDone({}, "end_turn");
        },
      );

      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();

      // Exactly 2 chunks created this run.
      expect(store.sceneChunks.s1).toHaveLength(2);
      // Cap hit → finalize skipped.
      expect(commands.completeScene).not.toHaveBeenCalled();
      expect(commands.saveSceneIR).not.toHaveBeenCalled();
      expect(store.isAutopilot).toBe(false);
    });

    it("finalizes (completeScene + IR extraction) when run fulfills scene target", async () => {
      const store = makeStoreWithScene();
      const plan = makeScenePlan({ id: "s1", chunkCount: 2 });
      store.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
      store.setActiveScene(0);
      store.compilationConfig = { ...store.compilationConfig, autopilotMaxChunks: 20 };

      generateStream.mockImplementation(
        async (
          _p: unknown,
          h: { onToken: (t: string) => void; onDone: (u: unknown, r: string) => void },
        ) => {
          h.onToken("body");
          h.onDone({}, "end_turn");
        },
      );
      callLLM.mockResolvedValue(JSON.stringify({
        sceneId: "s1",
        characterStates: [],
        setups: [],
        payoffs: [],
        verified: false,
      }));

      const commands = makeCommands();
      await createGenerationActions(store, commands).runAutopilot();

      expect(store.sceneChunks.s1).toHaveLength(2);
      expect(commands.completeScene).toHaveBeenCalledTimes(1);
      expect(commands.saveSceneIR).toHaveBeenCalledTimes(1);
    });
  });

  // ─── requestRefinement ───────────────────────────────

  describe("requestRefinement", () => {
    const baseReq = {
      sceneId: "s1",
      chunkIndex: 0,
      selection: { start: 0, end: 5, text: "Hello" },
      instruction: "tighten",
    };

    it("returns null and sets error when bible is missing", async () => {
      const store = makeStoreWithScene();
      store.setBible(null);
      const commands = makeCommands();
      // biome-ignore lint/suspicious/noExplicitAny: minimal request shape
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq as any);
      expect(res).toBeNull();
      expect(store.error).toContain("missing bible");
    });

    it("returns null when the scene has no chunks", async () => {
      const store = makeStoreWithScene();
      const commands = makeCommands();
      // biome-ignore lint/suspicious/noExplicitAny: minimal request shape
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq as any);
      expect(res).toBeNull();
      expect(store.error).toContain("no chunks");
    });

    it("returns null and surfaces parse error when variants are empty", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      callLLM.mockResolvedValue("not json at all");
      const commands = makeCommands();
      // biome-ignore lint/suspicious/noExplicitAny: minimal request shape
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq as any);
      expect(res).toBeNull();
      expect(store.error).not.toBeNull();
    });

    it("returns a RefinementResult on happy path", async () => {
      const store = makeStoreWithScene();
      store.setSceneChunks("s1", [makeChunk({ sceneId: "s1", sequenceNumber: 0 })]);
      callLLM.mockResolvedValue(
        JSON.stringify({
          variants: [
            { id: "v1", text: "Refined text.", rationale: "tighter" },
          ],
        }),
      );
      const commands = makeCommands();
      // biome-ignore lint/suspicious/noExplicitAny: minimal request shape
      const res = await createGenerationActions(store, commands).requestRefinement(baseReq as any);
      expect(res).not.toBeNull();
      expect(res!.variants.length).toBeGreaterThan(0);
      expect(res!.requestedAt).toBeDefined();
      expect(res!.completedAt).toBeDefined();
    });
  });
});
```

**Note on refinement parsing:** the happy-path and parse-error tests depend on `parseRefinementResponse`'s real behavior. If the shape above doesn't produce a non-empty `variants` array with the real parser (check `src/review/refine.ts` before writing the test), adjust the mocked JSON or mock `../../src/review/refine.js` at the top of the file to stub `parseRefinementResponse` directly. **Do NOT revert to `if (typeof fn === "function")` guards** — use concrete mocks instead.

- [ ] **Step 2: Run the test**

```bash
pnpm test -- tests/store/generation.test.ts
```

Expected: all tests in the six `describe` blocks pass (one per method of `createGenerationActions`). No conditional guards.

- [ ] **Step 3: `pnpm check-all`** — Expected: green.

- [ ] **Step 4: Commit**

```bash
git add tests/store/generation.test.ts
git commit -m "$(cat <<'EOF'
test(store): cover all six createGenerationActions methods

Covers generateChunk (error/empty/abort/happy), runAuditManual,
runDeepAudit, extractSceneIR, runAutopilot (including the PR #68
guardrail cap regression case), and requestRefinement — all
branches enumerated in the plan, no conditional guards.

LLM client imports are stubbed via vi.mock (fetchModels,
generateStream, callLLM) at the top of the test file so
ProjectStore's constructor doesn't touch the network.

Part of #36.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "test: package E — coverage for untested routes and stores (#36)" --body "$(cat <<'EOF'
## Summary
- Adds 11 new route test files covering the untested Anthropic-dependent and CRUD routes in \`server/api/routes.ts\` (voice-guide x3, writing-samples x3, significant-edits, cipher/batch, project-voice-guide x2, voice/redistill).
- Adds 2 new store test files covering \`project.svelte.ts\` (direct unit tests) and \`generation.svelte.ts\` (factory + error branches).
- Adds \`tests/helpers/apiTestAppWithAnthropic.ts\` — a new sibling harness that wires \`createApiRouter\` with a stub Anthropic client, so mocked-profile happy paths can be exercised without modifying the existing \`apiTestApp\` helper.
- **No source edits.** Everything lands under \`tests/**\` as new files.

## Scope notes
- Written against **current** API shapes. Package B (#29, #30) will change envelopes; per the [parallel batch design](../blob/main/docs/superpowers/specs/2026-04-15-p1-parallel-batch-design.md#L59-L70), the B author owns updating these assertions in the B PR.
- \`server/profile/stage3.ts\`, \`stage4.ts\`, \`llm.ts\` mentioned in #36 are **deferred** — they are pure modules best covered in a separate follow-up, and keeping this PR focused on routes + stores avoids scope creep.
- Full streaming-path coverage for \`generation.svelte.ts\` is deferred; the current tests cover the factory and the reachable error branches without requiring source-side dependency injection.

## Test plan
- [ ] \`pnpm check-all\` green
- [ ] 11 new route test files all pass
- [ ] 2 new store test files pass
- [ ] No existing tests are modified

Resolves #36.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done criteria

- 13 new test files exist (11 routes + 2 stores) plus 4 new helper files (`apiTestAppWithAnthropic.ts`, `unwrap.ts`, `silenceConsole.ts`, `serverFactories.ts`)
- No file under `server/**`, `src/**`, `docs/**` (except this plan), or any existing file under `tests/**` has been modified
- `pnpm check-all` green on the branch
- PR open against `main` with title `test: package E — coverage for untested routes and stores (#36)`
- Pre-flight check for Package B recorded in the PR body
- Deferred gaps (server/profile modules, generation.svelte.ts streaming paths) explicitly noted in the PR body
