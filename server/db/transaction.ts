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
