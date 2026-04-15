# Package B: API Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every HTTP response from `/api/data/**` behind a single envelope (`{ ok: true, data }` / `{ ok: false, error: { code, message } }`), normalize the client wrapper to unwrap that envelope and throw a typed `ApiError`, and add opt-in paginated list responses to every list endpoint. The client and server change together in one PR so the contract never drifts.

**Architecture:**
- **Server:** a tiny `server/api/envelope.ts` module owns the canonical `ok()` / `okList()` / `err()` helpers. Every route handler in `server/api/routes.ts` is rewritten to return values through those helpers. A sibling `server/api/pagination.ts` module owns opaque page-token encoding/decoding and `limit` validation; every list endpoint calls it and returns `{ ok: true, data, nextPageToken }`.
- **Client:** `src/api/client.ts`'s `fetchJson` unwraps the envelope. On `ok: false` it throws a new `ApiError` class carrying `code`, `message`, HTTP `status`, and (optionally) `cause`, `requestId`, `body`. On `ok: true` list responses, a `fetchList` helper returns the full `{ data, nextPageToken }` object. The existing array-returning list helpers are **migrated** (not duplicated) to the new `Page`-returning signature; call-sites in `src/app/**` are updated in the same package to consume the new shape.
- **Envelope shape (locked):**
  ```ts
  type ApiResponse<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

  type ApiListResponse<T> = { ok: true; data: T[]; nextPageToken: string | null };
  ```

  **Invariant:** `ok: false` envelopes are NEVER returned with a 2xx HTTP status. HTTP status is the source of truth; the envelope `code` is an orthogonal stable identifier for client branching.

- **Error codes:** a small enum of stable string codes — `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `PAGE_EXPIRED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`. Input-validation failures use `BAD_REQUEST` today; `VALIDATION_FAILED` is intentionally omitted until it has a real caller (non-breaking to add later).

**Alternatives considered:** RFC 7807 Problem+JSON was rejected because it encodes errors but not successes — a split contract (plain body on success, Problem+JSON on error) is what we're moving AWAY from. A nested `{ meta, data }` envelope was rejected because it buries the discriminant one level deeper without adding information this codebase uses. The flat discriminated union is the simplest shape that lets TypeScript narrow on `body.ok`.

---

## Design note: scope-constrained pagination (READ THIS FIRST)

**This package does not implement true seek-based cursor pagination.** It implements **in-memory page-based pagination with an opaque page token**, and it's scoped to the API layer only.

Why: Package B's scope is `server/api/**` and may not modify `server/db/**`. Every list-endpoint repository sorts by a non-`id` column (`updated_at DESC`, `confidence DESC`, `scene_order`, `chapter_number`, `version DESC`, `created_at DESC`, …). True seek-based pagination requires repository-level `LIMIT ... WHERE (orderKey, id) > (?, ?)` queries against those orderings, plus appropriate composite indexes — work that belongs to Package A (DB hardening) or a dedicated follow-up, not here.

What B *does* deliver:

1. **A stable API-shape contract.** The wire format is `{ ok: true, data, nextPageToken }`, where `nextPageToken` is an opaque string. Clients never introspect it. When the repository layer is later rewritten to do real seek-based paging, the token's internal encoding changes and no client code moves.
2. **Opaque tokens today encode an offset** plus a `total` counter for weak expired-page detection (see below). This is honest offset pagination wearing an opaque-token jacket — not cursor pagination. **The plan never uses the word "cursor" in wire-format or helper names.**
3. **List endpoints still load full result sets from SQLite and slice in memory.** At current data volumes (local SQLite, single-user, small projects), this is fine. It is NOT fine for growth and is tracked as a follow-up.

**Weak concurrent-mutation detection (`PAGE_EXPIRED`).** Because we're slicing in memory against a non-monotonic ordering, rows inserted or deleted between page fetches can cause skip/duplicate. We cannot *prevent* that without repository changes, but we can *detect "the world moved"*: the page token carries `{ offset, total }` where `total` is the full result count at the moment the previous page was computed. When the next request arrives, the endpoint re-counts; if `total` differs, it returns `400 { ok: false, error: { code: "PAGE_EXPIRED", message: "Result set changed; refetch from page 1" } }`. The client handles `PAGE_EXPIRED` by discarding its accumulated pages and refetching from `nextPageToken = null`.

This is a **weak** guard: two opposite mutations (one insert + one delete) net-zero the `total` and go undetected. Document that limitation in the `pagination.ts` module header.

**Follow-up issue to file after B lands:** `server/db/**`-level seek-based pagination on the 5 highest-volume list endpoints (candidates: chunks, audit-flags, learned-patterns, compilation-logs, IRs). Label p2. B's opaque-token contract is specifically designed so that follow-up is a server-internal rewrite with no client churn.

---

## Scope boundary

This package may modify / create files under:

- `server/api/**` — including the existing `server/api/routes.ts` and two new files `server/api/envelope.ts`, `server/api/pagination.ts`.
- `src/api/**` — including the existing `src/api/client.ts` and a new `src/api/errors.ts`.
- `src/app/**` — **list-helper callers only** (see B-I22 below). The existing `apiListXxx(): Promise<T[]>` signatures change to `apiListXxx(page?: PageRequest): Promise<Page<T>>`; every consumer must be updated. Scope-cross with Package D is provably empty: D is scoped to `src/app/components/DraftStage*` only, and no list-helper caller lives under `DraftStage*` (verify by grep before editing — see Task 2 Step 0).
- `tests/server/routes/**` — update existing assertions to the new envelope; add new pagination cases.
- `tests/server/api/**` — new test files for `envelope.ts` and `pagination.ts`.
- `tests/api/**` — update `tests/api/client.test.ts` to assert envelope handling and `ApiError` behavior; create `tests/api/errors.test.ts`.

It may NOT modify:
- `server/db/**` (Package A's territory)
- `server/proxy.ts`
- `server/middleware.ts`
- `src/app/components/DraftStage*` (Package D's territory)
- any `src/app/**` file that does not call a list helper
- any other `tests/**` subdirectory

**If a `src/app/**` edit outside a list-helper caller becomes unavoidable, STOP and escalate.**

---

## Coordination with Package E (READ THIS SECOND)

Package E (`#36`, test coverage gaps) is running in parallel and is writing NEW tests under `tests/**` against the pre-B API shape (bare arrays, `{ error }` objects, 204 on DELETE). When B merges, E's new assertions will break.

**Protocol:**

- [ ] **Before starting Task 1**, run:
  ```bash
  git fetch origin
  git log origin/main --since='2 days ago' -- tests/
  ```
  If commits touching `tests/server/routes/**` or `tests/api/**` have landed since this plan was written, list them and inspect each with `git show --stat <sha>`.

- [ ] If E has landed, rebase onto `origin/main` before editing anything.
- [ ] Package E **owns** the test files for the voice-guide and writing-samples route endpoints. **B's implementer DOES NOT create `tests/server/routes/voice-guide.test.ts` or `tests/server/routes/writing-samples.test.ts`.** If those files exist at rebase time (because E landed), B updates them to the new envelope + pagination shape as part of its route-test pass. If they don't exist yet, B skips them; they'll be updated by E in its own PR, or by a post-merge fixup.
- [ ] **Concrete update script.** After rebasing (or before the final commit), run this to find every assertion that reads the old shape:

  ```bash
  # Assertions reading old top-level keys off res.body
  grep -rnE 'res\.body\.(error|guide|bible|project|chapter|scene|chunk|flag|ir|log|pattern|proposal|sample)\b' tests/server/routes/ tests/api/

  # Assertions expecting 204 no-content
  grep -rnE '\.status\(204\)|toBe\(204\)' tests/server/routes/ tests/api/

  # Assertions expecting a bare array body
  grep -rnE '\.toEqual\(\[' tests/server/routes/ tests/api/
  ```

  Each grep catches a different failure mode:
  - First: code that read `res.body.<key>` directly — must become `res.body.data.<key>` (or use an `unwrap` helper).
  - Second: code that asserted `204 No Content` on DELETEs — under B, DELETEs still return 204 (see B-C3 below), so these assertions STAY. Any matches are sanity — flag ones that expected 200.
  - Third: code that asserted the body IS a bare array — must become `res.body.data` equals the array.

- [ ] **`unwrap` helper coordination.** If Package E adds `tests/helpers/unwrap.ts` (a single-file helper that normalizes `res.body` into the envelope's `data`), B updates `unwrap.ts`'s implementation rather than the individual call-sites. This is a ~30-to-1 reduction in touched files. If the helper exists at rebase time, use it. If not, the grep script above shows the individual sites.
- [ ] In the B PR description, state the coordination status: "Package E status at PR open: [landed | not yet landed]; `unwrap` helper: [present | absent]." Reviewers must check this.

---

## DELETE responses stay 204

The previous revision of this plan changed `DELETE /writing-samples/:id` from `204 No Content` to `200 + envelope body`. That change is **dropped**. DELETE endpoints continue to return 204 with no body. The envelope contract is "successful responses with a body are envelope-shaped"; a 204 has no body by definition and does not violate the contract.

Instead, the client's `fetchJson` handles 204 as a valid non-envelope response:

```ts
if (res.status === 204) {
  return undefined as unknown as T;
}
```

(With a comment explaining why: DELETE endpoints intentionally return 204; the envelope requires a body only when there IS a body.) `apiDeleteWritingSample` returns `Promise<void>`. No "breaking change" framing anywhere.

---

## Shared design reference (keep open while implementing)

```ts
// Canonical envelope types (server + client both import)
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: ApiErrorCode; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
export type ApiListResponse<T> = { ok: true; data: T[]; nextPageToken: string | null };

// Stable error codes
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAGE_EXPIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";
```

Default `limit` = 50. Maximum `limit` = 200. Invalid `?limit=` values (`abc`, `0`, `-5`, `1.5`) return `400 BAD_REQUEST`. Missing or empty `?limit=` falls back to the default. Invalid `?pageToken=` (non-base64url, non-JSON, or wrong shape) returns `400 BAD_REQUEST`. Expired page tokens (`total` mismatch) return `400 PAGE_EXPIRED`.

---

## Task 1: Server envelope helpers + route rollout (#29)

Task 1 is split into domain sub-tasks so each commit is small, each step has a real failing-test → passing-test cycle, and the intermediate tree is never red.

**Commit-shape rule:** from the very first domain rewrite, list endpoints return `okList(list, null)` — a full list-envelope with `nextPageToken: null`. This keeps the wire shape compliant at every intermediate commit. Task 3 later replaces the `null` with a real token and adds slicing.

### Step 1: Coordination check

- [ ] **Step 1.1:** Run the fetch from the coordination section. Record result in the PR description.

### Step 2: Envelope helper + its tests (TDD)

- [ ] **Step 2.1: Write failing tests for `envelope.ts`**

Create `tests/server/api/envelope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { err, ok, okList, statusFor, type ApiErrorCode } from "../../../server/api/envelope.js";

describe("envelope helpers", () => {
  it("ok() wraps data in { ok: true, data }", () => {
    expect(ok({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });

  it("okList() wraps data + nextPageToken", () => {
    expect(okList([1, 2], null)).toEqual({ ok: true, data: [1, 2], nextPageToken: null });
    expect(okList([1, 2], "tok")).toEqual({ ok: true, data: [1, 2], nextPageToken: "tok" });
  });

  it("err() wraps code and message in { ok: false, error }", () => {
    const code: ApiErrorCode = "NOT_FOUND";
    expect(err(code, "nope")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "nope" },
    });
  });

  it("statusFor maps every known code to an HTTP status", () => {
    expect(statusFor("NOT_FOUND")).toBe(404);
    expect(statusFor("BAD_REQUEST")).toBe(400);
    expect(statusFor("CONFLICT")).toBe(409);
    expect(statusFor("PAGE_EXPIRED")).toBe(400);
    expect(statusFor("UPSTREAM_UNAVAILABLE")).toBe(502);
    expect(statusFor("INTERNAL")).toBe(500);
  });
});
```

- [ ] **Step 2.2: Run and confirm module-not-found failure**

```bash
pnpm test -- tests/server/api/envelope.test.ts
```

- [ ] **Step 2.3: Implement `server/api/envelope.ts`**

```ts
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAGE_EXPIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: ApiErrorCode; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
export type ApiListResponse<T> = { ok: true; data: T[]; nextPageToken: string | null };

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function okList<T>(data: T[], nextPageToken: string | null): ApiListResponse<T> {
  return { ok: true, data, nextPageToken };
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
    case "CONFLICT":
      return 409;
    case "PAGE_EXPIRED":
      return 400;
    case "UPSTREAM_UNAVAILABLE":
      return 502;
    case "INTERNAL":
      return 500;
  }
}
```

- [ ] **Step 2.4: Confirm green**

```bash
pnpm test -- tests/server/api/envelope.test.ts
```

- [ ] **Step 2.5: Commit**

```bash
git add server/api/envelope.ts tests/server/api/envelope.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add unified response envelope helpers

Introduces server/api/envelope.ts with ok(), okList(), err(), and
statusFor() helpers and the canonical ApiResponse / ApiListResponse
types. No route handlers use these yet; the domain-by-domain rollout
starts in the next commits.

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Step 3: Domain-by-domain route rewrites (TDD per domain)

Each sub-task below is its own TDD cycle against exactly one domain's tests:

1. Update the existing domain test file to assert the new envelope shape (test is now red).
2. Rewrite the handlers for that domain in `server/api/routes.ts` (still red, or partial).
3. Run the domain test file; expect green.
4. Run `pnpm typecheck`.
5. Commit the domain.

**Shared prelude** (done once at the start of Step 3, in the same commit as the first domain — Projects):

Add to the top of `server/api/routes.ts`:

```ts
import { err, ok, okList, statusFor, type ApiErrorCode } from "./envelope.js";
import { createLogger } from "../lib/logger.js";
import type express from "express"; // if not already pulled in via Router

const log = createLogger("api");

function notFound(res: express.Response, message: string): void {
  res.status(statusFor("NOT_FOUND")).json(err("NOT_FOUND", message));
}
function badRequest(res: express.Response, message: string): void {
  res.status(statusFor("BAD_REQUEST")).json(err("BAD_REQUEST", message));
}
function conflict(res: express.Response, message: string): void {
  res.status(statusFor("CONFLICT")).json(err("CONFLICT", message));
}
function internal(res: express.Response, message: string): void {
  res.status(statusFor("INTERNAL")).json(err("INTERNAL", message));
}
function upstream(res: express.Response, message: string): void {
  res.status(statusFor("UPSTREAM_UNAVAILABLE")).json(err("UPSTREAM_UNAVAILABLE", message));
}
```

**Logger policy:** `createLogger("api")` is wired for NEW log statements only (e.g., logging a page-token decode failure). Do NOT replace any existing `console.*` — Package F2 owns that sweep.

Each domain's "list endpoint temporary shape" uses `res.json(okList(list, null))`. Task 3 replaces the `null` with a real token.

For id-mismatch PUT handlers (`PUT /chapters/:id`, `PUT /scenes/:id`, `PUT /chunks/:id`, `PUT /scenes/:sceneId/ir`), use `conflict(res, "URL id and body id do not match")` — this is HTTP 409, which is the correct semantic status for a resource identity conflict.

#### Sub-task 3A: Projects domain

Files: `server/api/routes.ts` (projects routes only), `tests/server/routes/projects.test.ts`.

- [ ] **Step 3A.1:** Update every `res.body` assertion in `tests/server/routes/projects.test.ts` to the envelope shape (`{ ok: true, data: X }` on success, `{ ok: false, error: { code, message } }` on failure). Add one regression assertion per describe block confirming `res.body.ok === true` on success and `res.body.error.code === "NOT_FOUND"` on 404. Run the file; expect red.
- [ ] **Step 3A.2:** Rewrite handlers in `server/api/routes.ts`:
  - `GET /projects` → `res.json(okList(list, null))`
  - `GET /projects/:id` → `res.json(ok(project))`; 404 → `notFound(res, "Project not found")`
  - `POST /projects` → `res.status(201).json(ok(project))`
  - `PATCH /projects/:id` → `res.json(ok(project))`; 404 → `notFound`
  - `DELETE /projects/:id` → currently returns `res.json({ ok: true })` — keep the 200 status but return `res.json(ok({ deleted: true }))`; 404 → `notFound`
- [ ] **Step 3A.3:** `pnpm test -- tests/server/routes/projects.test.ts` → green.
- [ ] **Step 3A.4:** `pnpm typecheck`.
- [ ] **Step 3A.5:** Commit.

```bash
git add server/api/routes.ts tests/server/routes/projects.test.ts
git commit -m "feat(api): wrap projects routes in unified envelope (part of #29)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

#### Sub-task 3B: Bibles domain

- [ ] **Step 3B.1:** Update `tests/server/routes/bibles.test.ts` assertions.
- [ ] **Step 3B.2:** Handlers:
  - `GET /projects/:projectId/bibles/latest` → `ok(bible)`; 404 → `notFound`
  - `GET /projects/:projectId/bibles/:version` → `ok(bible)`; 404 → `notFound`
  - `GET /projects/:projectId/bibles` → `okList(list, null)`
  - `POST /projects/:projectId/bibles` → `res.status(201).json(ok(bible))`
- [ ] **Step 3B.3–5:** Run, typecheck, commit.

#### Sub-task 3C: Chapter Arcs domain

- [ ] **Step 3C.1:** Update `tests/server/routes/chapter-arcs.test.ts`.
- [ ] **Step 3C.2:** Handlers:
  - `GET /projects/:projectId/chapters` → `okList(list, null)`
  - `GET /chapters/:id` → `ok(arc)`; 404 → `notFound`
  - `POST /chapters` → `res.status(201).json(ok(arc))`
  - `PUT /chapters/:id` → `ok(arc)`; id-mismatch → `conflict(...)`
- [ ] **Step 3C.3–5:** Run, typecheck, commit.

#### Sub-task 3D: Scene Plans domain

- [ ] **Step 3D.1:** Update `tests/server/routes/scene-plans.test.ts`.
- [ ] **Step 3D.2:** Handlers:
  - `GET /chapters/:chapterId/scenes` → `okList(list, null)`
  - `GET /scenes/:id` → `ok(result)`; 404 → `notFound`
  - `POST /scenes` → `res.status(201).json(ok(created))`
  - `PUT /scenes/:id` → `ok(updated)`; id-mismatch → `conflict`
  - `PATCH /scenes/:id/status` → `ok({ updated: true })`; 404 → `notFound`
- [ ] **Step 3D.3–5:** Run, typecheck, commit.

#### Sub-task 3E: Chunks domain

- [ ] **Step 3E.1:** Update `tests/server/routes/chunks.test.ts`.
- [ ] **Step 3E.2:** Handlers:
  - `GET /scenes/:sceneId/chunks` → `okList(list, null)`
  - `GET /chunks/:id` → `ok(chunk)`; 404 → `notFound`
  - `POST /chunks` → `res.status(201).json(ok(chunk))`
  - `PUT /chunks/:id` → `ok(chunk)`; id-mismatch → `conflict`
  - `DELETE /chunks/:id` → **preserve existing behavior**; if currently 200 with `{ ok: true }`, switch to `ok({ deleted: true })`; if currently 204, leave as `res.status(204).end()`
- [ ] **Step 3E.3–5:** Run, typecheck, commit.

#### Sub-task 3F: Audit Flags domain

- [ ] **Step 3F.1:** Update `tests/server/routes/audit-flags.test.ts`.
- [ ] **Step 3F.2:** Handlers:
  - `GET /scenes/:sceneId/audit-flags` → `okList(list, null)`
  - `POST /audit-flags` (array + single branches) → `res.status(201).json(ok(flags))` / `...ok(flag)`
  - `PATCH /audit-flags/:id/resolve` → `ok({ resolved: true })`; 404 → `notFound`
  - `GET /scenes/:sceneId/audit-stats` → `ok(stats)` (scalar, not list)
- [ ] **Step 3F.3–5:** Run, typecheck, commit.

#### Sub-task 3G: Narrative IRs domain

- [ ] **Step 3G.1:** Update `tests/server/routes/narrative-irs.test.ts`.
- [ ] **Step 3G.2:** Handlers:
  - `GET /scenes/:sceneId/ir` → `ok(ir)`; 404 → `notFound`
  - `POST /scenes/:sceneId/ir` → `res.status(201).json(ok(ir))`
  - `PUT /scenes/:sceneId/ir` → `ok(ir)`; id-mismatch → `conflict`
  - `PATCH /scenes/:sceneId/ir/verify` → `ok({ verified: true })`; 404 → `notFound`
  - `GET /chapters/:chapterId/irs` → `okList(list, null)`
  - `GET /chapters/:chapterId/irs/verified` → `okList(list, null)`
- [ ] **Step 3G.3–5:** Run, typecheck, commit.

#### Sub-task 3H: Compilation Logs domain

- [ ] **Step 3H.1:** Update `tests/server/routes/compilation-logs.test.ts`.
- [ ] **Step 3H.2:** Handlers:
  - `POST /compilation-logs` → `res.status(201).json(ok(log))`
  - `GET /compilation-logs/:id` → `ok(log)`; 404 → `notFound`
  - `GET /chunks/:chunkId/compilation-logs` → `okList(list, null)`
- [ ] **Step 3H.3–5:** Run, typecheck, commit.

#### Sub-task 3I: Learner domain (edit-patterns + learned-patterns)

- [ ] **Step 3I.1:** Update `tests/server/routes/learner.test.ts`.
- [ ] **Step 3I.2:** Handlers:
  - `GET /projects/:projectId/edit-patterns` → `okList(list, null)`
  - `GET /scenes/:sceneId/edit-patterns` → `okList(list, null)`
  - `POST /edit-patterns` → `res.status(201).json(ok(patterns))`
  - `GET /projects/:projectId/learned-patterns` → `okList(list, null)`
  - `POST /learned-patterns` → `res.status(201).json(ok(pattern))`
  - `PATCH /learned-patterns/:id/status` → `ok({ updated: true })`; 404 → `notFound`
- [ ] **Step 3I.3–5:** Run, typecheck, commit.

#### Sub-task 3J: Profile Adjustments domain

Domain test file: reuses `tests/server/routes/learner.test.ts` (profile-adjustments live there today) OR `tests/server/routes-ensure-project.test.ts`, depending on where the existing cases live. Run `grep -rn "profile-adjustments" tests/server/routes*` to locate before editing.

- [ ] **Step 3J.1:** Update the located test file.
- [ ] **Step 3J.2:** Handlers:
  - `GET /projects/:projectId/profile-adjustments` → `okList(list, null)`
  - `POST /profile-adjustments` → `res.status(201).json(ok(proposal))`
  - `PATCH /profile-adjustments/:id/status` → `ok({ updated: true })`; 404 → `notFound`
- [ ] **Step 3J.3–5:** Run, typecheck, commit.

#### Sub-task 3K: Voice Guide domain

Test file: If Package E has landed and created `tests/server/routes/voice-guide.test.ts`, update it. Otherwise, the pre-existing coverage (if any) lives ad-hoc — grep for `"/voice-guide"` inside `tests/server/` and update whatever you find. **Do not create a new test file for voice-guide; that belongs to Package E.**

- [ ] **Step 3K.1:** Update whatever voice-guide assertions exist (or skip if none).
- [ ] **Step 3K.2:** Handlers:
  - `GET /voice-guide` → `ok({ guide })` (preserves the existing `{ guide }` object shape inside `data`)
  - `POST /voice-guide/generate` → `badRequest` for empty `sampleIds`; `notFound` for missing samples; `upstream` for missing Anthropic client; `res.status(201).json(ok(guide))` on success; caught exception → `internal(res, message)`
  - `GET /voice-guide/versions` → `okList(list, null)`
- [ ] **Step 3K.3–5:** Run, typecheck, commit.

#### Sub-task 3L: Writing Samples domain

Test file: Same coordination as voice-guide. **Do not create `tests/server/routes/writing-samples.test.ts`; Package E owns it.**

- [ ] **Step 3L.1:** Update existing assertions (or skip if none).
- [ ] **Step 3L.2:** Handlers:
  - `GET /writing-samples` → `okList(list, null)`
  - `POST /writing-samples` → `res.status(201).json(ok(created))`
  - `DELETE /writing-samples/:id` → **stays 204 no-body**; 404 → `notFound`
- [ ] **Step 3L.3–5:** Run, typecheck, commit.

#### Sub-task 3M: CIPHER + project-voice-guide + ensure-project

Test file: `tests/server/routes-ensure-project.test.ts` plus any ad-hoc CIPHER tests.

- [ ] **Step 3M.1:** Update the assertions.
- [ ] **Step 3M.2:** Handlers:
  - `POST /projects/:projectId/significant-edits` → `res.status(201).json(ok({ count }))`
  - `POST /projects/:projectId/cipher/batch` → `upstream` for missing client; short-circuit → `ok({ statement: null })`; success → `res.status(201).json(ok({ statement, ring1Injection }))`; catch → `internal`
  - `GET /projects/:projectId/project-voice-guide` → `ok({ guide })`
  - `POST /projects/:projectId/voice/redistill` → `upstream` missing client; skipped → `ok({ ring1Injection: "", skipped: true })`; success → `ok({ ring1Injection })`; catch → `internal`
  - `POST /projects/:projectId/project-voice-guide/update` → `upstream` missing client; success → `res.status(201).json(ok({ projectGuide, ring1Injection }))`; catch → `internal`
- [ ] **Step 3M.3–5:** Run, typecheck, commit.

### Step 4: Full-suite gate for Task 1

- [ ] **Step 4.1:** Run `pnpm test -- tests/server/routes tests/server/routes-ensure-project.test.ts tests/server/api/envelope.test.ts`. Expect green.
- [ ] **Step 4.2:** Grep `server/api/routes.ts` for leftover bare responses:

  ```bash
  grep -nE 'res\.(json|status)\(' server/api/routes.ts | grep -vE 'ok\(|okList\(|err\(|notFound\(|badRequest\(|conflict\(|internal\(|upstream\(|status\(204\)'
  ```

  Expect no matches (or only deliberate exceptions that you've documented inline).

The client test suite (`tests/api/client.test.ts`) is still asserting the OLD shape at this point. We do NOT leave main red at an intermediate commit: Task 1's final domain commit (or a separate "client fixtures bridge" commit inside Task 1) pre-wraps the `tests/api/client.test.ts` mocks to the new envelope shape against the CURRENT naive client. Task 2 then rewrites the client itself on top of already-envelope-shaped fixtures.

### Step 5: Client test fixtures bridge commit

One commit, bundled at the end of Task 1.

- [ ] **Step 5.1:** In `tests/api/client.test.ts`, find every `mockResolvedValue({ ok: true, status: 200, json: async () => BODY })` where `BODY` is the pre-envelope shape, and wrap `BODY` in `{ ok: true, data: BODY }`. For list-endpoint mocks, wrap as `{ ok: true, data: BODY, nextPageToken: null }`. For error-body mocks, change to `{ ok: false, error: { code: <CODE>, message: <MESSAGE> } }` with the appropriate HTTP status on the outer response.

  Concrete examples (apply this pattern across the file):

  ```ts
  // Before:
  mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "p1", title: "T" }) });
  // After:
  mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { id: "p1", title: "T" } }) });

  // Before:
  mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: "a" }, { id: "b" }] });
  // After:
  mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: [{ id: "a" }, { id: "b" }], nextPageToken: null }) });

  // Before:
  mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Project not found" }) });
  // After:
  mockResolvedValue({ ok: false, status: 404, json: async () => ({ ok: false, error: { code: "NOT_FOUND", message: "Project not found" } }) });
  ```

  The current naive `fetchJson` does `return res.json()`, so after wrapping, call-sites in the test that do `expect(result).toEqual(<old shape>)` must become `expect(result.data).toEqual(<old shape>)`. Do this peel as part of the same commit — it's mechanical.

- [ ] **Step 5.2:** Run `pnpm check-all`. Expect green.
- [ ] **Step 5.3:** Commit.

```bash
git add tests/api/client.test.ts
git commit -m "$(cat <<'EOF'
test(api): pre-wrap client test fixtures in envelope shape

Bridges Task 1's server-side envelope rollout into Task 2's client
rewrite: the client fixtures now return { ok: true, data, ... } /
{ ok: false, error } bodies against the still-naive fetchJson. Call
sites peel .data manually; Task 2 reshapes fetchJson so the peel
disappears. Keeps the intermediate tree green.

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Client wrapper + `ApiError` (#29 continued)

**Files:**
- Create: `src/api/errors.ts`, `tests/api/errors.test.ts`
- Modify: `src/api/client.ts`, `tests/api/client.test.ts`
- Modify: list-helper callers under `src/app/**` (see Step 0)

### Step 0: Verify the `src/app/**` intersection with Package D is empty

- [ ] **Step 0.1:** Enumerate all list-helper callers:

```bash
grep -rnE 'apiList(Projects|BibleVersions|ChapterArcs|ScenePlans|Chunks|AuditFlags|ChapterIRs|VerifiedChapterIRs|ProfileAdjustments|VoiceGuideVersions|WritingSamples|EditPatterns|EditPatternsForScene|LearnedPatterns|CompilationLogs)' src/app/
```

- [ ] **Step 0.2:** Confirm zero matches under `src/app/components/DraftStage*`. If any exist, STOP and escalate — the intersection with Package D is non-empty and the plan's scope claim is wrong.

### Step 1: `ApiError` class (TDD)

- [ ] **Step 1.1:** Create `tests/api/errors.test.ts`:

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

  it("accepts optional cause, requestId, and body", () => {
    const rootCause = new Error("boom");
    const e = new ApiError("UNKNOWN", "wrap", 500, {
      cause: rootCause,
      requestId: "req-123",
      body: { garbage: true },
    });
    expect(e.cause).toBe(rootCause);
    expect(e.requestId).toBe("req-123");
    expect(e.body).toEqual({ garbage: true });
  });

  it("is throwable and catchable as a standard Error", () => {
    try {
      throw new ApiError("INTERNAL", "boom", 500);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
```

- [ ] **Step 1.2:** Confirm failure, then implement `src/api/errors.ts`:

```ts
export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAGE_EXPIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL"
  | "UNKNOWN";

export interface ApiErrorInit {
  cause?: unknown;
  requestId?: string;
  body?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, init?: ApiErrorInit) {
    super(message, init?.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = init?.requestId;
    this.body = init?.body;
  }
}
```

`UNKNOWN` is a client-only fallback for malformed / unexpected bodies. The server never emits it.

- [ ] **Step 1.3:** Confirm green.

### Step 2: Reshape `fetchJson` + introduce `fetchList`

- [ ] **Step 2.1:** Add envelope-handling tests to `tests/api/client.test.ts`:

```ts
import { ApiError } from "@/api/errors";

describe("fetchJson envelope handling", () => {
  it("returns .data from { ok: true, data }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true, data: { id: "p1", title: "Test" } }),
    }) as unknown as typeof fetch;

    const result = await apiGetProject("p1");
    expect(result).toEqual({ id: "p1", title: "Test" });
  });

  it("returns undefined for 204 responses (DELETE path)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => { throw new Error("no body"); },
    }) as unknown as typeof fetch;

    await expect(apiDeleteWritingSample("x")).resolves.toBeUndefined();
  });

  it("throws ApiError with code/message/status on { ok: false, error }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "req-42" },
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
      requestId: "req-42",
    });
  });

  it("throws ApiError with code UNKNOWN when body is not a recognized envelope", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => "not-an-object",
    }) as unknown as typeof fetch;

    await expect(apiGetProject("x")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNKNOWN",
      status: 500,
    });
  });

  it("populates ApiError.cause when fetch throws", async () => {
    const rootCause = new TypeError("network down");
    globalThis.fetch = vi.fn().mockRejectedValue(rootCause) as unknown as typeof fetch;
    const p = apiGetProject("x").catch((e) => e);
    const e = await p;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe("UNKNOWN");
    expect((e as ApiError).cause).toBe(rootCause);
  });

  it("returns { data, nextPageToken } from fetchList", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        ok: true,
        data: [{ id: "a" }, { id: "b" }],
        nextPageToken: "tok-1",
      }),
    }) as unknown as typeof fetch;

    const page = await apiListProjects({ limit: 50 });
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextPageToken).toBe("tok-1");
  });
});
```

- [ ] **Step 2.2:** Rewrite `src/api/client.ts`:

```ts
import { ApiError, type ApiErrorCode } from "./errors.js";

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

type ListEnvelope<T> = { ok: true; data: T[]; nextPageToken: string | null };

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
  return isOkEnvelope<T[]>(body) && "nextPageToken" in (body as object);
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function requestIdOf(res: Response): string | undefined {
  return res.headers.get("x-request-id") ?? undefined;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (caught) {
    throw new ApiError("UNKNOWN", "Network error", 0, { cause: caught });
  }

  // DELETE endpoints return 204 No Content with no body. Envelope contract
  // only applies when a body exists.
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(
      body.error.code as ApiErrorCode,
      body.error.message,
      res.status,
      { body, requestId: requestIdOf(res) },
    );
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (isOkEnvelope<T>(body)) {
    return body.data;
  }
  throw new ApiError("UNKNOWN", "Malformed API response", res.status, {
    body,
    requestId: requestIdOf(res),
  });
}

export interface PageRequest {
  limit?: number;
  pageToken?: string | null;
}

export interface Page<T> {
  data: T[];
  nextPageToken: string | null;
}

async function fetchList<T>(url: string, page?: PageRequest, init?: RequestInit): Promise<Page<T>> {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set("limit", String(page.limit));
  if (page?.pageToken) params.set("pageToken", page.pageToken);
  const sep = url.includes("?") ? "&" : "?";
  const full = params.toString() ? `${url}${sep}${params.toString()}` : url;

  let res: Response;
  try {
    res = await fetch(full, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (caught) {
    throw new ApiError("UNKNOWN", "Network error", 0, { cause: caught });
  }

  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(
      body.error.code as ApiErrorCode,
      body.error.message,
      res.status,
      { body, requestId: requestIdOf(res) },
    );
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (isListEnvelope<T>(body)) {
    return { data: body.data, nextPageToken: body.nextPageToken };
  }
  throw new ApiError("UNKNOWN", "Malformed list response", res.status, {
    body,
    requestId: requestIdOf(res),
  });
}
```

### Step 3: Migrate list helpers (single signature, not a sibling pair)

Per B-I22: rather than leave two parallel signatures forever, we migrate each helper in place. Every consumer under `src/app/**` gets updated in the same step.

**Generic factory** (declare once, use everywhere):

```ts
function createListHelper<T>(pathFn: () => string): (page?: PageRequest) => Promise<Page<T>> {
  return (page) => fetchList<T>(pathFn(), page);
}

function createParamListHelper<T, P extends unknown[]>(
  pathFn: (...args: P) => string,
): (...args: [...P, PageRequest?]) => Promise<Page<T>> {
  return (...args) => {
    const page = args[args.length - 1];
    const pageIsReq = typeof page === "object" && page !== null && !Array.isArray(page);
    const pathArgs = (pageIsReq ? args.slice(0, -1) : args) as P;
    return fetchList<T>(pathFn(...pathArgs), pageIsReq ? (page as PageRequest) : undefined);
  };
}
```

- [ ] **Step 3.1:** Rewrite each list helper to return `Promise<Page<T>>`:

  - [ ] `apiListProjects(page?)` → `${BASE}/projects`
  - [ ] `apiListBibleVersions(projectId, page?)` → `${BASE}/projects/${projectId}/bibles`
  - [ ] `apiListChapterArcs(projectId, page?)` → `${BASE}/projects/${projectId}/chapters`
  - [ ] `apiListScenePlans(chapterId, page?)` → `${BASE}/chapters/${chapterId}/scenes`
  - [ ] `apiListChunks(sceneId, page?)` → `${BASE}/scenes/${sceneId}/chunks`
  - [ ] `apiListAuditFlags(sceneId, page?)` → `${BASE}/scenes/${sceneId}/audit-flags`
  - [ ] `apiListChapterIRs(chapterId, page?)` → `${BASE}/chapters/${chapterId}/irs`
  - [ ] `apiListVerifiedChapterIRs(chapterId, page?)` → `${BASE}/chapters/${chapterId}/irs/verified`
  - [ ] `apiListCompilationLogs(chunkId, page?)` → `${BASE}/chunks/${chunkId}/compilation-logs`
  - [ ] `apiListEditPatterns(projectId, page?)` → `${BASE}/projects/${projectId}/edit-patterns`
  - [ ] `apiListEditPatternsForScene(sceneId, page?)` → `${BASE}/scenes/${sceneId}/edit-patterns`
  - [ ] `apiListLearnedPatterns(projectId, status?, page?)` — status becomes a query param on the path, page is a separate arg
  - [ ] `apiListProfileAdjustments(projectId, status?, page?)` — same pattern
  - [ ] `apiListVoiceGuideVersions(page?)` → `${BASE}/voice-guide/versions`
  - [ ] `apiListWritingSamples(page?)` → `${BASE}/writing-samples`

- [ ] **Step 3.2:** Special-case helpers:

  - `apiGetVoiceGuide` — reads `.guide` off `data` (server returns `{ ok: true, data: { guide } }`; `fetchJson` returns `{ guide }`). Existing `.guide` read continues to work.
  - `apiGetProjectVoiceGuide` — same.
  - `apiStoreSignificantEdit` — reads `.count` off `data`. Works.
  - `apiFireBatchCipher` — existing `"statement" in data && data.statement === null` branch works.
  - `apiDeleteWritingSample` — rewrite:

    ```ts
    export async function apiDeleteWritingSample(id: string): Promise<void> {
      await fetchJson<void>(`${BASE}/writing-samples/${id}`, { method: "DELETE" });
    }
    ```

    (204 path inside `fetchJson` returns `undefined`.)

- [ ] **Step 3.3:** Update every list-helper caller under `src/app/**`. Using the enumeration from Step 0:

  - For each caller, change `const items = await apiListX(args)` to `const { data: items } = await apiListX(args)` OR `const page = await apiListX(args); const items = page.data;`, whichever reads better in context. Callers that only care about the array keep using `data`.
  - Callers that want pagination pass `{ limit, pageToken }` as the trailing argument and retain `page.nextPageToken` for the "load more" button (no such UI exists today — every current caller just wants the array).

- [ ] **Step 3.4:** `pnpm check-all` — expect green across lint, typecheck, unit tests, and the Svelte store suites.
- [ ] **Step 3.5:** Commit.

```bash
git add src/api/client.ts src/api/errors.ts tests/api/errors.test.ts tests/api/client.test.ts src/app
git commit -m "$(cat <<'EOF'
feat(api): client unwraps envelope, throws typed ApiError, migrates list helpers

fetchJson now recognizes the unified envelope: on { ok: true, data }
it returns .data; on { ok: false, error } it throws ApiError carrying
code, message, HTTP status, optional cause (via ES2022 Error.cause),
request id, and parsed body. Malformed bodies surface as ApiError
with code "UNKNOWN". 204 responses (DELETE path) resolve to undefined.

Every list helper migrates in place to Promise<Page<T>>; every caller
under src/app/** is updated in the same commit to consume the new
shape. apiDeleteWritingSample returns Promise<void>.

Part of #29.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: In-memory paginated list responses (#30)

**Files:**
- Create: `server/api/pagination.ts`
- Create: `tests/server/api/pagination.test.ts`
- Modify: `server/api/routes.ts`
- Modify: `tests/server/routes/*.test.ts` (add pagination assertions for list endpoints)

### Step 1: Pagination helper (TDD)

- [ ] **Step 1.1:** Create `tests/server/api/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodePageToken,
  encodePageToken,
  paginate,
  parseLimit,
  parseListQuery,
} from "../../../server/api/pagination.js";

describe("parseLimit", () => {
  it("returns DEFAULT when missing or empty", () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(parseLimit("")).toBe(DEFAULT_LIMIT);
  });

  it("rejects non-numeric", () => {
    expect(() => parseLimit("abc")).toThrow(/invalid limit/i);
  });

  it("rejects zero and negative", () => {
    expect(() => parseLimit("0")).toThrow(/invalid limit/i);
    expect(() => parseLimit("-5")).toThrow(/invalid limit/i);
  });

  it("rejects non-integer", () => {
    expect(() => parseLimit("1.5")).toThrow(/invalid limit/i);
  });

  it("caps at MAX_LIMIT", () => {
    expect(parseLimit("10000")).toBe(MAX_LIMIT);
  });

  it("passes through valid limits", () => {
    expect(parseLimit("25")).toBe(25);
  });
});

describe("encodePageToken / decodePageToken", () => {
  it("roundtrips { offset, total }", () => {
    const tok = encodePageToken({ offset: 10, total: 42 });
    expect(decodePageToken(tok)).toEqual({ offset: 10, total: 42 });
  });

  it("decodePageToken returns null for null/undefined/empty", () => {
    expect(decodePageToken(null)).toBeNull();
    expect(decodePageToken(undefined)).toBeNull();
    expect(decodePageToken("")).toBeNull();
  });

  it("throws on malformed base64", () => {
    expect(() => decodePageToken("!!!not-base64!!!")).toThrow(/invalid page token/i);
  });

  it("throws on valid base64 non-JSON", () => {
    const bad = Buffer.from("not json").toString("base64url");
    expect(() => decodePageToken(bad)).toThrow(/invalid page token/i);
  });

  it("throws on JSON missing offset/total", () => {
    const bad = Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url");
    expect(() => decodePageToken(bad)).toThrow(/invalid page token/i);
  });
});

describe("paginate", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];

  it("returns first page and nextPageToken when more rows exist", () => {
    const page = paginate(rows, { limit: 2, token: null });
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextPageToken).toBe(encodePageToken({ offset: 2, total: 5 }));
  });

  it("returns mid page starting at token offset", () => {
    const page = paginate(rows, { limit: 2, token: { offset: 2, total: 5 } });
    expect(page.data).toEqual([{ id: "c" }, { id: "d" }]);
    expect(page.nextPageToken).toBe(encodePageToken({ offset: 4, total: 5 }));
  });

  it("returns last page with nextPageToken = null", () => {
    const page = paginate(rows, { limit: 10, token: { offset: 0, total: 5 } });
    expect(page.data).toEqual(rows);
    expect(page.nextPageToken).toBeNull();
  });

  it("throws PAGE_EXPIRED when token.total differs from current total", () => {
    expect(() =>
      paginate(rows, { limit: 2, token: { offset: 2, total: 999 } }),
    ).toThrow(/page expired/i);
  });

  it("returns empty data when offset is past end (not expired, just past)", () => {
    const page = paginate(rows, { limit: 10, token: { offset: 5, total: 5 } });
    expect(page.data).toEqual([]);
    expect(page.nextPageToken).toBeNull();
  });
});

describe("parseListQuery", () => {
  it("returns parsed limit and decoded token", () => {
    const tok = encodePageToken({ offset: 3, total: 10 });
    const parsed = parseListQuery({ limit: "10", pageToken: tok });
    expect(parsed.limit).toBe(10);
    expect(parsed.token).toEqual({ offset: 3, total: 10 });
  });

  it("returns DEFAULT limit and null token for empty query", () => {
    const parsed = parseListQuery({});
    expect(parsed.limit).toBe(DEFAULT_LIMIT);
    expect(parsed.token).toBeNull();
  });

  it("throws BAD_REQUEST-shaped for malformed token", () => {
    expect(() => parseListQuery({ pageToken: "!!!" })).toThrow(/invalid page token/i);
  });

  it("throws BAD_REQUEST-shaped for invalid limit", () => {
    expect(() => parseListQuery({ limit: "abc" })).toThrow(/invalid limit/i);
  });
});
```

- [ ] **Step 1.2:** Confirm failure.
- [ ] **Step 1.3:** Implement `server/api/pagination.ts`:

```ts
// In-memory page-based pagination with opaque tokens.
//
// This module deliberately does NOT implement cursor pagination. The token
// encodes { offset, total }. It is opaque to clients, so a future
// repository-level seek-based rewrite can swap the implementation without
// client changes.
//
// The `total` field enables weak expired-page detection: if the result set
// size changes between page fetches, we surface PAGE_EXPIRED. This is a
// weak guard — equal-and-opposite mutations (one insert + one delete) net
// out to the same total and slip past. Do not rely on it for consistency.

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface DecodedPageToken {
  offset: number;
  total: number;
}

export interface ParsedListQuery {
  limit: number;
  token: DecodedPageToken | null;
}

export interface PaginateInput {
  limit: number;
  token: DecodedPageToken | null;
}

export interface PaginatedResult<T> {
  data: T[];
  nextPageToken: string | null;
}

export class PageExpiredError extends Error {
  constructor(message = "Page expired; result set changed, refetch from page 1") {
    super(message);
    this.name = "PageExpiredError";
  }
}

export function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_LIMIT;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("Invalid limit");
  }
  const s = String(raw);
  if (!/^-?\d+$/.test(s)) {
    throw new Error("Invalid limit");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Invalid limit");
  }
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

export function encodePageToken(token: DecodedPageToken): string {
  return Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
}

export function decodePageToken(token: string | null | undefined): DecodedPageToken | null {
  if (token === null || token === undefined || token === "") return null;
  let raw: string;
  try {
    raw = Buffer.from(token, "base64url").toString("utf8");
    // Buffer.from silently accepts garbage; validate by round-trip.
    if (Buffer.from(raw, "utf8").toString("base64url") === "") {
      throw new Error("Invalid page token");
    }
  } catch {
    throw new Error("Invalid page token");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid page token");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { offset?: unknown }).offset !== "number" ||
    typeof (parsed as { total?: unknown }).total !== "number"
  ) {
    throw new Error("Invalid page token");
  }
  const { offset, total } = parsed as DecodedPageToken;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(total) || total < 0) {
    throw new Error("Invalid page token");
  }
  return { offset, total };
}

export function parseListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    limit: parseLimit(query.limit),
    token: decodePageToken(query.pageToken as string | null | undefined),
  };
}

export function paginate<T>(rows: readonly T[], input: PaginateInput): PaginatedResult<T> {
  const total = rows.length;
  let offset = 0;

  if (input.token) {
    if (input.token.total !== total) {
      throw new PageExpiredError();
    }
    offset = input.token.offset;
  }

  const end = Math.min(offset + input.limit, total);
  const data = rows.slice(offset, end) as T[];
  const nextOffset = end;
  const nextPageToken =
    nextOffset >= total ? null : encodePageToken({ offset: nextOffset, total });
  return { data, nextPageToken };
}
```

- [ ] **Step 1.4:** Confirm green. Commit.

```bash
git add server/api/pagination.ts tests/server/api/pagination.test.ts
git commit -m "feat(api): in-memory paginated list helper with opaque page token

Part of #30.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Step 2: Wire every list endpoint to `paginate`

Add to `server/api/routes.ts`:

```ts
import { paginate, parseListQuery, PageExpiredError } from "./pagination.js";
```

Each list endpoint follows this exact shape — do NOT hand-wave "similar pattern":

```ts
router.get("/projects", (req, res) => {
  let query;
  try {
    query = parseListQuery(req.query as Record<string, unknown>);
  } catch (e) {
    return badRequest(res, (e as Error).message);
  }
  const rows = projectsRepo.listProjects(db);
  try {
    const page = paginate(rows, { limit: query.limit, token: query.token });
    return res.json(okList(page.data, page.nextPageToken));
  } catch (e) {
    if (e instanceof PageExpiredError) {
      return res.status(statusFor("PAGE_EXPIRED")).json(err("PAGE_EXPIRED", e.message));
    }
    throw e;
  }
});
```

Convert each endpoint (the repo-level function name may differ — inspect by reading the repository file, which is read-only in scope):

- [ ] `GET /projects` — rows from `projectsRepo.listProjects(db)`
- [ ] `GET /projects/:projectId/bibles` — `biblesRepo.listBibleVersions(db, projectId)`
- [ ] `GET /projects/:projectId/chapters` — `chapterArcsRepo.listChapterArcs(db, projectId)`
- [ ] `GET /chapters/:chapterId/scenes` — `scenePlansRepo.listScenePlans(db, chapterId)`
- [ ] `GET /scenes/:sceneId/chunks` — `chunksRepo.listChunksForScene(db, sceneId)`
- [ ] `GET /scenes/:sceneId/audit-flags` — `auditFlagsRepo.listAuditFlags(db, sceneId)`
- [ ] `GET /chapters/:chapterId/irs` — `narrativeIRsRepo.listAllIRsForChapter(db, chapterId)`
- [ ] `GET /chapters/:chapterId/irs/verified` — `narrativeIRsRepo.listVerifiedIRsForChapter(db, chapterId)`
- [ ] `GET /chunks/:chunkId/compilation-logs` — `compilationLogsRepo.listCompilationLogs(db, chunkId)`
- [ ] `GET /projects/:projectId/edit-patterns` — `editPatternsRepo.listEditPatterns(db, projectId)`
- [ ] `GET /scenes/:sceneId/edit-patterns` — `editPatternsRepo.listEditPatternsForScene(db, sceneId)`
- [ ] `GET /projects/:projectId/learned-patterns` — `learnedPatternsRepo.listLearnedPatterns(db, projectId, status)`
- [ ] `GET /projects/:projectId/profile-adjustments` — `profileAdjustmentsRepo.listProfileAdjustments(db, projectId, status)`
- [ ] `GET /voice-guide/versions` — `voiceGuideRepo.listVoiceGuideVersions(db)`
- [ ] `GET /writing-samples` — `writingSampleRepo.listWritingSamples(db)`

Since `paginate` is generic over `T` (no `{ id: string }` constraint), there is NO need for map-then-strip wrappers. `bibles` and `voice-guide-versions` and IRs all work as-is.

- [ ] **Step 2.1:** `pnpm typecheck`.

### Step 3: Pagination tests on every list-endpoint route test file

Apply this block to each route test file listed below. Adapt seeds and paths.

```ts
describe("GET /projects pagination", () => {
  beforeEach(async () => {
    for (let i = 1; i <= 7; i++) {
      await request(app)
        .post("/api/data/projects")
        .send({ id: `p${i}`, title: `Project ${i}`, status: "drafting" });
    }
  });

  it("returns first page with nextPageToken when more exist", async () => {
    const res = await request(app).get("/api/data/projects?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(typeof res.body.nextPageToken).toBe("string");
  });

  it("returns the next page via pageToken, non-overlapping", async () => {
    const first = await request(app).get("/api/data/projects?limit=3");
    const second = await request(app).get(
      `/api/data/projects?limit=3&pageToken=${first.body.nextPageToken}`,
    );
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(3);
    const firstIds = new Set(first.body.data.map((p: { id: string }) => p.id));
    for (const item of second.body.data) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it("returns nextPageToken = null on the last page", async () => {
    const first = await request(app).get("/api/data/projects?limit=5");
    const second = await request(app).get(
      `/api/data/projects?limit=5&pageToken=${first.body.nextPageToken}`,
    );
    expect(second.body.nextPageToken).toBeNull();
  });

  it("returns 400 BAD_REQUEST for invalid pageToken", async () => {
    const res = await request(app).get("/api/data/projects?pageToken=%21%21%21");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: { code: "BAD_REQUEST", message: expect.stringMatching(/invalid page token/i) },
    });
  });

  it("returns 400 BAD_REQUEST for invalid limit", async () => {
    const res = await request(app).get("/api/data/projects?limit=abc");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 PAGE_EXPIRED when result set size changes between fetches", async () => {
    const first = await request(app).get("/api/data/projects?limit=3");
    // Mutate the set so total changes
    await request(app)
      .post("/api/data/projects")
      .send({ id: "p99", title: "New", status: "drafting" });
    const second = await request(app).get(
      `/api/data/projects?limit=3&pageToken=${first.body.nextPageToken}`,
    );
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("PAGE_EXPIRED");
  });
});
```

Files to update:

- [ ] `tests/server/routes/projects.test.ts`
- [ ] `tests/server/routes/bibles.test.ts`
- [ ] `tests/server/routes/chapter-arcs.test.ts`
- [ ] `tests/server/routes/scene-plans.test.ts`
- [ ] `tests/server/routes/chunks.test.ts`
- [ ] `tests/server/routes/audit-flags.test.ts`
- [ ] `tests/server/routes/narrative-irs.test.ts`
- [ ] `tests/server/routes/compilation-logs.test.ts`
- [ ] `tests/server/routes/learner.test.ts`

For voice-guide versions and writing-samples pagination coverage: **Package E owns those test files.** If E has already landed and the files exist, B adds the pagination block there. If E has not landed, B skips — E will add coverage against the new envelope from the start.

### Step 4: Gate and commit

- [ ] **Step 4.1:** `pnpm check-all`. Expect green.
- [ ] **Step 4.2:** Commit.

```bash
git add server/api/routes.ts tests/server/routes
git commit -m "$(cat <<'EOF'
feat(api): paginated list responses on every list endpoint

Every list endpoint in server/api/routes.ts now parses ?limit and
?pageToken, clamps limit to [1, 200] (default 50), rejects invalid
limits and tokens with BAD_REQUEST, and returns { ok: true, data,
nextPageToken } where the token is a base64url { offset, total }
blob — opaque to clients. When the underlying result set size
changes between fetches, the next request surfaces PAGE_EXPIRED.

Underlying repositories still return full result sets; slicing
happens in memory. A follow-up p2 issue will move slicing into
server/db/** for the highest-volume list endpoints; the opaque
token contract lets that rewrite happen without client changes.

Closes #30.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Push and open PR

- [ ] **Step 1:** `pnpm check-all` one more time. Expect green.
- [ ] **Step 2:** `git push -u origin HEAD`.
- [ ] **Step 3:** Open PR:

```bash
gh pr create --title "feat(api): package B — unified envelope + pagination (#29 #30)" --body "$(cat <<'EOF'
## Summary
- Every `/api/data/**` route now returns `{ ok: true, data }` on success and `{ ok: false, error: { code, message } }` on failure. HTTP status is authoritative; `code` is an orthogonal stable identifier. A shared `server/api/envelope.ts` owns the helpers; `statusFor()` maps error codes to HTTP status.
- `src/api/client.ts`'s `fetchJson` unwraps the envelope. On `ok: false` it throws `ApiError(code, message, status, { cause, requestId, body })`. Malformed bodies surface as `ApiError` with `code: "UNKNOWN"`. 204 No Content (DELETE path) resolves to `undefined`.
- Every list endpoint accepts `?limit` and `?pageToken`. Response carries `nextPageToken: string | null`. The token is an opaque base64url `{ offset, total }` blob — clients must not introspect it. Invalid tokens or limits surface as `400 BAD_REQUEST`; size-changed result sets surface as `400 PAGE_EXPIRED`.
- List helpers migrated in-place to `Promise<Page<T>>`. All consumers under `src/app/**` updated in the same package. No two-API-surface.

**Pagination is in-memory offset, not cursor.** See the plan doc's "Design note: scope-constrained pagination" for the honest framing and the follow-up issue for repository-level seek pagination.

Closes #29. Closes #30.

## Coordination with Package E (#36)
- Package E status at PR open: **[TODO: landed | not yet landed]**
- `tests/helpers/unwrap.ts` helper: **[TODO: present | absent]**
- Voice-guide and writing-samples test files: **owned by E**, not created here.

## Test plan
- [ ] `pnpm check-all` green
- [ ] `tests/server/api/envelope.test.ts`
- [ ] `tests/server/api/pagination.test.ts`
- [ ] `tests/api/errors.test.ts`
- [ ] `tests/api/client.test.ts`
- [ ] `tests/server/routes/*.test.ts`
- [ ] Manual smoke: `pnpm dev:all`, hit `GET /api/data/projects?limit=2` and confirm `{ ok, data, nextPageToken }`

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Follow-up issue to file after B lands

Title: `perf(db): repository-level seek-based pagination on high-volume list endpoints`

Body: Package B delivered an API-shape contract (`{ data, nextPageToken }` with opaque token) but still slices full result sets in memory inside `server/api/routes.ts`. Move slicing into `server/db/repositories/**` for the 5 highest-volume endpoints — chunks, audit-flags, learned-patterns, compilation-logs, IRs — using `LIMIT ... WHERE (order_key, id) > (?, ?)` against appropriate composite indexes. The opaque page-token contract means clients do not change; only the token's internal shape changes. Label p2.

---

## Done criteria

- `server/api/envelope.ts`, `server/api/pagination.ts`, `src/api/errors.ts` exist with tests, tests pass.
- Every route handler in `server/api/routes.ts` returns responses through `ok()` / `okList()` / `err()` / `notFound` / `badRequest` / `conflict` / `internal` / `upstream` helpers. Grep for `res.json(` / `res.status(` shows only wrapped calls or deliberate 204s.
- Every list endpoint parses `?limit` / `?pageToken` and returns `{ data, nextPageToken }` inside the envelope. `PAGE_EXPIRED` is surfaced on total-mismatch.
- `src/api/client.ts`'s `fetchJson` throws `ApiError` (with `cause`, `requestId`, `body`) on envelope errors and malformed bodies; returns `.data` on success; resolves to `undefined` on 204. Every list helper has been migrated to `Promise<Page<T>>`; every `src/app/**` caller updated accordingly.
- `pnpm check-all` is green.
- PR is open against `main` with the correct title, body, and Package E coordination status filled in.
- Scope boundary respected: no changes under `server/db/**`, `server/proxy.ts`, `server/middleware.ts`, or `src/app/components/DraftStage*`.
- Existing UI behavior unchanged — callers that used to get arrays now destructure `{ data }`; the rendered UI is identical.
- Follow-up p2 issue filed for repository-level seek pagination.
