# Package A: Database Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the SQLite persistence layer by (1) exposing transactional repository wrappers for multi-step writes, (2) introducing a hand-rolled numbered-file migration system with a `schema_migrations` version table and boot-time runner, and (3) adding a graceful shutdown hook, missing indexes, and `CHECK` constraints on enum-like columns — all of which ship as new migration files rather than edits to `schema.ts`.

**Architecture:**

- New module `server/db/transaction.ts` exposes a `withTransaction(db, fn)` helper that is a thin wrapper over `db.transaction(fn)()` from `better-sqlite3`. Repository functions that currently perform `DELETE`+`INSERT` pairs or multi-table writes gain transactional variants that use it. The existing idiomatic pattern (`db.transaction(() => {...})()` — as used today in `createEditPatterns`, `createAuditFlags`, and `deleteProject`) is preserved verbatim inside the helper.
- New module `server/db/migrations.ts` implements the migration runner. Migrations live in `server/db/migrations/NNN_description.sql` as raw SQL files loaded at runtime via `fs.readdirSync` + `fs.readFileSync`. A `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)` table records which versions have run. The runner is idempotent: it reads the list of applied versions, filters the filesystem files to those not yet applied, sorts by numeric version, and applies each inside a single transaction per file. On boot, `getDatabase()` calls `runMigrations(db)` after `createSchema(db)`.
- `001_baseline.sql` is a no-op (`SELECT 1;`) that exists purely to seed `schema_migrations` with version 1 on fresh databases. Rationale: `createSchema()` already handles the existing bootstrapping pattern using `CREATE TABLE IF NOT EXISTS`, so we do NOT duplicate that content into SQL files — we keep `createSchema()` as the baseline and use migrations only for forward-evolution. This avoids a large one-time rewrite and keeps the diff reviewable.
- `002_indexes_and_checks.sql` carries the Task 3 payload: missing indexes and `CHECK` constraints. Because SQLite cannot `ALTER TABLE ... ADD CHECK`, we implement check constraints via `CREATE TRIGGER` ... `RAISE(ABORT, ...)` in the migration file. Indexes use plain `CREATE INDEX IF NOT EXISTS`.
- `server/db/shutdown.ts` exposes `registerShutdownHandlers(server, db)` which wires `SIGTERM` and `SIGINT` to a drain sequence: stop accepting new Express connections via `server.close()`, then `db.close()`, then `process.exit(0)`. `server/proxy.ts` imports and calls this helper exactly once at boot — the **only** file outside `server/db/**` that this package modifies.
- All new log lines use `createLogger("db")` or `createLogger("migrations")` from `server/lib/logger.ts` (shipped in Package F1, already on main).

**Tech Stack:** TypeScript strict, `better-sqlite3`, Vitest, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

---

## Scope boundary

This package may only modify or create files under these paths:

- `server/db/**` (modify existing and add new files freely)
- `tests/server/db/**` (modify existing and add new test files freely)
- `server/proxy.ts` (**ONLY** to add a single graceful-shutdown call — described in Task 3 Step 9 — no other edits)

It may NOT touch:

- `server/api/**` — Package B's territory; route-handler call sites that could use the new transactional wrappers stay on the old non-transactional calls until B picks them up.
- `src/**` — no client code changes.
- `tests/**` except `tests/server/db/**`.
- Existing `console.*` calls in any file touched by this package — those are Package F2's job. **New** log lines this package adds MUST use `createLogger(...)` from `server/lib/logger.ts`.

Closes issues: #25, #26, #44.

---

## Logger adoption policy

Package F1 has landed. The logger factory `createLogger(tag: string): Logger` is importable from `server/lib/logger.ts`. For this package:

- Every NEW log line written by Task 1/2/3 MUST use `createLogger("db")` or `createLogger("migrations")` and one of `.debug/.info/.warn/.error`.
- Existing `console.*` lines in files you touch (e.g., `server/db/helpers.ts` line 9, `server/proxy.ts`) MUST be left alone. Migrating them is Package F2's responsibility.
- Do NOT introduce any new `console.*` calls.

---

## Task 1: Transactional repository wrappers (#25)

**Files:**
- Create: `server/db/transaction.ts`
- Create: `tests/server/db/transaction.test.ts`
- Modify: `server/db/repositories/voice-guide.ts` (wrap `saveVoiceGuide`; add `saveVoiceGuideAndVersion`)
- Modify: `server/db/repositories/project-voice-guide.ts` (wrap `saveProjectVoiceGuide`)
- Create: `tests/server/db/transactions.repositories.test.ts`

**Rationale for the specific call sites:** Issue #25 names three route-level offenders, but per the scope boundary we cannot touch `server/api/**`. What we CAN and MUST fix is the underlying repository primitive so those routes can later adopt transactional variants without rewriting. Two repository functions today perform `DELETE`+`INSERT` without wrapping them:

1. `saveVoiceGuide` — `DELETE FROM voice_guide` followed by `INSERT INTO voice_guide` (voice-guide.ts:29–36). A crash between the two lines destroys the voice guide entirely.
2. `saveProjectVoiceGuide` — same `DELETE`+`INSERT` pattern (project-voice-guide.ts:23–29).

Additionally, the CIPHER route-level sequence (`createPreferenceStatement` + `markEditsProcessed` + `saveVoiceGuide` + `saveVoiceGuideVersion`) cannot be wrapped here directly, but we add a composite repository helper `saveVoiceGuideAndVersion(db, guide)` that performs `saveVoiceGuide` + `saveVoiceGuideVersion` atomically. Package B will later swap route handlers to use it.

- [ ] **Step 1: Write the failing test for the transaction helper**

Create `tests/server/db/transaction.test.ts`:

```ts
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "../../../server/db/transaction.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)");
});

describe("withTransaction", () => {
  it("commits all writes when the callback returns normally", () => {
    withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (1, 'a')").run();
      db.prepare("INSERT INTO t (id, v) VALUES (2, 'b')").run();
    });

    const rows = db.prepare("SELECT id, v FROM t ORDER BY id").all() as Array<{ id: number; v: string }>;
    expect(rows).toEqual([
      { id: 1, v: "a" },
      { id: 2, v: "b" },
    ]);
  });

  it("rolls back all writes when the callback throws mid-sequence", () => {
    expect(() =>
      withTransaction(db, () => {
        db.prepare("INSERT INTO t (id, v) VALUES (1, 'a')").run();
        throw new Error("boom");
      }),
    ).toThrow(/boom/);

    const count = (db.prepare("SELECT COUNT(*) AS c FROM t").get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it("returns the callback's return value", () => {
    const result = withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (42, 'x')").run();
      return "ok";
    });
    expect(result).toBe("ok");
  });

  it("nested withTransaction calls behave atomically via savepoints", () => {
    // better-sqlite3 turns nested transactions into savepoints automatically.
    // Inner throw must roll back only inner writes if the outer catches it.
    withTransaction(db, () => {
      db.prepare("INSERT INTO t (id, v) VALUES (1, 'outer')").run();
      try {
        withTransaction(db, () => {
          db.prepare("INSERT INTO t (id, v) VALUES (2, 'inner')").run();
          throw new Error("inner boom");
        });
      } catch {
        // swallow — outer should survive
      }
    });

    const rows = db.prepare("SELECT id FROM t ORDER BY id").all() as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm test -- tests/server/db/transaction.test.ts`

Expected: all four tests fail with a module-not-found error for `../../../server/db/transaction.js`.

- [ ] **Step 3: Implement `server/db/transaction.ts`**

Create `server/db/transaction.ts`:

```ts
import type Database from "better-sqlite3";

/**
 * Runs `fn` inside a better-sqlite3 transaction and returns its result.
 * If `fn` throws, the transaction is rolled back and the error is re-raised.
 *
 * better-sqlite3's `db.transaction(cb)` returns a function that, when invoked,
 * wraps the callback in BEGIN/COMMIT/ROLLBACK. Nested invocations are
 * translated into SAVEPOINT/RELEASE/ROLLBACK TO, so calling withTransaction
 * from inside another withTransaction is safe.
 *
 * This is a thin idiomatic wrapper — the existing repositories already use
 * `db.transaction(() => {...})()` directly (see createEditPatterns,
 * createAuditFlags, deleteProject). New call sites should prefer this helper
 * so that the transactional intent is named at the call site.
 */
export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  const tx = db.transaction(fn);
  return tx();
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm test -- tests/server/db/transaction.test.ts`

Expected: four tests pass.

- [ ] **Step 5: Write failing tests for the transactional repository wrappers**

Create `tests/server/db/transactions.repositories.test.ts`:

```ts
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProjectVoiceGuide } from "../../../server/db/repositories/project-voice-guide.js";
import {
  getVoiceGuide,
  saveVoiceGuide,
  saveVoiceGuideAndVersion,
} from "../../../server/db/repositories/voice-guide.js";
import { createSchema } from "../../../server/db/schema.js";
import type { VoiceGuide } from "../../../src/profile/types.js";

let db: Database.Database;

function makeGuide(version: string): VoiceGuide {
  return {
    version,
    summary: "summary",
    rules: [],
    antiRules: [],
    examples: [],
    lastUpdated: new Date().toISOString(),
    versionHistory: [
      {
        version,
        updatedAt: new Date().toISOString(),
        changeReason: "test",
        changeSummary: "test change",
        confirmedFeatures: [],
        contradictedFeatures: [],
        newFeatures: [],
      },
    ],
  } as unknown as VoiceGuide;
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("saveVoiceGuide (transactional)", () => {
  it("is atomic: if the INSERT fails, the prior row survives", () => {
    saveVoiceGuide(db, makeGuide("v1"));
    const before = getVoiceGuide(db);
    expect(before?.version).toBe("v1");

    // Force failure by spying on prepare to throw on the INSERT statement.
    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO voice_guide")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveVoiceGuide(db, makeGuide("v2"))).toThrow(/disk full/);
    spy.mockRestore();

    const after = getVoiceGuide(db);
    expect(after?.version).toBe("v1");
  });
});

describe("saveProjectVoiceGuide (transactional)", () => {
  it("is atomic: if the INSERT fails, the prior row survives", () => {
    saveProjectVoiceGuide(db, "p1", makeGuide("v1"));
    const before = db
      .prepare("SELECT version FROM project_voice_guide WHERE project_id = 'p1'")
      .get() as { version: string };
    expect(before.version).toBe("v1");

    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO project_voice_guide")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveProjectVoiceGuide(db, "p1", makeGuide("v2"))).toThrow(/disk full/);
    spy.mockRestore();

    const row = db
      .prepare("SELECT version FROM project_voice_guide WHERE project_id = 'p1'")
      .get() as { version: string };
    expect(row.version).toBe("v1");
  });
});

describe("saveVoiceGuideAndVersion", () => {
  it("commits both the voice_guide row and the voice_guide_versions row", () => {
    saveVoiceGuideAndVersion(db, makeGuide("v1"));
    const guideRows = db.prepare("SELECT version FROM voice_guide").all() as Array<{ version: string }>;
    const versionRows = db.prepare("SELECT version FROM voice_guide_versions").all() as Array<{ version: string }>;
    expect(guideRows.map((r) => r.version)).toEqual(["v1"]);
    expect(versionRows.map((r) => r.version)).toEqual(["v1"]);
  });

  it("rolls back both rows if the version insert fails", () => {
    const realPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation((sql: string) => {
      if (sql.startsWith("INSERT INTO voice_guide_versions")) {
        throw new Error("disk full");
      }
      return realPrepare(sql);
    });

    expect(() => saveVoiceGuideAndVersion(db, makeGuide("v1"))).toThrow(/disk full/);
    spy.mockRestore();

    const guideCount = (db.prepare("SELECT COUNT(*) AS c FROM voice_guide").get() as { c: number }).c;
    const versionCount = (db.prepare("SELECT COUNT(*) AS c FROM voice_guide_versions").get() as { c: number }).c;
    expect(guideCount).toBe(0);
    expect(versionCount).toBe(0);
  });
});
```

- [ ] **Step 6: Run the new tests and confirm they fail**

Run: `pnpm test -- tests/server/db/transactions.repositories.test.ts`

Expected: the `saveVoiceGuideAndVersion` tests fail with a missing-export error, and the atomicity tests for `saveVoiceGuide` / `saveProjectVoiceGuide` fail because the current implementations are not transactional — after the spy throws on INSERT, the DELETE has already committed and `getVoiceGuide` returns `null`.

- [ ] **Step 7: Wrap `saveVoiceGuide` in a transaction and add `saveVoiceGuideAndVersion`**

Edit `server/db/repositories/voice-guide.ts`. Add the import at the top of the file alongside the existing imports:

```ts
import { withTransaction } from "../transaction.js";
```

Replace the current `saveVoiceGuide` function with:

```ts
export function saveVoiceGuide(db: Database.Database, guide: VoiceGuide): void {
  const now = new Date().toISOString();
  withTransaction(db, () => {
    db.prepare("DELETE FROM voice_guide").run();
    db.prepare(
      `INSERT INTO voice_guide (id, version, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(generateId(), guide.version, JSON.stringify(guide), now, now);
  });
}
```

Add the following new function at the bottom of the file (after `listVoiceGuideVersions`):

```ts
/**
 * Atomically saves the current voice guide AND appends a version history row.
 * Used by the CIPHER batch flow so a partial write cannot leave the guide
 * and its version history out of sync. Callers that need only one of the
 * two operations should continue to use saveVoiceGuide / saveVoiceGuideVersion
 * directly.
 */
export function saveVoiceGuideAndVersion(db: Database.Database, guide: VoiceGuide): void {
  withTransaction(db, () => {
    saveVoiceGuide(db, guide);
    saveVoiceGuideVersion(db, guide);
  });
}
```

- [ ] **Step 8: Wrap `saveProjectVoiceGuide` in a transaction**

Edit `server/db/repositories/project-voice-guide.ts`. Add the import:

```ts
import { withTransaction } from "../transaction.js";
```

Replace the current `saveProjectVoiceGuide` with:

```ts
export function saveProjectVoiceGuide(db: Database.Database, projectId: string, guide: VoiceGuide): void {
  const now = new Date().toISOString();
  withTransaction(db, () => {
    db.prepare("DELETE FROM project_voice_guide WHERE project_id = ?").run(projectId);
    db.prepare(
      `INSERT INTO project_voice_guide (id, project_id, version, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(generateId(), projectId, guide.version, JSON.stringify(guide), now, now);
  });
}
```

- [ ] **Step 9: Run the repository tests and confirm they pass**

Run: `pnpm test -- tests/server/db/transactions.repositories.test.ts tests/server/db/transaction.test.ts`

Expected: all tests pass.

Run: `pnpm test -- tests/server/db`

Expected: existing DB test suites remain green.

- [ ] **Step 10: Final gate**

Run: `pnpm check-all`

Expected: lint, typecheck, and full vitest suite all green.

- [ ] **Step 11: Commit**

```bash
git add server/db/transaction.ts \
        server/db/repositories/voice-guide.ts \
        server/db/repositories/project-voice-guide.ts \
        tests/server/db/transaction.test.ts \
        tests/server/db/transactions.repositories.test.ts
git commit -m "$(cat <<'EOF'
feat(db): transactional repository wrappers (#25)

Introduces server/db/transaction.ts with a named withTransaction(db, fn)
helper over better-sqlite3's db.transaction(). Wraps the two existing
DELETE+INSERT repository paths (saveVoiceGuide, saveProjectVoiceGuide)
in transactions so a crash between the two statements no longer wipes
the row. Adds saveVoiceGuideAndVersion which atomically writes the
current voice guide and its version-history row — the composite that
the CIPHER batch route will adopt once Package B lands.

Tests cover commit, mid-sequence rollback, return-value propagation,
nested savepoint semantics, and atomicity of both wrapped repositories.

Scope boundary respected: no edits under server/api or src.

Closes #25.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration system (#26)

**Files:**
- Create: `server/db/migrations.ts`
- Create: `server/db/migrations/001_baseline.sql`
- Create: `tests/server/db/migrations.test.ts`
- Modify: `server/db/connection.ts` (call `runMigrations(db)` after `createSchema`)

**Design decisions:**

- Migrations are plain `.sql` files named `NNN_description.sql` where `NNN` is a zero-padded integer. The runner parses the leading integer as the version.
- A `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)` table tracks applied versions. The runner creates it if missing.
- Each migration file runs inside its own transaction (file contents + INSERT into schema_migrations). If the SQL fails, the transaction rolls back and the runner throws. This means SQLite statements that implicitly commit (e.g. `VACUUM`) are not allowed inside migration files — this is documented in the runner's JSDoc.
- No checksumming in v1. Rationale: all migrations ship in-tree and are reviewed in PRs; checksum mismatch would only catch post-deploy tampering, which is not in the current threat model. Easier to add later than to remove.
- `001_baseline.sql` is a no-op (`SELECT 1;`). Rationale: `createSchema()` continues to be the source of truth for the baseline schema (using `CREATE TABLE IF NOT EXISTS`), so the first migration exists only to claim version 1 and prove the runner works on fresh databases. Forward schema evolution (Task 3's indexes and CHECK constraints) ships as `002_indexes_and_checks.sql`.

- [ ] **Step 1: Write the failing tests for the runner**

Create `tests/server/db/migrations.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../../server/db/migrations.js";

let db: Database.Database;
let tmpDir: string;

function writeMigration(version: number, body: string, name = "test"): void {
  const padded = String(version).padStart(3, "0");
  fs.writeFileSync(path.join(tmpDir, `${padded}_${name}.sql`), body);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-migrations-"));
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("creates schema_migrations on first run", () => {
    runMigrations(db, { directory: tmpDir });
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    expect(row).toBeDefined();
  });

  it("applies pending migrations in numeric order", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    writeMigration(2, "CREATE TABLE b (y INTEGER);", "create_b");
    writeMigration(10, "CREATE TABLE c (z INTEGER);", "create_c");

    runMigrations(db, { directory: tmpDir });

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("c");

    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1, 2, 10]);
  });

  it("skips already-applied migrations on second run", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    runMigrations(db, { directory: tmpDir });

    // Second run with the same directory MUST NOT re-run 001 (which would
    // fail with "table a already exists"). Prove it by running twice more.
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();

    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1]);
  });

  it("applies new migrations added after the initial run", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "create_a");
    runMigrations(db, { directory: tmpDir });

    writeMigration(2, "CREATE TABLE b (y INTEGER);", "create_b");
    runMigrations(db, { directory: tmpDir });

    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it("rolls back a failing migration and does not record its version", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "ok");
    writeMigration(2, "THIS IS NOT VALID SQL;", "bad");

    expect(() => runMigrations(db, { directory: tmpDir })).toThrow();

    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1]);

    const aExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'a'")
      .get();
    expect(aExists).toBeDefined();
  });

  it("ignores non-matching files in the migrations directory", () => {
    writeMigration(1, "CREATE TABLE a (x INTEGER);", "ok");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "docs");
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "notes");

    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    const versions = db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
    expect(versions.map((v) => v.version)).toEqual([1]);
  });

  it("is a no-op when the migrations directory is empty", () => {
    expect(() => runMigrations(db, { directory: tmpDir })).not.toThrow();
    const count = (db.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get() as { c: number }).c;
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test -- tests/server/db/migrations.test.ts`

Expected: all tests fail with a module-not-found error for `../../../server/db/migrations.js`.

- [ ] **Step 3: Implement `server/db/migrations.ts`**

Create `server/db/migrations.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("migrations");

export interface RunMigrationsOptions {
  /** Directory containing NNN_*.sql migration files. Defaults to server/db/migrations. */
  directory?: string;
}

interface MigrationFile {
  version: number;
  filename: string;
  sql: string;
}

/**
 * Applies any pending SQL migrations in `directory` against `db`.
 *
 * Migration files must be named `NNN_description.sql` where `NNN` is a
 * non-negative integer (zero-padding is conventional but not required for
 * parsing). Files that do not match this pattern are silently ignored.
 *
 * Each migration runs inside its own transaction together with the
 * INSERT into `schema_migrations`. On failure, the transaction rolls back
 * and the error is re-raised. Migration files must NOT contain statements
 * that implicitly commit (e.g. VACUUM, PRAGMA journal_mode) — those will
 * break atomicity.
 *
 * The runner is idempotent: applied versions are tracked in
 * `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
 * and skipped on subsequent runs.
 */
export function runMigrations(db: Database.Database, options: RunMigrationsOptions = {}): void {
  const directory = options.directory ?? path.resolve(import.meta.dirname ?? __dirname, "migrations");

  ensureMigrationsTable(db);

  if (!fs.existsSync(directory)) {
    logger.warn("migrations directory missing; skipping", { directory });
    return;
  }

  const pending = loadPendingMigrations(db, directory);
  if (pending.length === 0) {
    logger.debug("no pending migrations");
    return;
  }

  logger.info("applying migrations", { count: pending.length, versions: pending.map((m) => m.version) });

  for (const migration of pending) {
    applyMigration(db, migration);
  }
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

const FILENAME_PATTERN = /^(\d+)_([^.]+)\.sql$/;

function loadPendingMigrations(db: Database.Database, directory: string): MigrationFile[] {
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map((r) => r.version),
  );

  const files = fs
    .readdirSync(directory)
    .map((filename) => {
      const match = FILENAME_PATTERN.exec(filename);
      if (!match) return null;
      const version = Number.parseInt(match[1]!, 10);
      if (!Number.isFinite(version)) return null;
      return { filename, version };
    })
    .filter((entry): entry is { filename: string; version: number } => entry !== null)
    .filter((entry) => !applied.has(entry.version))
    .sort((a, b) => a.version - b.version);

  return files.map((entry) => ({
    version: entry.version,
    filename: entry.filename,
    sql: fs.readFileSync(path.join(directory, entry.filename), "utf8"),
  }));
}

function applyMigration(db: Database.Database, migration: MigrationFile): void {
  const appliedAt = new Date().toISOString();
  const run = db.transaction(() => {
    db.exec(migration.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(migration.version, appliedAt);
  });

  try {
    run();
    logger.info("migration applied", { version: migration.version, filename: migration.filename });
  } catch (err) {
    logger.error("migration failed", err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}
```

- [ ] **Step 4: Create the baseline migration**

Create `server/db/migrations/001_baseline.sql`:

```sql
-- 001_baseline.sql
--
-- The baseline schema is installed by server/db/schema.ts::createSchema()
-- using CREATE TABLE IF NOT EXISTS. This migration exists only to claim
-- version 1 in schema_migrations so that the runner works correctly on
-- fresh databases and so future migrations (002+) can assume a versioned
-- baseline. It deliberately performs no DDL.
SELECT 1;
```

- [ ] **Step 5: Run the migration tests and confirm they pass**

Run: `pnpm test -- tests/server/db/migrations.test.ts`

Expected: all seven tests pass.

- [ ] **Step 6: Wire the runner into `getDatabase`**

Edit `server/db/connection.ts`. Add the import near the top:

```ts
import { runMigrations } from "./migrations.js";
```

In `getDatabase`, after the `createSchema(db)` line, add a call to `runMigrations(db);`. Resulting function body:

```ts
export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? path.resolve(process.cwd(), "data", "word-compiler.db");
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  runMigrations(db);
  return db;
}
```

Leave `getMemoryDatabase` unchanged — in-memory test databases do not need to go through the filesystem-backed migration runner, and most existing tests construct ad-hoc in-memory DBs directly.

- [ ] **Step 7: Run the full DB test suite**

Run: `pnpm test -- tests/server/db`

Expected: green. The existing `connection.test.ts` mocks `schema.js` in the `getDatabase` tests, so `runMigrations` will operate on a fresh real directory only for the production code path; no test exercises the real `getDatabase` path against a filesystem. If a test does fail, re-read `tests/server/db/connection.test.ts` and update that test's mocks to also stub `./migrations.js`.

- [ ] **Step 8: Final gate**

Run: `pnpm check-all`

Expected: lint, typecheck, and full vitest suite all green.

- [ ] **Step 9: Commit**

```bash
git add server/db/migrations.ts \
        server/db/migrations/001_baseline.sql \
        server/db/connection.ts \
        tests/server/db/migrations.test.ts
git commit -m "$(cat <<'EOF'
feat(db): hand-rolled SQL migration system (#26)

Introduces server/db/migrations.ts with runMigrations(db, { directory })
and a schema_migrations(version, applied_at) version table. Migration
files live in server/db/migrations/NNN_description.sql and are applied
in numeric order inside per-file transactions. The runner is idempotent,
ignores non-matching files, and rolls back partial migrations on error.

getDatabase() now invokes runMigrations after createSchema. getMemoryDatabase
is deliberately left untouched so existing in-memory unit tests need no
migration fixtures.

001_baseline.sql is a no-op (SELECT 1) that claims version 1 on fresh
databases. The baseline schema remains owned by schema.ts::createSchema()
with CREATE TABLE IF NOT EXISTS. Forward schema evolution lands as
002+ migration files.

No external dependency. All log lines use createLogger("migrations")
from the F1 logger.

Closes #26.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Graceful shutdown, indexes, CHECK constraints (#44)

**Files:**
- Create: `server/db/shutdown.ts`
- Create: `server/db/migrations/002_indexes_and_checks.sql`
- Create: `tests/server/db/shutdown.test.ts`
- Create: `tests/server/db/migration-002.test.ts`
- Modify: `server/proxy.ts` (ONE addition: call `registerShutdownHandlers`)

**Audit findings — indexes to add:**

| Query | Index | Rationale |
|---|---|---|
| `SELECT id FROM scene_plans WHERE project_id = ?` (projects.ts:62) | `idx_scene_plans_project` on `scene_plans(project_id)` | Full table scan on project delete. Called in `deleteProject`. |
| `SELECT * FROM project_voice_guide WHERE project_id = ?` (project-voice-guide.ts:16) | Already covered by `UNIQUE(project_id)` in `CREATE TABLE` — SQLite auto-creates an index. NO new index needed. |
| `SELECT * FROM edit_patterns WHERE project_id = ? ORDER BY created_at` | Existing `idx_edit_patterns_project (project_id, sub_type)` covers equality on `project_id`. NO new index. |
| `SELECT * FROM voice_guide_versions ORDER BY created_at DESC` (voice-guide.ts:55) | `idx_voice_guide_versions_created_at` on `voice_guide_versions(created_at DESC)` | `listVoiceGuideVersions` orders by `created_at DESC` without a supporting index. |

Net new indexes in `002_indexes_and_checks.sql`:

- `CREATE INDEX IF NOT EXISTS idx_scene_plans_project ON scene_plans(project_id);`
- `CREATE INDEX IF NOT EXISTS idx_voice_guide_versions_created_at ON voice_guide_versions(created_at DESC);`

**Audit findings — CHECK constraints to add:**

SQLite does not support `ALTER TABLE ... ADD CHECK`, so we install per-table `BEFORE INSERT` and `BEFORE UPDATE` triggers that call `RAISE(ABORT, ...)` for disallowed values. Columns and their allowed sets (sourced from `src/types/metadata.ts`, `src/types/scene.ts`, and repository grep):

| Column | Allowed values |
|---|---|
| `projects.status` | `bootstrap`, `bible`, `planning`, `drafting`, `revising` |
| `scene_plans.status` | `planned`, `drafting`, `complete` |
| `audit_flags.severity` | `critical`, `warning`, `info` |
| `profile_adjustments.status` | `pending`, `approved`, `rejected`, `applied`, `dismissed` |
| `learned_patterns.status` | `proposed`, `approved`, `rejected`, `applied` |

Each gets one `BEFORE INSERT` and one `BEFORE UPDATE OF <column>` trigger.

- [ ] **Step 1: Write failing tests for migration 002**

Create `tests/server/db/migration-002.test.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../../server/db/migrations.js";
import { createSchema } from "../../../server/db/schema.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, "../../../server/db/migrations");

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);
  runMigrations(db, { directory: MIGRATIONS_DIR });
});

afterEach(() => {
  db.close();
});

describe("migration 002 — indexes", () => {
  it("creates idx_scene_plans_project", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_scene_plans_project'")
      .get();
    expect(row).toBeDefined();
  });

  it("creates idx_voice_guide_versions_created_at", () => {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_voice_guide_versions_created_at'",
      )
      .get();
    expect(row).toBeDefined();
  });
});

describe("migration 002 — CHECK triggers: projects.status", () => {
  it("accepts valid project statuses", () => {
    for (const status of ["bootstrap", "bible", "planning", "drafting", "revising"]) {
      const id = `p_${status}`;
      expect(() =>
        db.prepare("INSERT INTO projects (id, title, status) VALUES (?, 'T', ?)").run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid project status on insert", () => {
    expect(() =>
      db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'nonsense')").run(),
    ).toThrow(/projects\.status/i);
  });

  it("rejects invalid project status on update", () => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
    expect(() => db.prepare("UPDATE projects SET status = 'nonsense' WHERE id = 'p1'").run()).toThrow(
      /projects\.status/i,
    );
  });
});

describe("migration 002 — CHECK triggers: scene_plans.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid scene statuses", () => {
    for (const status of ["planned", "drafting", "complete"]) {
      const id = `s_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES (?, 'p1', NULL, 0, ?, '{}')",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid scene status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES ('s1', 'p1', NULL, 0, 'bogus', '{}')",
        )
        .run(),
    ).toThrow(/scene_plans\.status/i);
  });
});

describe("migration 002 — CHECK triggers: audit_flags.severity", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
    db.prepare(
      "INSERT INTO scene_plans (id, project_id, chapter_id, scene_order, status, data) VALUES ('s1', 'p1', NULL, 0, 'planned', '{}')",
    ).run();
  });

  it("accepts valid severities", () => {
    for (const severity of ["critical", "warning", "info"]) {
      const id = `f_${severity}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO audit_flags (id, scene_id, severity, category, message, resolved) VALUES (?, 's1', ?, 'voice', 'm', 0)",
          )
          .run(id, severity),
      ).not.toThrow();
    }
  });

  it("rejects invalid severity", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO audit_flags (id, scene_id, severity, category, message, resolved) VALUES ('f1', 's1', 'fatal', 'voice', 'm', 0)",
        )
        .run(),
    ).toThrow(/audit_flags\.severity/i);
  });
});

describe("migration 002 — CHECK triggers: profile_adjustments.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid statuses", () => {
    for (const status of ["pending", "approved", "rejected", "applied", "dismissed"]) {
      const id = `a_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status) VALUES (?, 'p1', 'x', 0, 0, 'r', 0.5, '{}', ?)",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status) VALUES ('a1', 'p1', 'x', 0, 0, 'r', 0.5, '{}', 'bogus')",
        )
        .run(),
    ).toThrow(/profile_adjustments\.status/i);
  });
});

describe("migration 002 — CHECK triggers: learned_patterns.status", () => {
  beforeEach(() => {
    db.prepare("INSERT INTO projects (id, title, status) VALUES ('p1', 'T', 'bootstrap')").run();
  });

  it("accepts valid statuses", () => {
    for (const status of ["proposed", "approved", "rejected", "applied"]) {
      const id = `l_${status}`;
      expect(() =>
        db
          .prepare(
            "INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, created_at, updated_at) VALUES (?, 'p1', 't', '{}', 1, 0.5, ?, '2026-01-01', '2026-01-01')",
          )
          .run(id, status),
      ).not.toThrow();
    }
  });

  it("rejects invalid status", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, created_at, updated_at) VALUES ('l1', 'p1', 't', '{}', 1, 0.5, 'bogus', '2026-01-01', '2026-01-01')",
        )
        .run(),
    ).toThrow(/learned_patterns\.status/i);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test -- tests/server/db/migration-002.test.ts`

Expected: all tests fail — the migration file does not yet exist, so no indexes and no triggers are created.

- [ ] **Step 3: Create `server/db/migrations/002_indexes_and_checks.sql`**

Create `server/db/migrations/002_indexes_and_checks.sql`:

```sql
-- 002_indexes_and_checks.sql
--
-- Adds missing indexes surfaced by the #44 audit, and installs CHECK-like
-- triggers on enum-valued columns. SQLite does not support ALTER TABLE ADD
-- CHECK, so we emulate CHECK constraints using BEFORE INSERT / BEFORE UPDATE
-- triggers that call RAISE(ABORT, ...).
--
-- Trigger names encode the table and column so that the runtime error
-- messages ("projects.status ...") are greppable in logs and tests.

-- ---------------------------------------------------------------------------
-- Missing indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_scene_plans_project
  ON scene_plans(project_id);

CREATE INDEX IF NOT EXISTS idx_voice_guide_versions_created_at
  ON voice_guide_versions(created_at DESC);

-- ---------------------------------------------------------------------------
-- projects.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_projects_status_insert
BEFORE INSERT ON projects
FOR EACH ROW
WHEN NEW.status NOT IN ('bootstrap', 'bible', 'planning', 'drafting', 'revising')
BEGIN
  SELECT RAISE(ABORT, 'projects.status must be one of bootstrap|bible|planning|drafting|revising');
END;

CREATE TRIGGER IF NOT EXISTS chk_projects_status_update
BEFORE UPDATE OF status ON projects
FOR EACH ROW
WHEN NEW.status NOT IN ('bootstrap', 'bible', 'planning', 'drafting', 'revising')
BEGIN
  SELECT RAISE(ABORT, 'projects.status must be one of bootstrap|bible|planning|drafting|revising');
END;

-- ---------------------------------------------------------------------------
-- scene_plans.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_scene_plans_status_insert
BEFORE INSERT ON scene_plans
FOR EACH ROW
WHEN NEW.status NOT IN ('planned', 'drafting', 'complete')
BEGIN
  SELECT RAISE(ABORT, 'scene_plans.status must be one of planned|drafting|complete');
END;

CREATE TRIGGER IF NOT EXISTS chk_scene_plans_status_update
BEFORE UPDATE OF status ON scene_plans
FOR EACH ROW
WHEN NEW.status NOT IN ('planned', 'drafting', 'complete')
BEGIN
  SELECT RAISE(ABORT, 'scene_plans.status must be one of planned|drafting|complete');
END;

-- ---------------------------------------------------------------------------
-- audit_flags.severity
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_audit_flags_severity_insert
BEFORE INSERT ON audit_flags
FOR EACH ROW
WHEN NEW.severity NOT IN ('critical', 'warning', 'info')
BEGIN
  SELECT RAISE(ABORT, 'audit_flags.severity must be one of critical|warning|info');
END;

CREATE TRIGGER IF NOT EXISTS chk_audit_flags_severity_update
BEFORE UPDATE OF severity ON audit_flags
FOR EACH ROW
WHEN NEW.severity NOT IN ('critical', 'warning', 'info')
BEGIN
  SELECT RAISE(ABORT, 'audit_flags.severity must be one of critical|warning|info');
END;

-- ---------------------------------------------------------------------------
-- profile_adjustments.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_profile_adjustments_status_insert
BEFORE INSERT ON profile_adjustments
FOR EACH ROW
WHEN NEW.status NOT IN ('pending', 'approved', 'rejected', 'applied', 'dismissed')
BEGIN
  SELECT RAISE(ABORT, 'profile_adjustments.status must be one of pending|approved|rejected|applied|dismissed');
END;

CREATE TRIGGER IF NOT EXISTS chk_profile_adjustments_status_update
BEFORE UPDATE OF status ON profile_adjustments
FOR EACH ROW
WHEN NEW.status NOT IN ('pending', 'approved', 'rejected', 'applied', 'dismissed')
BEGIN
  SELECT RAISE(ABORT, 'profile_adjustments.status must be one of pending|approved|rejected|applied|dismissed');
END;

-- ---------------------------------------------------------------------------
-- learned_patterns.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_learned_patterns_status_insert
BEFORE INSERT ON learned_patterns
FOR EACH ROW
WHEN NEW.status NOT IN ('proposed', 'approved', 'rejected', 'applied')
BEGIN
  SELECT RAISE(ABORT, 'learned_patterns.status must be one of proposed|approved|rejected|applied');
END;

CREATE TRIGGER IF NOT EXISTS chk_learned_patterns_status_update
BEFORE UPDATE OF status ON learned_patterns
FOR EACH ROW
WHEN NEW.status NOT IN ('proposed', 'approved', 'rejected', 'applied')
BEGIN
  SELECT RAISE(ABORT, 'learned_patterns.status must be one of proposed|approved|rejected|applied');
END;
```

- [ ] **Step 4: Run the migration-002 tests and confirm they pass**

Run: `pnpm test -- tests/server/db/migration-002.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Write the failing test for graceful shutdown**

Create `tests/server/db/shutdown.test.ts`:

```ts
import { EventEmitter } from "node:events";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerShutdownHandlers } from "../../../server/db/shutdown.js";

let sigintListeners: Array<(...args: unknown[]) => void>;
let sigtermListeners: Array<(...args: unknown[]) => void>;

beforeEach(() => {
  sigintListeners = [];
  sigtermListeners = [];
  vi.spyOn(process, "on").mockImplementation(((event: string, handler: (...args: unknown[]) => void) => {
    if (event === "SIGINT") sigintListeners.push(handler);
    if (event === "SIGTERM") sigtermListeners.push(handler);
    return process;
  }) as typeof process.on);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFakeServer() {
  const emitter = new EventEmitter() as EventEmitter & {
    close: (cb: (err?: Error) => void) => void;
  };
  emitter.close = vi.fn((cb: (err?: Error) => void) => {
    // Simulate async drain completion
    setImmediate(() => cb());
  });
  return emitter;
}

describe("registerShutdownHandlers", () => {
  it("registers SIGINT and SIGTERM listeners", () => {
    const db = new Database(":memory:");
    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    expect(sigintListeners.length).toBe(1);
    expect(sigtermListeners.length).toBe(1);

    db.close();
  });

  it("on SIGTERM closes the HTTP server, closes the DB, and exits with code 0", async () => {
    const db = new Database(":memory:");
    const closeDbSpy = vi.spyOn(db, "close");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => undefined) as never);

    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    const handler = sigtermListeners[0];
    expect(handler).toBeDefined();
    await handler!();
    // setImmediate in server.close() needs to drain.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect((server.close as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(closeDbSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("shutdown is idempotent: second SIGTERM does not double-close the DB", async () => {
    const db = new Database(":memory:");
    const closeDbSpy = vi.spyOn(db, "close");
    vi.spyOn(process, "exit").mockImplementation(((_code?: number) => undefined) as never);

    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    const handler = sigtermListeners[0]!;
    await handler();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await handler();
    await new Promise((resolve) => setImmediate(resolve));

    expect(closeDbSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run the shutdown test and confirm it fails**

Run: `pnpm test -- tests/server/db/shutdown.test.ts`

Expected: all tests fail with a module-not-found error for `../../../server/db/shutdown.js`.

- [ ] **Step 7: Implement `server/db/shutdown.ts`**

Create `server/db/shutdown.ts`:

```ts
import type { Server } from "node:http";
import type Database from "better-sqlite3";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("db");

/**
 * Wires SIGTERM and SIGINT to a graceful drain sequence:
 *
 *   1. Stop accepting new HTTP connections via `server.close()`.
 *      Existing in-flight requests get to finish.
 *   2. Close the SQLite database handle.
 *   3. Exit with code 0.
 *
 * The handler is idempotent: a second signal while a shutdown is already in
 * flight is ignored. If `server.close()` fails to drain within 10 seconds,
 * we log and force-exit with code 1.
 */
export function registerShutdownHandlers(server: Server, db: Database.Database): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      logger.debug("shutdown already in progress; ignoring signal", { signal });
      return;
    }
    shuttingDown = true;
    logger.info("graceful shutdown starting", { signal });

    const forceExit = setTimeout(() => {
      logger.error("shutdown timed out after 10s; forcing exit");
      process.exit(1);
    }, 10_000);
    // Do not block the event loop on the timeout itself.
    if (typeof forceExit.unref === "function") forceExit.unref();

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          logger.warn("server.close reported error", { error: err.message });
        } else {
          logger.info("http server closed");
        }
        resolve();
      });
    });

    try {
      db.close();
      logger.info("database closed");
    } catch (err) {
      logger.error("db.close failed", err instanceof Error ? err : new Error(String(err)));
    }

    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
```

- [ ] **Step 8: Run the shutdown tests and confirm they pass**

Run: `pnpm test -- tests/server/db/shutdown.test.ts`

Expected: three tests pass.

- [ ] **Step 9: Wire `registerShutdownHandlers` into `server/proxy.ts`**

Edit `server/proxy.ts`. This is the ONE allowed modification outside `server/db/**` in this package.

Add the import at the top alongside the existing `getDatabase` import:

```ts
import { registerShutdownHandlers } from "./db/shutdown.js";
```

Inside the `if (process.env.NODE_ENV !== "test")` block, replace:

```ts
  app.listen(Number(PORT), HOST, () => {
    const displayHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
    console.log(`Proxy listening on http://${displayHost}:${PORT}`);
  });
```

with:

```ts
  const server = app.listen(Number(PORT), HOST, () => {
    const displayHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
    console.log(`Proxy listening on http://${displayHost}:${PORT}`);
  });
  registerShutdownHandlers(server, db);
```

Do NOT migrate the existing `console.log` / `console.error` / `console.warn` calls in this file — that is Package F2's job.

- [ ] **Step 10: Run the full DB test suite**

Run: `pnpm test -- tests/server/db`

Expected: green, including the pre-existing `repositories.test.ts`, `profile-repos.test.ts`, etc. If any existing test inserts rows with enum values outside the allowed sets above, treat that as a latent bug and update the test fixture to use a valid value — but **only** if the fixture lives in `tests/server/db/**`. If a fixture outside that tree would need updating, STOP and report the finding; do not edit files outside the scope boundary.

- [ ] **Step 11: Final gate**

Run: `pnpm check-all`

Expected: lint, typecheck, and full vitest suite all green.

- [ ] **Step 12: Commit**

```bash
git add server/db/shutdown.ts \
        server/db/migrations/002_indexes_and_checks.sql \
        server/proxy.ts \
        tests/server/db/shutdown.test.ts \
        tests/server/db/migration-002.test.ts
git commit -m "$(cat <<'EOF'
feat(db): graceful shutdown + missing indexes + CHECK constraints (#44)

- server/db/shutdown.ts: registerShutdownHandlers(server, db) wires
  SIGTERM/SIGINT to a drain sequence (server.close -> db.close ->
  exit(0)) with a 10s force-exit safety net and idempotent handling
  of repeat signals. Called once from server/proxy.ts at boot.

- server/db/migrations/002_indexes_and_checks.sql:
    * Adds idx_scene_plans_project (project_id) — deleteProject was
      full-scanning scene_plans on every project deletion.
    * Adds idx_voice_guide_versions_created_at — listVoiceGuideVersions
      orders by created_at DESC without a supporting index.
    * Installs BEFORE INSERT / BEFORE UPDATE triggers that emulate
      CHECK constraints for enum columns: projects.status,
      scene_plans.status, audit_flags.severity,
      profile_adjustments.status, learned_patterns.status. SQLite
      does not support ALTER TABLE ADD CHECK, so triggers + RAISE(ABORT)
      are the idiomatic workaround.

All new log lines use createLogger("db") from F1. Existing console.*
calls in server/proxy.ts are intentionally left for Package F2.

The only file outside server/db/** touched by this commit is
server/proxy.ts, and only to add the shutdown wiring — explicitly
allowed by the scope boundary.

Closes #44.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(db): package A — transactions + migrations + hardening (#25 #26 #44)" --body "$(cat <<'EOF'
## Summary
- **#25 Transactions:** New `server/db/transaction.ts` with `withTransaction(db, fn)` wrapper. Wrapped `saveVoiceGuide` and `saveProjectVoiceGuide` (both previously `DELETE`+`INSERT` with no atomicity). Added `saveVoiceGuideAndVersion` composite for the CIPHER flow.
- **#26 Migrations:** Hand-rolled numbered-file runner in `server/db/migrations.ts` backed by a `schema_migrations` version table. Baseline `001_baseline.sql` is a no-op; the existing `createSchema()` remains the source of truth for the initial schema. Forward evolution ships as `002+`.
- **#44 Hardening:** `registerShutdownHandlers` wires SIGTERM/SIGINT in `server/proxy.ts` to drain Express then close SQLite. `002_indexes_and_checks.sql` adds two missing indexes and installs CHECK-constraint triggers on five enum columns (SQLite has no `ALTER TABLE ADD CHECK`).

All new log lines use `createLogger("db")` / `createLogger("migrations")` from the F1 logger. No existing `console.*` calls were migrated — that is Package F2's job.

Part of the [p1 parallel batch spec](../blob/main/docs/superpowers/specs/2026-04-15-p1-parallel-batch-design.md).

## Scope boundary

Touched only `server/db/**`, `tests/server/db/**`, and a single addition to `server/proxy.ts` (the shutdown wiring, explicitly allowed by the plan). No changes under `server/api/**` or `src/**`.

## Test plan
- [ ] `pnpm check-all` green
- [ ] `tests/server/db/transaction.test.ts` — 4 tests pass
- [ ] `tests/server/db/transactions.repositories.test.ts` — 4 tests pass
- [ ] `tests/server/db/migrations.test.ts` — 7 tests pass
- [ ] `tests/server/db/migration-002.test.ts` — 12 tests pass
- [ ] `tests/server/db/shutdown.test.ts` — 3 tests pass
- [ ] Pre-existing `tests/server/db/**` suites remain green

Closes #25, #26, #44.

Generated with Claude Code.
EOF
)"
```

---

## Done criteria

- `server/db/transaction.ts` exists; `withTransaction` is used by `saveVoiceGuide`, `saveProjectVoiceGuide`, and the new `saveVoiceGuideAndVersion`.
- `server/db/migrations.ts` exists; `schema_migrations` table is created on first boot; `runMigrations` is invoked from `getDatabase`.
- `server/db/migrations/001_baseline.sql` and `server/db/migrations/002_indexes_and_checks.sql` exist and apply cleanly against a fresh in-memory database.
- `idx_scene_plans_project` and `idx_voice_guide_versions_created_at` are present after migrations run.
- CHECK-constraint triggers exist for `projects.status`, `scene_plans.status`, `audit_flags.severity`, `profile_adjustments.status`, and `learned_patterns.status`. Attempting to insert or update any of these columns with a disallowed value raises an ABORT error whose message names the column.
- `server/db/shutdown.ts` exists and is wired from `server/proxy.ts`. SIGTERM/SIGINT drains Express, closes SQLite, and exits cleanly; a second signal is a no-op.
- Every new log line uses `createLogger("db")` or `createLogger("migrations")`; no new `console.*` calls introduced.
- Files outside the scope boundary are untouched except for the single additive block in `server/proxy.ts`.
- `pnpm check-all` green on the branch.
- PR open against `main` with title `feat(db): package A — transactions + migrations + hardening (#25 #26 #44)`.
