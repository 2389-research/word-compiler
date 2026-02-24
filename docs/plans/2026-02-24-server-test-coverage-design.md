# Server Test Coverage Design

Date: 2026-02-24

## Goal

Comprehensive test coverage for the server layer (40+ API routes, middleware, proxy endpoints) plus coverage tooling infrastructure.

## Current State

- 802 unit tests across 62 files, all passing (3.6s)
- 36 E2E Playwright tests across 8 files
- Repository layer well-tested with in-memory SQLite
- Server HTTP layer nearly untested: only proxy.test.ts (outputSchema behavior) and routes-ensure-project.test.ts (auto-creation side effect)
- No coverage tooling installed

## Decisions

1. **Supertest integration tests as primary route coverage** — no unit tests for thin handlers
2. **Focused unit tests for middleware** — errorHandler and requestLogger have real branching logic
3. **Expand proxy.ts tests** — caching, sampling precedence, error paths, SSE events
4. **Shared test helpers** — extract factory functions + API test app builder
5. **One file per resource domain** — 9 route test files mirroring repo modules
6. **Fresh in-memory SQLite per test** — simple, fast enough
7. **Supertest everywhere** — no real HTTP servers in tests
8. **Coverage: baseline first, ratchet later** — install tooling, measure, then set thresholds

## New Files

### Shared Helpers

- `tests/helpers/apiTestApp.ts` — creates Express app + in-memory DB, returns `{ app, db, close }`
- `tests/helpers/factories.ts` — extracted factory functions (makeProject, makeChapterArc, makeChunk, makeAuditFlag, makeScenePlan, makeCompilationLog, makeEditPattern, makeLearnedPattern, makeProfileAdjustment)

### Route Integration Tests (supertest)

| File | Routes Covered |
|------|----------------|
| `tests/server/routes/projects.test.ts` | GET list, GET :id, POST, PATCH :id, DELETE :id |
| `tests/server/routes/bibles.test.ts` | GET latest, GET :version, GET list, POST |
| `tests/server/routes/chapter-arcs.test.ts` | GET list, GET :id, POST, PUT :id |
| `tests/server/routes/scene-plans.test.ts` | GET list, GET :id, POST, PUT :id, PATCH status |
| `tests/server/routes/chunks.test.ts` | GET list, GET :id, POST, PUT :id, DELETE :id |
| `tests/server/routes/audit-flags.test.ts` | GET list, GET stats, POST single/batch, PATCH resolve |
| `tests/server/routes/narrative-irs.test.ts` | GET scene IR, POST, PUT, PATCH verify, GET chapter list, GET verified |
| `tests/server/routes/compilation-logs.test.ts` | POST, GET :id, GET by chunk |
| `tests/server/routes/learner.test.ts` | edit-patterns, learned-patterns, profile-adjustments (CRUD + status filtering) |

### Middleware Unit Tests

- `tests/server/middleware.test.ts` — errorHandler (custom status, default 500, headersSent, logging) + requestLogger (log level routing by status/method)

### Expanded Proxy Tests

Same file (`tests/server/proxy.test.ts`), new describe blocks:
- GET /api/models: cache behavior, filter+map+sort, SDK error passthrough
- POST /api/generate: sampling precedence, defaults, 502 on no text block, SDK errors
- POST /api/generate/stream: SSE delta/done event shape, error event, sampling defaults

### Coverage Infrastructure

- Install `@vitest/coverage-v8`
- Add `pnpm test:coverage` script
- No enforced thresholds initially

## Test Pattern

Each route test follows:
1. Seed prerequisite data via repo functions (using shared factories)
2. Call route via supertest
3. Assert HTTP status code
4. Assert response body shape (using `expect.objectContaining` for resilience)
5. Assert side effects where relevant (re-read via repo)

Console output suppressed by default (spied in beforeEach, restored in afterEach).
