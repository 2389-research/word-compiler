import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("migrations");

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

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
  const directory = options.directory ?? MIGRATIONS_DIR;

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
