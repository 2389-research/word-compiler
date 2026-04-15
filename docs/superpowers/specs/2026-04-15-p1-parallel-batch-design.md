# P1 Parallel Cleanup Batch — Design

**Date:** 2026-04-15
**Status:** Approved, pending implementation plans
**Scope:** 7 of 10 open p1 issues, grouped into 6 packages for parallel subagent execution on isolated worktrees.

## Goal

Clear a meaningful chunk of p1 backlog in one coordinated push by dispatching independent packages to parallel subagents, each on its own git worktree. Packages are scoped so that file-level conflicts between worktrees are impossible or trivially resolvable.

## Issues in scope

| Issue | Title | Package |
|---|---|---|
| #19 | ~90 bare console.* calls with no log levels | F1 + F2 |
| #24 | Redundant countTokens() calls in assembler and budget enforcer | C |
| #25 | Multi-step DB operations lack transactions | A |
| #26 | No migration system for schema evolution | A |
| #29 | Inconsistent API response envelopes and conventions | B |
| #30 | No pagination on any list endpoint | B |
| #34 | DraftStage timer leak on unmount + god component split | D |
| #36 | 11 API routes and core stores untested | E |
| #44 | No graceful shutdown, missing indexes, no CHECK constraints | A |

## Issues explicitly deferred

- **#40** major dep upgrades — lockfile churn would break every parallel worktree. Solo pass, separate session.
- **#39** push-only-main, **#50** ESM/npx, **#41** .gitignore — small chore bundle, solo pass.
- All p2 issues.

## Packages

### Package F1 — Logger infrastructure

**Runs in parallel with everything. Must merge first so other packages can import.**

- **Scope (new files only):** `src/lib/logger.ts`, `server/lib/logger.ts`
- Levels: `debug | info | warn | error`
- Structured output (single-line JSON in production, pretty in dev)
- Env-gated by `LOG_LEVEL`
- No call-site migrations in this package — pure addition
- Zero merge-conflict risk

### Package A — Database hardening

- **Scope:** `server/db/**` only
- **#25:** Wrap multi-step operations in the repository pattern's existing transaction helper. Identify call sites: search `server/db/repositories/` for functions doing >1 write, wrap each.
- **#26:** Lightweight migration system.
  - Numbered files in `server/db/migrations/NNN_description.sql`
  - `schema_migrations` table tracks applied versions
  - Runner applies pending migrations at boot (idempotent)
  - No ORM, no external dependency
- **#44:**
  - Graceful shutdown: SIGTERM/SIGINT handler closes DB, drains Express
  - Add missing indexes (subagent audits query patterns during implementation)
  - Add CHECK constraints to enum-like columns
- Uses F1 logger for any new log statements

### Package B — API consistency

- **Scope:** `server/api/**` + `src/api/**` (client wrappers)
- **#29:** Unified envelope:
  ```ts
  type ApiResponse<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };
  ```
  Client wrapper normalizes; throw on `ok: false`.
- **#30:** Cursor-based pagination on list endpoints: `?limit&cursor` → `{ data, nextCursor }` inside the envelope.
- **Coordination with Package E:** E writes tests against current API shapes. B owns updating those tests in its own PR once envelopes change. B must rebase after E lands (or vice versa).
- Uses F1 logger

### Package C — Compiler performance

- **Scope:** `src/compiler/**`
- **#24:** Ring builders already count tokens internally; thread those counts through their return values so the assembler and budget enforcer don't recount. Expected ~200 LOC, isolated.

### Package D — DraftStage refactor

- **Scope:** `src/app/components/DraftStage*` subtree only
- **#34:**
  - Fix timer leak: ensure `setInterval`/`setTimeout` cleaned up in `$effect` teardown
  - Split god component along natural seams — subagent decides exact boundaries after reading current code (likely header/timeline/editor/footer or similar)
- Uses F1 logger for any new log statements

### Package E — Test coverage gaps

- **Scope:** `tests/**` additions only — no source edits
- **#36:**
  - Unit tests for the 11 untested API routes
  - Unit tests for core stores (list to be identified from the issue body)
- Targets *current* API shapes; B will update shapes when envelopes change

### Package F2 — Logger sweep *(sequential, after A-E merge)*

- Residual `console.*` → logger across files A-E did not touch
- Mechanical; single reviewer pass

## Execution order

1. **F1** dispatched and merged first (fast — new files only)
2. **A, B, C, D, E** dispatched in parallel after F1 lands
3. Merge A-E as each subagent finishes and passes review
4. **F2** dispatched after the last of A-E lands
5. Final `pnpm check-all` on main

## Dispatch protocol

Each subagent prompt must include:
- The verbatim issue text(s)
- An explicit path allowlist ("you may only modify files under …")
- The coordination constraint (e.g., "use F1 logger", "do not modify test files" for B)
- Instruction to run `pnpm check-all` before declaring done
- Instruction to open a PR targeting `main` with the issue number in the title
- `isolation: "worktree"` so abandoned work is auto-cleaned

## Review gates

- Per-package PR goes through `superpowers:code-reviewer` before merge
- Human approval on each PR before merge
- F2 reviewed holistically once A-E are in

## Success criteria

- All 7 scoped issues closed
- `pnpm check-all` green on main after the full batch lands
- No merge conflicts resolved by discarding work
- Log output (from any newly-added call site) flows through the logger, not `console.*`
