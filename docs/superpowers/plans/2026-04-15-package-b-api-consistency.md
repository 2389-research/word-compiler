# Package B: API Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every HTTP response from `/api/data/**` behind a single envelope (`{ ok: true, data }` / `{ ok: false, error: { code, message } }`), normalize the client wrapper to unwrap that envelope and throw a typed `ApiError`, and add cursor-based pagination to every list endpoint. The client and server change together in one PR so the contract never drifts.

**Architecture:**
- **Server:** a tiny `server/api/envelope.ts` module owns the canonical `ok()` / `err()` helpers. Every route handler in `server/api/routes.ts` is rewritten to return values through those helpers. A sibling `server/api/pagination.ts` module owns opaque cursor encoding/decoding and `limit` clamping; every list endpoint calls it and returns `{ ok: true, data, nextCursor }`.
- **Client:** `src/api/client.ts`'s `fetchJson` unwraps the envelope. On `ok: false` it throws a new `ApiError` class carrying `code`, `message`, and HTTP `status`. On `ok: true` list responses, it returns the full `{ data, nextCursor }` object; for scalar responses it returns `.data`. Existing call-sites gain `{ limit?, cursor? }` options where they hit list endpoints.
- **Envelope shape (locked):**
  ```ts
  type ApiResponse<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

  type ApiListResponse<T> = { ok: true; data: T[]; nextCursor: string | null };
  ```
- **Cursor format:** opaque base64url of `JSON.stringify({ id: lastId })`. SQLite repositories already return rows in a stable insertion order (`rowid` / `created_at, id`). The cursor decodes to the last `id` of the previous page; the repository adds `WHERE id > ?` (or `WHERE (created_at, id) > (?, ?)` where a repo sorts by `created_at`) — but for this package we only need `id`-based pagination because every list endpoint's underlying repository currently returns arrays in stable id/rowid order. Package A (DB hardening) will revisit indexes; B does not touch repositories.

  Since the scope boundary forbids touching `server/db/**`, the pagination wrapper slices at the route layer. This is acceptable given current data sizes (local SQLite, single user, small projects) and is explicitly documented as a temporary measure; issue #30 will be closed by B, and a follow-up p2 issue will track moving the slice into the repositories.
- **Error codes:** a small enum of stable string codes — `NOT_FOUND`, `BAD_REQUEST`, `VALIDATION_FAILED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL` — so the client can branch on a stable identifier instead of status codes alone.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), Express 4, Vitest, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies. Uses the F1 logger (`createLogger` from `server/lib/logger.ts`) for any NEW log lines only.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md). Closes #29 and #30.

---

## Scope boundary

This package may only modify / create files under:

- `server/api/**` — including the existing `server/api/routes.ts` and two new files `server/api/envelope.ts`, `server/api/pagination.ts`.
- `src/api/**` — including the existing `src/api/client.ts` and a new `src/api/errors.ts`.
- `tests/server/routes/**` — update existing assertions to the new envelope; add new pagination cases.
- `tests/api/**` — update `tests/api/client.test.ts` to assert envelope handling and `ApiError` behavior.

It may NOT modify:
- `server/db/**` (Package A's territory)
- `server/proxy.ts` (framework wiring, out of scope)
- `server/middleware.ts`
- `src/app/**` (UI consumers; any compile errors from signature changes are fixed here ONLY by updating the client module itself, not its call sites — all current call sites receive plain arrays today and will keep receiving plain arrays after B, because the client wrapper unwraps `.data` for them. Pagination is opt-in.)
- any other `tests/**` subdirectory.

**If a client call-site breaks because a signature change is unavoidable, STOP and escalate.** B's contract is: existing UI callers keep working unchanged.

---

## Coordination with Package E (READ THIS FIRST)

Package E (`#36`, test coverage gaps) is running in parallel on its own worktree and is writing NEW tests under `tests/**` against the **pre-B** API envelope (bare arrays, `{ error }` objects). When B merges, E's new tests for list endpoints and error responses WILL BREAK.

**Protocol:**

- [ ] **Before starting Task 1**, run:
  ```bash
  git fetch origin
  git log origin/main --since='2 days ago' -- tests/
  ```
  If commits touching `tests/server/routes/**` or `tests/api/**` have landed since this plan was written, list them and inspect each with `git show --stat <sha>`.

- [ ] If E has already landed on `main`, **rebase this branch onto `origin/main` before editing anything** so E's test files are present in the worktree, and then update them as part of Task 1 / Task 2 / Task 3 in the same PR.
- [ ] If E has NOT yet landed, proceed with the plan as written. After B's PR opens, watch `#36`; if E merges while B is in review, **rebase B onto main** and update E's newly-arrived tests in a single fixup commit titled `test: update package-E tests for package-B envelope`.
- [ ] In the B PR description, explicitly state the coordination status: "Package E status at PR open: [landed | not yet landed]". Reviewers must check this.

---

## Shared design reference (keep open while implementing)

```ts
// Canonical envelope types (server + client both import)
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
export type ApiListResponse<T> = { ok: true; data: T[]; nextCursor: string | null };

// Stable error codes
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";
```

Default `limit` = 50. Maximum `limit` = 200. Server clamps silently (no 400 for over-max; just caps). Invalid `cursor` (non-base64url, non-JSON, or missing `id` field) returns `400 { ok: false, error: { code: "BAD_REQUEST", message: "Invalid cursor" } }`.

---

## Task 1: Server envelope helpers + route rollout (#29)

**Files:**
- Create: `server/api/envelope.ts`
- Modify: `server/api/routes.ts`
- Modify: `tests/server/routes/audit-flags.test.ts`
- Modify: `tests/server/routes/bibles.test.ts`
- Modify: `tests/server/routes/chapter-arcs.test.ts`
- Modify: `tests/server/routes/chunks.test.ts`
- Modify: `tests/server/routes/compilation-logs.test.ts`
- Modify: `tests/server/routes/learner.test.ts`
- Modify: `tests/server/routes/narrative-irs.test.ts`
- Modify: `tests/server/routes/projects.test.ts`
- Modify: `tests/server/routes/scene-plans.test.ts`
- Modify: `tests/server/routes-ensure-project.test.ts`

### Step 1: Run the coordination check

- [ ] **Step 1.1: Check for Package E**

```bash
git fetch origin
git log origin/main --since='2 days ago' -- tests/
```

Record the result in your PR description. If E has landed, rebase before proceeding.

### Step 2: Write the envelope helper (TDD — helper first)

- [ ] **Step 2.1: Write failing tests for `envelope.ts`**

Create `tests/server/api/envelope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { err, ok, type ApiErrorCode } from "../../../server/api/envelope.js";

describe("envelope helpers", () => {
  it("ok() wraps data in { ok: true, data }", () => {
    expect(ok({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });

  it("ok() preserves arrays as data", () => {
    expect(ok([1, 2, 3])).toEqual({ ok: true, data: [1, 2, 3] });
  });

  it("err() wraps code and message in { ok: false, error }", () => {
    const code: ApiErrorCode = "NOT_FOUND";
    expect(err(code, "nope")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "nope" },
    });
  });

  it("err() defaults HTTP status to 500 for INTERNAL", () => {
    // err() returns the envelope; the route calls res.status(statusFor(code)).json(err(...))
    // so we also export statusFor.
    // Imported lazily here to avoid circular test wiring.
    const { statusFor } = require("../../../server/api/envelope.js");
    expect(statusFor("NOT_FOUND")).toBe(404);
    expect(statusFor("BAD_REQUEST")).toBe(400);
    expect(statusFor("VALIDATION_FAILED")).toBe(422);
    expect(statusFor("UPSTREAM_UNAVAILABLE")).toBe(502);
    expect(statusFor("INTERNAL")).toBe(500);
  });
});
```

- [ ] **Step 2.2: Run and confirm failure**

```bash
pnpm test -- tests/server/api/envelope.test.ts
```

Expected: module-not-found failure for `server/api/envelope.js`.

- [ ] **Step 2.3: Implement `server/api/envelope.ts`**

```ts
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: ApiErrorCode; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
export type ApiListResponse<T> = { ok: true; data: T[]; nextCursor: string | null };

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function okList<T>(data: T[], nextCursor: string | null): ApiListResponse<T> {
  return { ok: true, data, nextCursor };
}

export function err(code: ApiErrorCode, message: string): ApiErr {
  return { ok: false, error: { code, message } };
}

export function statusFor(code: ApiErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "BAD_REQUEST":
      return 400;
    case "VALIDATION_FAILED":
      return 422;
    case "UPSTREAM_UNAVAILABLE":
      return 502;
    case "INTERNAL":
      return 500;
  }
}
```

- [ ] **Step 2.4: Confirm tests pass**

```bash
pnpm test -- tests/server/api/envelope.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add server/api/envelope.ts tests/server/api/envelope.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add unified response envelope helpers

Introduces server/api/envelope.ts with ok(), okList(), err(), and
statusFor() helpers and the canonical ApiResponse / ApiListResponse
types. No route handlers use these yet — the rollout lands in the
next commit.

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Step 3: Roll envelope through every route in `server/api/routes.ts`

The current file is a single 609-line `createApiRouter` function. Every `res.json(...)`, `res.status(N).json(...)`, and `res.status(204).send()` must be rewritten. Every route is enumerated below — do not skip any. Work top-to-bottom; after each section, run `pnpm typecheck` to catch typos.

**Import line change (at top of `server/api/routes.ts`):**

```ts
import { err, ok, okList, statusFor, type ApiErrorCode } from "./envelope.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("api");
```

Note: do NOT remove any existing `console.*` calls — Package F2 owns that sweep. Only use `log.*` for NEW log statements you add (e.g., logging cursor decode failures).

**Helper used in every 404 handler (top of the file, after imports):**

```ts
function notFound(res: express.Response, message: string): void {
  res.status(statusFor("NOT_FOUND")).json(err("NOT_FOUND", message));
}

function badRequest(res: express.Response, message: string): void {
  res.status(statusFor("BAD_REQUEST")).json(err("BAD_REQUEST", message));
}

function internal(res: express.Response, message: string): void {
  res.status(statusFor("INTERNAL")).json(err("INTERNAL", message));
}

function upstream(res: express.Response, message: string): void {
  res.status(statusFor("UPSTREAM_UNAVAILABLE")).json(err("UPSTREAM_UNAVAILABLE", message));
}
```

(Add `import type express from "express";` if not already imported via the `Router` import.)

**Every route — enumerated checklist. Check each box as you convert it.**

Projects:
- [ ] `GET  /projects` — was `res.json(list)` → `res.json(okList(page.data, page.nextCursor))` (see Task 3 for the list-endpoint pagination wrapper; in this task just use `res.json(ok(list))` as a temporary shape; Task 3 rewrites it again)
- [ ] `GET  /projects/:id` — `res.json(project)` → `res.json(ok(project))`; the 404 branch → `notFound(res, "Project not found")`
- [ ] `POST /projects` — `res.status(201).json(project)` → `res.status(201).json(ok(project))`
- [ ] `PATCH /projects/:id` — `res.json(project)` → `res.json(ok(project))`; 404 → `notFound(res, "Project not found")`
- [ ] `DELETE /projects/:id` — `res.json({ ok: true })` → `res.json(ok({ deleted: true }))`; 404 → `notFound(res, "Project not found")`

Bibles:
- [ ] `GET  /projects/:projectId/bibles/latest` — `res.json(bible)` → `res.json(ok(bible))`; 404 → `notFound(res, "No bible found")`
- [ ] `GET  /projects/:projectId/bibles/:version` — `res.json(bible)` → `res.json(ok(bible))`; 404 → `notFound(res, "Bible version not found")`
- [ ] `GET  /projects/:projectId/bibles` (list of versions) — `res.json(...)` → temporary `res.json(ok(list))`; Task 3 converts to `okList`
- [ ] `POST /projects/:projectId/bibles` — `res.status(201).json(bible)` → `res.status(201).json(ok(bible))`

Chapter Arcs:
- [ ] `GET  /projects/:projectId/chapters` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `GET  /chapters/:id` — → `res.json(ok(arc))`; 404 → `notFound(res, "Chapter arc not found")`
- [ ] `POST /chapters` — `res.status(201).json(arc)` → `res.status(201).json(ok(arc))`
- [ ] `PUT  /chapters/:id` — `res.json(arc)` → `res.json(ok(arc))`; the id-mismatch 400 → `badRequest(res, "URL id and body id do not match")`

Scene Plans:
- [ ] `GET  /chapters/:chapterId/scenes` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `GET  /scenes/:id` — → `res.json(ok(result))`; 404 → `notFound(res, "Scene plan not found")`
- [ ] `POST /scenes` — `res.status(201).json(created)` → `res.status(201).json(ok(created))`
- [ ] `PUT  /scenes/:id` — id-mismatch → `badRequest(...)`; success → `res.json(ok(updated))`
- [ ] `PATCH /scenes/:id/status` — success `{ ok: true }` → `res.json(ok({ updated: true }))`; 404 → `notFound(res, "Scene not found")`

Chunks:
- [ ] `GET  /scenes/:sceneId/chunks` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `GET  /chunks/:id` — → `res.json(ok(chunk))`; 404 → `notFound(res, "Chunk not found")`
- [ ] `POST /chunks` — → `res.status(201).json(ok(chunk))`
- [ ] `PUT  /chunks/:id` — id-mismatch → `badRequest`; success → `res.json(ok(chunk))`
- [ ] `DELETE /chunks/:id` — success → `res.json(ok({ deleted: true }))`; 404 → `notFound(res, "Chunk not found")`

Audit Flags:
- [ ] `GET  /scenes/:sceneId/audit-flags` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `POST /audit-flags` (both array and single branches) — → `res.status(201).json(ok(flags))` / `res.status(201).json(ok(flag))`
- [ ] `PATCH /audit-flags/:id/resolve` — success → `res.json(ok({ resolved: true }))`; 404 → `notFound(res, "Audit flag not found")`
- [ ] `GET  /scenes/:sceneId/audit-stats` — `res.json(stats)` → `res.json(ok(stats))` (NOT a list)

Narrative IRs:
- [ ] `GET  /scenes/:sceneId/ir` — → `res.json(ok(ir))`; 404 → `notFound(res, "IR not found")`
- [ ] `POST /scenes/:sceneId/ir` — → `res.status(201).json(ok(ir))`
- [ ] `PUT  /scenes/:sceneId/ir` — id-mismatch → `badRequest`; success → `res.json(ok(ir))`
- [ ] `PATCH /scenes/:sceneId/ir/verify` — success → `res.json(ok({ verified: true }))`; 404 → `notFound(res, "IR not found")`
- [ ] `GET  /chapters/:chapterId/irs` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `GET  /chapters/:chapterId/irs/verified` — list → temporary `res.json(ok(list))`; Task 3 converts

Compilation Logs:
- [ ] `POST /compilation-logs` — → `res.status(201).json(ok(log))`
- [ ] `GET  /compilation-logs/:id` — → `res.json(ok(log))`; 404 → `notFound(res, "Log not found")`
- [ ] `GET  /chunks/:chunkId/compilation-logs` — list → temporary `res.json(ok(list))`; Task 3 converts

Edit Patterns (Learner):
- [ ] `GET  /projects/:projectId/edit-patterns` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `GET  /scenes/:sceneId/edit-patterns` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `POST /edit-patterns` — → `res.status(201).json(ok(patterns))`

Learned Patterns (Learner):
- [ ] `GET  /projects/:projectId/learned-patterns` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `POST /learned-patterns` — → `res.status(201).json(ok(pattern))`
- [ ] `PATCH /learned-patterns/:id/status` — success → `res.json(ok({ updated: true }))`; 404 → `notFound(res, "Learned pattern not found")`

Profile Adjustments (Auto-Tuning):
- [ ] `GET  /projects/:projectId/profile-adjustments` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `POST /profile-adjustments` — → `res.status(201).json(ok(proposal))`
- [ ] `PATCH /profile-adjustments/:id/status` — success → `res.json(ok({ updated: true }))`; 404 → `notFound(res, "Profile adjustment not found")`

Voice Guide:
- [ ] `GET  /voice-guide` — currently returns `{ guide }` or `{ guide: null }` — rewrite as `res.json(ok({ guide }))` (keep the wrapping object because the client currently reads `.guide` off it, and Task 2 preserves that via the client wrapper)
- [ ] `POST /voice-guide/generate` — 400 sampleIds error → `badRequest(res, "sampleIds must be a non-empty array")`; 404 samples-not-found → `notFound(res, "No writing samples found")`; 500 no-client → `upstream(res, "Anthropic client not configured")`; success → `res.status(201).json(ok(guide))`; caught exception → `internal(res, message)`
- [ ] `GET  /voice-guide/versions` — list → temporary `res.json(ok(list))`; Task 3 converts

Writing Samples:
- [ ] `GET  /writing-samples` — list → temporary `res.json(ok(list))`; Task 3 converts
- [ ] `POST /writing-samples` — → `res.status(201).json(ok(created))`
- [ ] `DELETE /writing-samples/:id` — currently `res.status(204).send()` — change to `res.status(200).json(ok({ deleted: true }))` (204 has no body, envelope requires a body; this is an intentional breaking change — client Task 2 updates to match); 404 → `notFound(res, "Writing sample not found")`

Project Voice Learning:
- [ ] `POST /projects/:projectId/significant-edits` — → `res.status(201).json(ok({ count }))`
- [ ] `POST /projects/:projectId/cipher/batch` — 500 no-client → `upstream(res, "Anthropic client not configured")`; no-edits short-circuit `{ statement: null }` → `res.json(ok({ statement: null }))`; success → `res.status(201).json(ok({ statement, ring1Injection }))`; catch → `internal(res, message)`
- [ ] `GET  /projects/:projectId/project-voice-guide` — `{ guide: ... }` → `res.json(ok({ guide }))`
- [ ] `POST /projects/:projectId/voice/redistill` — 500 no-client → `upstream(...)`; skipped branch → `res.json(ok({ ring1Injection: "", skipped: true }))`; success → `res.json(ok({ ring1Injection }))`; catch → `internal(...)`
- [ ] `POST /projects/:projectId/project-voice-guide/update` — 500 no-client → `upstream(...)`; success → `res.status(201).json(ok({ projectGuide, ring1Injection }))`; catch → `internal(...)`

- [ ] **Step 3.1: Run typecheck after each section**

```bash
pnpm typecheck
```

- [ ] **Step 3.2: Run the existing route test suite (it WILL fail — that's expected)**

```bash
pnpm test -- tests/server/routes tests/server/routes-ensure-project.test.ts
```

Note which assertions broke; every one is a direct-shape assertion that must be updated in Step 4.

### Step 4: Update every route test to assert the envelope

Work file-by-file. For every assertion like `expect(res.body).toEqual(X)`, change it to `expect(res.body).toEqual({ ok: true, data: X })`. For every assertion like `expect(res.body.error).toBe("Project not found")`, change to `expect(res.body).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Project not found" } })`. For 201/204 status checks, keep the status check; for the previously-204 DELETE of writing-samples, change the assertion to `expect(res.status).toBe(200)` and `expect(res.body).toEqual({ ok: true, data: { deleted: true } })`.

- [ ] **Step 4.1: `tests/server/routes/projects.test.ts`** — walk every describe block; update every `res.body` assertion. Include a new assertion that error envelopes carry `error.code === "NOT_FOUND"` for 404s.
- [ ] **Step 4.2: `tests/server/routes/bibles.test.ts`** — same treatment.
- [ ] **Step 4.3: `tests/server/routes/chapter-arcs.test.ts`** — same treatment.
- [ ] **Step 4.4: `tests/server/routes/scene-plans.test.ts`** — same treatment.
- [ ] **Step 4.5: `tests/server/routes/chunks.test.ts`** — same treatment.
- [ ] **Step 4.6: `tests/server/routes/audit-flags.test.ts`** — same treatment.
- [ ] **Step 4.7: `tests/server/routes/narrative-irs.test.ts`** — same treatment.
- [ ] **Step 4.8: `tests/server/routes/compilation-logs.test.ts`** — same treatment.
- [ ] **Step 4.9: `tests/server/routes/learner.test.ts`** — same treatment.
- [ ] **Step 4.10: `tests/server/routes-ensure-project.test.ts`** — same treatment.

At the end of each file, add one new assertion that verifies the envelope discriminant explicitly:

```ts
it("wraps all successful responses in { ok: true, data }", async () => {
  const res = await request(app).get("/api/data/projects/known-id");
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body).toHaveProperty("data");
});

it("wraps all error responses in { ok: false, error: { code, message } }", async () => {
  const res = await request(app).get("/api/data/projects/does-not-exist");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({
    ok: false,
    error: { code: "NOT_FOUND", message: "Project not found" },
  });
});
```

Adapt the URL/id per file, but keep the envelope-shape assertion in every route test file as a regression guard.

- [ ] **Step 4.11: Run the full route test suite**

```bash
pnpm test -- tests/server/routes tests/server/routes-ensure-project.test.ts tests/server/api/envelope.test.ts
```

Expected: green.

### Step 5: Gate check and commit

- [ ] **Step 5.1: `pnpm check-all`**

Expected: lint + typecheck + full vitest suite green. The client test suite (`tests/api/client.test.ts`) is still asserting the OLD shape and will fail — that is expected and is fixed in Task 2. **Commit this task's work with a failing client test intentionally red, then immediately proceed to Task 2 in the same session.**

Actually — no. A red suite on the intermediate commit would leave main poisoned if Task 2 is delayed. Instead, bundle the client test file's envelope updates INTO this commit: update `tests/api/client.test.ts`'s mock-fetch bodies to return `{ ok: true, data: X }` so they pass against the current client wrapper (which naively returns `res.json()`). Task 2 will then reshape the client wrapper and add `ApiError` tests on top of the already-envelope-shaped fixtures.

Apply minimal edits to `tests/api/client.test.ts`: every mock that does `mockResponse({ ... })` gets its body wrapped in `{ ok: true, data: { ... } }`, and the test's `expect(await apiFoo())` is updated to peel `.data` manually OR the test is marked `.skip` with a comment pointing to Task 2. **Prefer the wrap — it keeps the suite green.**

- [ ] **Step 5.2: Commit**

```bash
git add server/api/routes.ts tests/server/routes tests/server/routes-ensure-project.test.ts tests/api/client.test.ts
git commit -m "$(cat <<'EOF'
feat(api): wrap every route handler in the unified envelope

Every handler in server/api/routes.ts now returns responses via
ok() / err() helpers from server/api/envelope.ts. 404s use a
shared notFound() helper carrying error.code = "NOT_FOUND"; 400s
use badRequest() with code = "BAD_REQUEST"; upstream failures use
UPSTREAM_UNAVAILABLE; caught exceptions use INTERNAL.

All route tests under tests/server/routes updated to assert the
new envelope shape. Client test fixtures also pre-wrapped so the
suite stays green; the client wrapper itself is reshaped in the
next commit (Task 2).

DELETE /writing-samples/:id now returns 200 with an envelope body
instead of 204, because the envelope requires a response body.

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Client wrapper + `ApiError` (#29 continued)

**Files:**
- Create: `src/api/errors.ts`
- Modify: `src/api/client.ts`
- Modify: `tests/api/client.test.ts`

### Step 1: Write the `ApiError` class (TDD)

- [ ] **Step 1.1: Create `tests/api/errors.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";

describe("ApiError", () => {
  it("carries code, message, and status", () => {
    const e = new ApiError("NOT_FOUND", "missing", 404);
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("missing");
    expect(e.status).toBe(404);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
  });

  it("is throwable and catchable as a standard Error", () => {
    try {
      throw new ApiError("INTERNAL", "boom", 500);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
```

- [ ] **Step 1.2: Run and confirm failure**

```bash
pnpm test -- tests/api/errors.test.ts
```

- [ ] **Step 1.3: Implement `src/api/errors.ts`**

```ts
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL"
  | "UNKNOWN";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
```

Note: the client's `ApiErrorCode` includes `"UNKNOWN"` as a fallback for malformed / unexpected response bodies. The server never emits `UNKNOWN`; only the client wrapper can synthesize it.

- [ ] **Step 1.4: Confirm tests pass**

```bash
pnpm test -- tests/api/errors.test.ts
```

### Step 2: Reshape `fetchJson` to unwrap the envelope

- [ ] **Step 2.1: Extend `tests/api/client.test.ts` with envelope-handling cases**

Add these cases alongside the existing tests:

```ts
import { ApiError } from "@/api/errors";

describe("fetchJson envelope handling", () => {
  it("returns .data from { ok: true, data }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { id: "p1", title: "Test" } }),
    }) as unknown as typeof fetch;

    const result = await apiGetProject("p1");
    expect(result).toEqual({ id: "p1", title: "Test" });
  });

  it("throws ApiError with code/message/status on { ok: false, error }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        ok: false,
        error: { code: "NOT_FOUND", message: "missing" },
      }),
    }) as unknown as typeof fetch;

    await expect(apiGetProject("x")).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      message: "missing",
      status: 404,
    });
  });

  it("throws ApiError with code UNKNOWN when body is not a recognized envelope", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => "not-an-object",
    }) as unknown as typeof fetch;

    await expect(apiGetProject("x")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 500,
    });
  });

  it("throws ApiError with code UNKNOWN when res.ok is true but body lacks data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ whatever: 1 }),
    }) as unknown as typeof fetch;

    await expect(apiGetProject("x")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 200,
    });
  });

  it("returns the full { data, nextCursor } object for list responses via fetchList", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: [{ id: "a" }, { id: "b" }],
        nextCursor: "eyJpZCI6ImIifQ",
      }),
    }) as unknown as typeof fetch;

    const page = await apiListProjectsPage({ limit: 50 });
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextCursor).toBe("eyJpZCI6ImIifQ");
  });
});
```

(Note: `apiListProjectsPage` is introduced alongside `apiListProjects` in Step 2.2 — see below.)

- [ ] **Step 2.2: Rewrite `src/api/client.ts`'s `fetchJson` and add `fetchList`**

Replace the current `fetchJson` with:

```ts
import { ApiError, type ApiErrorCode } from "./errors.js";

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

type ListEnvelope<T> = { ok: true; data: T[]; nextCursor: string | null };

function isErrEnvelope(body: unknown): body is { ok: false; error: { code: string; message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === false &&
    typeof (body as { error?: unknown }).error === "object"
  );
}

function isOkEnvelope<T>(body: unknown): body is { ok: true; data: T } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === true &&
    "data" in (body as object)
  );
}

function isListEnvelope<T>(body: unknown): body is ListEnvelope<T> {
  return isOkEnvelope<T[]>(body) && "nextCursor" in (body as object);
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(body.error.code as ApiErrorCode, body.error.message, res.status);
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status);
  }
  if (isOkEnvelope<T>(body)) {
    return body.data;
  }
  throw new ApiError("UNKNOWN", "Malformed API response", res.status);
}

export interface PageRequest {
  limit?: number;
  cursor?: string | null;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

async function fetchList<T>(url: string, page?: PageRequest, init?: RequestInit): Promise<Page<T>> {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set("limit", String(page.limit));
  if (page?.cursor) params.set("cursor", page.cursor);
  const sep = url.includes("?") ? "&" : "?";
  const full = params.toString() ? `${url}${sep}${params.toString()}` : url;

  const res = await fetch(full, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(body.error.code as ApiErrorCode, body.error.message, res.status);
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status);
  }
  if (isListEnvelope<T>(body)) {
    return { data: body.data, nextCursor: body.nextCursor };
  }
  throw new ApiError("UNKNOWN", "Malformed list response", res.status);
}
```

**Existing non-list helpers** (`apiGetProject`, `apiSaveBible`, etc.) keep their current signatures — they call `fetchJson<T>` and the unwrap is invisible to callers. NO upstream UI changes are required, because the server now returns the same data object inside `{ ok: true, data }`, and `fetchJson` unwraps it.

**List helpers** get two variants. Keep the existing signature returning `Promise<T[]>` for backward compatibility (internally calls `fetchList` and returns `.data`, discarding `nextCursor`), AND add a new `Page`-returning sibling for pagination-aware callers. Apply this pattern to every list helper listed here:

```ts
// Example for projects:
export function apiListProjects(): Promise<Project[]> {
  return fetchList<Project>(`${BASE}/projects`).then((p) => p.data);
}

export function apiListProjectsPage(page?: PageRequest): Promise<Page<Project>> {
  return fetchList<Project>(`${BASE}/projects`, page);
}
```

- [ ] **Step 2.3: Apply the list-variant pattern to every existing client list helper**

Checklist (every list-fetching function in `src/api/client.ts`):

- [ ] `apiListProjects` → add `apiListProjectsPage`
- [ ] `apiListBibleVersions` → add `apiListBibleVersionsPage`
- [ ] `apiListChapterArcs` → add `apiListChapterArcsPage`
- [ ] `apiListScenePlans` → add `apiListScenePlansPage`
- [ ] `apiListChunks` → add `apiListChunksPage`
- [ ] `apiListAuditFlags` → add `apiListAuditFlagsPage`
- [ ] `apiListChapterIRs` → add `apiListChapterIRsPage`
- [ ] `apiListVerifiedChapterIRs` → add `apiListVerifiedChapterIRsPage`
- [ ] `apiListProfileAdjustments` → add `apiListProfileAdjustmentsPage`
- [ ] `apiListVoiceGuideVersions` → add `apiListVoiceGuideVersionsPage`
- [ ] `apiListWritingSamples` → add `apiListWritingSamplesPage`

Plus two new ones for endpoints that did not previously have client helpers for their list shape (they're only consumed server-side today, but the client module should cover them for parity):

- [ ] `apiListEditPatternsPage(projectId)` → `${BASE}/projects/${projectId}/edit-patterns`
- [ ] `apiListEditPatternsForScenePage(sceneId)` → `${BASE}/scenes/${sceneId}/edit-patterns`
- [ ] `apiListLearnedPatternsPage(projectId, status?)` → `${BASE}/projects/${projectId}/learned-patterns`
- [ ] `apiListCompilationLogsPage(chunkId)` → `${BASE}/chunks/${chunkId}/compilation-logs`

**Special cases in `src/api/client.ts` that need bespoke handling:**

- [ ] `apiGetVoiceGuide` currently reads `.guide` off the response. Server now returns `{ ok: true, data: { guide } }` → `fetchJson` unwraps to `{ guide }` → existing `.guide` read works unchanged. **No caller change needed.**
- [ ] `apiGetProjectVoiceGuide` — same story.
- [ ] `apiStoreSignificantEdit` — currently reads `.count`. Server returns `{ ok: true, data: { count } }` → unwrap to `{ count }` → `.count` read works.
- [ ] `apiFireBatchCipher` — same pattern; the existing `"statement" in data && data.statement === null` branch still works after unwrapping.
- [ ] `apiDeleteWritingSample` — currently uses raw `fetch` + `res.ok` check and expects 204. Rewrite to use `fetchJson<{ deleted: boolean }>` now that the server returns 200 + envelope.

```ts
export async function apiDeleteWritingSample(id: string): Promise<void> {
  await fetchJson<{ deleted: boolean }>(`${BASE}/writing-samples/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2.4: Run the full suite**

```bash
pnpm check-all
```

Expected: green across lint, typecheck, and vitest.

- [ ] **Step 2.5: Commit**

```bash
git add src/api/client.ts src/api/errors.ts tests/api/errors.test.ts tests/api/client.test.ts
git commit -m "$(cat <<'EOF'
feat(api): client unwraps envelope and throws typed ApiError

fetchJson in src/api/client.ts now recognizes the unified envelope:
on { ok: true, data } it returns .data; on { ok: false, error }
it throws a new ApiError carrying code, message, and HTTP status.
Malformed bodies surface as ApiError with code "UNKNOWN".

Every list helper gains a sibling *Page variant that returns
{ data, nextCursor } for pagination-aware callers; the existing
array-returning helpers remain as thin wrappers so UI call-sites
are untouched.

apiDeleteWritingSample rewritten for the new 200 + envelope
response (was 204 + empty body).

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cursor-based pagination on every list endpoint (#30)

**Files:**
- Create: `server/api/pagination.ts`
- Create: `tests/server/api/pagination.test.ts`
- Modify: `server/api/routes.ts`
- Modify: `tests/server/routes/*.test.ts` (add pagination assertions for list endpoints)

### Step 1: Pagination helper (TDD)

- [ ] **Step 1.1: Write failing tests**

Create `tests/server/api/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  clampLimit,
  decodeCursor,
  encodeCursor,
  paginate,
  parseListQuery,
} from "../../../server/api/pagination.js";

describe("clampLimit", () => {
  it("returns DEFAULT_LIMIT when limit is undefined", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
  });
  it("returns DEFAULT_LIMIT when limit is non-numeric", () => {
    expect(clampLimit("abc")).toBe(DEFAULT_LIMIT);
  });
  it("floors at 1", () => {
    expect(clampLimit("0")).toBe(1);
    expect(clampLimit("-5")).toBe(1);
  });
  it("caps at MAX_LIMIT", () => {
    expect(clampLimit("10000")).toBe(MAX_LIMIT);
  });
  it("passes through valid limits", () => {
    expect(clampLimit("25")).toBe(25);
  });
});

describe("encodeCursor / decodeCursor", () => {
  it("roundtrips an id", () => {
    const token = encodeCursor("abc-123");
    expect(decodeCursor(token)).toEqual({ id: "abc-123" });
  });
  it("decodeCursor returns null for null input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
  it("decodeCursor throws on malformed base64", () => {
    expect(() => decodeCursor("!!!not-base64!!!")).toThrow(/invalid cursor/i);
  });
  it("decodeCursor throws on valid base64 non-JSON", () => {
    const bad = Buffer.from("not json").toString("base64url");
    expect(() => decodeCursor(bad)).toThrow(/invalid cursor/i);
  });
  it("decodeCursor throws on JSON missing id", () => {
    const bad = Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url");
    expect(() => decodeCursor(bad)).toThrow(/invalid cursor/i);
  });
});

describe("paginate", () => {
  const rows = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
    { id: "e" },
  ];

  it("returns first page and nextCursor when more rows exist", () => {
    const page = paginate(rows, { limit: 2, cursor: null });
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextCursor).toBe(encodeCursor("b"));
  });

  it("returns mid page starting after the cursor id", () => {
    const page = paginate(rows, { limit: 2, cursor: { id: "b" } });
    expect(page.data).toEqual([{ id: "c" }, { id: "d" }]);
    expect(page.nextCursor).toBe(encodeCursor("d"));
  });

  it("returns last page with nextCursor = null", () => {
    const page = paginate(rows, { limit: 10, cursor: { id: "c" } });
    expect(page.data).toEqual([{ id: "d" }, { id: "e" }]);
    expect(page.nextCursor).toBeNull();
  });

  it("returns empty data and null cursor when cursor is past end", () => {
    const page = paginate(rows, { limit: 10, cursor: { id: "zzz" } });
    expect(page.data).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe("parseListQuery", () => {
  it("returns clamped limit and decoded cursor for valid query", () => {
    const cursor = encodeCursor("x");
    const parsed = parseListQuery({ limit: "10", cursor });
    expect(parsed.limit).toBe(10);
    expect(parsed.cursor).toEqual({ id: "x" });
  });

  it("returns limit = DEFAULT and cursor = null for empty query", () => {
    const parsed = parseListQuery({});
    expect(parsed.limit).toBe(DEFAULT_LIMIT);
    expect(parsed.cursor).toBeNull();
  });

  it("throws a BAD_REQUEST-shaped error for malformed cursor", () => {
    expect(() => parseListQuery({ cursor: "!!!" })).toThrow(/invalid cursor/i);
  });
});
```

- [ ] **Step 1.2: Run and confirm failure**

```bash
pnpm test -- tests/server/api/pagination.test.ts
```

- [ ] **Step 1.3: Implement `server/api/pagination.ts`**

```ts
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface DecodedCursor {
  id: string;
}

export interface ParsedListQuery {
  limit: number;
  cursor: DecodedCursor | null;
}

export interface PaginateInput {
  limit: number;
  cursor: DecodedCursor | null;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export function clampLimit(raw: unknown): number {
  if (raw === undefined || raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  if (n < 1) return 1;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(n);
}

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), "utf8").toString("base64url");
}

export function decodeCursor(token: string | null | undefined): DecodedCursor | null {
  if (token === null || token === undefined || token === "") return null;
  let raw: string;
  try {
    raw = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid cursor");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid cursor");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { id?: unknown }).id !== "string"
  ) {
    throw new Error("Invalid cursor");
  }
  return { id: (parsed as { id: string }).id };
}

export function parseListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    limit: clampLimit(query.limit),
    cursor: decodeCursor(query.cursor as string | null | undefined),
  };
}

export function paginate<T extends { id: string }>(
  rows: readonly T[],
  input: PaginateInput,
): PaginatedResult<T> {
  let startIndex = 0;
  if (input.cursor) {
    const idx = rows.findIndex((r) => r.id === input.cursor?.id);
    startIndex = idx === -1 ? rows.length : idx + 1;
  }
  const slice = rows.slice(startIndex, startIndex + input.limit);
  const hasMore = startIndex + input.limit < rows.length && slice.length > 0;
  const nextCursor = hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]!.id) : null;
  return { data: slice, nextCursor };
}
```

Note on the `cursor-past-end` edge case: if the caller sends a cursor whose `id` is not in the result set, `findIndex` returns -1, `startIndex` becomes `rows.length`, and `slice` is empty — matching the test expectation.

Note on non-`{ id: string }` list rows: every current list endpoint returns rows that satisfy `{ id: string }` (the repositories all use string UUIDs). The one partial exception is `listBibleVersions`, which returns `{ version: number; createdAt: string }[]` — no `id`. For that endpoint, handle it specially in the route by mapping `version` → a synthetic `id` before calling `paginate`, then stripping it back out. See the route rollout below.

- [ ] **Step 1.4: Confirm tests pass**

```bash
pnpm test -- tests/server/api/pagination.test.ts
```

### Step 2: Apply pagination to every list endpoint

Edit `server/api/routes.ts`. For each list endpoint, replace the temporary `res.json(ok(list))` (installed in Task 1) with:

```ts
try {
  const query = parseListQuery(req.query as Record<string, unknown>);
  const rows = repo.listXxx(db, ...);
  const page = paginate(rows, query);
  res.json(okList(page.data, page.nextCursor));
} catch (e) {
  badRequest(res, (e as Error).message);
}
```

Add at top of file:

```ts
import { okList } from "./envelope.js";
import { paginate, parseListQuery } from "./pagination.js";
```

**Enumerated list endpoints — convert each one:**

- [ ] `GET /projects` — rows: `projects.listProjects(db)` (returns `Project[]`, each has `id: string`)
- [ ] `GET /projects/:projectId/bibles` — rows: `bibles.listBibleVersions(db, projectId)` — **special case, no `id` field**. Map to `{ id: String(version), ...original }`, paginate, then strip: `page.data.map(({ id: _discard, ...rest }) => rest)`.
- [ ] `GET /projects/:projectId/chapters` — rows: `chapterArcs.listChapterArcs(db, projectId)`
- [ ] `GET /chapters/:chapterId/scenes` — rows: `scenePlans.listScenePlans(db, chapterId)` — returns `{ plan, status, sceneOrder }[]`. Use `plan.id` as the pagination id: map to `{ id: item.plan.id, ...item }` before `paginate`, then strip.
- [ ] `GET /scenes/:sceneId/chunks` — rows: `chunks.listChunksForScene(db, sceneId)` (have `id`)
- [ ] `GET /scenes/:sceneId/audit-flags` — rows: `auditFlags.listAuditFlags(db, sceneId)` (have `id`)
- [ ] `GET /chapters/:chapterId/irs` — rows: `narrativeIRs.listAllIRsForChapter(db, chapterId)`. If IRs use `sceneId` as primary key, use that — map `{ id: item.sceneId, ...item }` and strip.
- [ ] `GET /chapters/:chapterId/irs/verified` — same pattern as above
- [ ] `GET /chunks/:chunkId/compilation-logs` — rows: `compilationLogs.listCompilationLogs(db, chunkId)` (have `id`)
- [ ] `GET /projects/:projectId/edit-patterns` — rows: `editPatterns.listEditPatterns(db, projectId)` (have `id`)
- [ ] `GET /scenes/:sceneId/edit-patterns` — rows: `editPatterns.listEditPatternsForScene(db, sceneId)` (have `id`)
- [ ] `GET /projects/:projectId/learned-patterns` — rows: `learnedPatterns.listLearnedPatterns(db, projectId, status)` (have `id`)
- [ ] `GET /projects/:projectId/profile-adjustments` — rows: `profileAdjustments.listProfileAdjustments(db, projectId, status)` (have `id`)
- [ ] `GET /voice-guide/versions` — rows: `voiceGuideRepo.listVoiceGuideVersions(db)` — likely has `version` not `id`. Apply the same map-then-strip wrapper used for `bibles`.
- [ ] `GET /writing-samples` — rows: `writingSampleRepo.listWritingSamples(db)` (have `id`)

**Verification before moving on:** at each endpoint, inspect the actual return type of the repository (read the file in `server/db/repositories/` WITHOUT modifying it — the scope boundary allows read). If a repository function returns rows that genuinely cannot be paginated by `id` (e.g., a computed aggregate), document the exception in a code comment and fall back to returning `{ ok: true, data: rows, nextCursor: null }` regardless of limit. This is acceptable because issue #30 says "no pagination on any list endpoint"; setting `nextCursor: null` means "this list is never paginated in multiple hops."

- [ ] **Step 2.1: Typecheck**

```bash
pnpm typecheck
```

### Step 3: Add pagination tests to every list-endpoint route test file

For every list endpoint listed above, add the following three test cases to the corresponding route test file. Adapt names/paths, keep the shape.

```ts
describe("GET /projects pagination", () => {
  beforeEach(async () => {
    // seed 7 projects p1..p7
    for (let i = 1; i <= 7; i++) {
      await request(app)
        .post("/api/data/projects")
        .send({ id: `p${i}`, title: `Project ${i}`, status: "drafting" });
    }
  });

  it("returns first page with nextCursor when more exist", async () => {
    const res = await request(app).get("/api/data/projects?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.nextCursor).toBeTypeOf("string");
  });

  it("returns the next page when cursor is passed", async () => {
    const first = await request(app).get("/api/data/projects?limit=3");
    const second = await request(app).get(
      `/api/data/projects?limit=3&cursor=${first.body.nextCursor}`,
    );
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(3);
    // the two pages must not overlap
    const firstIds = new Set(first.body.data.map((p: { id: string }) => p.id));
    for (const item of second.body.data) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it("returns nextCursor = null on the last page", async () => {
    const first = await request(app).get("/api/data/projects?limit=5");
    const second = await request(app).get(
      `/api/data/projects?limit=5&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.nextCursor).toBeNull();
  });

  it("returns 400 BAD_REQUEST for invalid cursor", async () => {
    const res = await request(app).get("/api/data/projects?cursor=%21%21%21");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: { code: "BAD_REQUEST", message: expect.stringMatching(/invalid cursor/i) },
    });
  });

  it("clamps limit above MAX_LIMIT to 200", async () => {
    const res = await request(app).get("/api/data/projects?limit=99999");
    expect(res.status).toBe(200);
    // only 7 seeded, so all 7 come back; the clamp is exercised by a lower-level
    // pagination unit test. This case just ensures no error is thrown.
    expect(res.body.data.length).toBeLessThanOrEqual(200);
  });
});
```

Apply this block, adapted for path and fixture seeding, to every route test file whose endpoint is now paginated:

- [ ] `tests/server/routes/projects.test.ts` (endpoint `/projects`)
- [ ] `tests/server/routes/bibles.test.ts` (endpoint `/projects/:projectId/bibles`)
- [ ] `tests/server/routes/chapter-arcs.test.ts` (endpoint `/projects/:projectId/chapters`)
- [ ] `tests/server/routes/scene-plans.test.ts` (endpoint `/chapters/:chapterId/scenes`)
- [ ] `tests/server/routes/chunks.test.ts` (endpoint `/scenes/:sceneId/chunks`)
- [ ] `tests/server/routes/audit-flags.test.ts` (endpoint `/scenes/:sceneId/audit-flags`)
- [ ] `tests/server/routes/narrative-irs.test.ts` (endpoints `/chapters/:chapterId/irs` and `/chapters/:chapterId/irs/verified`)
- [ ] `tests/server/routes/compilation-logs.test.ts` (endpoint `/chunks/:chunkId/compilation-logs`)
- [ ] `tests/server/routes/learner.test.ts` (endpoints `/projects/:projectId/edit-patterns`, `/scenes/:sceneId/edit-patterns`, `/projects/:projectId/learned-patterns`, `/projects/:projectId/profile-adjustments`)

For `/voice-guide/versions` and `/writing-samples` — these endpoints do not currently have a dedicated test file under `tests/server/routes/`. Create `tests/server/routes/voice-guide.test.ts` and `tests/server/routes/writing-samples.test.ts` with the minimum set of assertions: pagination happy-path (first page, mid page, last page, null cursor), invalid-cursor 400, and the envelope shape check. Use fixture data seeded via POST to the respective create endpoint.

### Step 4: Gate check and commit

- [ ] **Step 4.1: Run full suite**

```bash
pnpm check-all
```

Expected: green.

- [ ] **Step 4.2: Commit**

```bash
git add server/api/pagination.ts server/api/routes.ts tests/server/api/pagination.test.ts tests/server/routes
git commit -m "$(cat <<'EOF'
feat(api): cursor-based pagination on every list endpoint

Adds server/api/pagination.ts with clampLimit, encodeCursor,
decodeCursor, parseListQuery, and paginate helpers. Every list
endpoint in server/api/routes.ts now parses ?limit and ?cursor
from the query, clamps limit to [1, 200] (default 50), and
returns { ok: true, data, nextCursor } where nextCursor is a
base64url-encoded { id } token or null on the last page.

Invalid cursors surface as 400 BAD_REQUEST inside the envelope.

List endpoints whose rows lack a string id (bible versions,
voice guide versions) use a map-then-strip wrapper keyed on
version. IR list endpoints key on sceneId.

Route test files updated with first/mid/last-page assertions
and invalid-cursor coverage.

Closes #30. Part of the unified API contract landing in this PR.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Push and open PR

- [ ] **Step 1: Re-run the full gate one more time**

```bash
pnpm check-all
```

Expected: green.

- [ ] **Step 2: Push**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(api): package B — unified envelope + pagination (#29 #30)" --body "$(cat <<'EOF'
## Summary
- Every `/api/data/**` route now returns `{ ok: true, data }` on success and `{ ok: false, error: { code, message } }` on failure. A shared `server/api/envelope.ts` owns the helpers; a `statusFor()` table maps error codes to HTTP status.
- `src/api/client.ts`'s `fetchJson` unwraps the envelope transparently. On `ok: false` it throws a new typed `ApiError(code, message, status)`. Malformed bodies surface as `ApiError` with `code: "UNKNOWN"`.
- Every list endpoint is now cursor-paginated. Request with `?limit=N&cursor=TOKEN` (defaults: limit=50, max=200). Response carries `nextCursor: string | null`. Invalid cursors return 400 inside the envelope.
- Client list helpers split into two variants: the existing `apiListXxx(): Promise<T[]>` keeps working for unchanged UI callers; a new `apiListXxxPage({ limit?, cursor? })` returns `{ data, nextCursor }` for pagination-aware callers.

Closes #29. Closes #30.

## Coordination with Package E (#36)

Package E status at PR open: **[TODO: fill in — "landed" or "not yet landed"]**.

If E lands while this PR is in review, rebase and fix up E's new route tests for the new envelope shape in a single commit. See the plan doc for the exact protocol.

## Test plan
- [ ] `pnpm check-all` green
- [ ] `tests/server/api/envelope.test.ts` — envelope + statusFor
- [ ] `tests/server/api/pagination.test.ts` — clamp, encode/decode, paginate, parseListQuery
- [ ] `tests/api/errors.test.ts` — ApiError class
- [ ] `tests/api/client.test.ts` — envelope unwrap, ApiError throw, malformed body handling, list pagination
- [ ] `tests/server/routes/*.test.ts` — every route test asserts new envelope shape, every list-endpoint test asserts first/mid/last page and invalid-cursor 400
- [ ] Manual smoke: `pnpm dev:all`, hit `GET /api/data/projects?limit=2` and confirm `{ ok, data, nextCursor }` in the response

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Done criteria

- `server/api/envelope.ts`, `server/api/pagination.ts`, `src/api/errors.ts` all exist with tests and the tests pass.
- Every route handler in `server/api/routes.ts` returns responses through `ok()` / `okList()` / `err()` helpers. No bare `res.json(object)`, no bare `res.status(N).json({ error })`, no `res.status(204).send()` remains. A grep for `res.json(` in `server/api/routes.ts` shows only calls that wrap their argument in an envelope helper.
- Every list endpoint enumerated in Task 3 Step 2 parses `?limit` and `?cursor` and returns `{ data, nextCursor }` inside the envelope.
- `src/api/client.ts`'s `fetchJson` throws `ApiError` on envelope errors and on malformed bodies; returns `.data` on success. Every existing list helper has a `*Page` sibling.
- `pnpm check-all` is green.
- PR is open against `main` with title `feat(api): package B — unified envelope + pagination (#29 #30)`.
- PR body states the Package E coordination status explicitly.
- Scope boundary respected: no changes to `server/db/**`, `server/proxy.ts`, `server/middleware.ts`, `src/app/**`, or unrelated test files.
- Existing UI call-sites continue to compile and behave unchanged (verified by `pnpm check-all`'s typecheck and the existing vitest store/component suites).
