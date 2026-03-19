import type Database from "better-sqlite3";
import type { AuditFlag, AuditStats } from "../../../src/types/index.js";

export function createAuditFlag(db: Database.Database, flag: AuditFlag): AuditFlag {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_flags (id, scene_id, severity, category, message, line_reference, resolved, resolved_action, was_actionable, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    flag.id,
    flag.sceneId,
    flag.severity,
    flag.category,
    flag.message,
    flag.lineReference ?? null,
    flag.resolved ? 1 : 0,
    flag.resolvedAction ?? null,
    flag.wasActionable == null ? null : flag.wasActionable ? 1 : 0,
    now,
    now,
  );
  return flag;
}

export function createAuditFlags(db: Database.Database, flags: AuditFlag[]): AuditFlag[] {
  const insert = db.prepare(
    `INSERT INTO audit_flags (id, scene_id, severity, category, message, line_reference, resolved, resolved_action, was_actionable, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const flag of flags) {
      insert.run(
        flag.id,
        flag.sceneId,
        flag.severity,
        flag.category,
        flag.message,
        flag.lineReference ?? null,
        flag.resolved ? 1 : 0,
        flag.resolvedAction ?? null,
        flag.wasActionable == null ? null : flag.wasActionable ? 1 : 0,
        now,
        now,
      );
    }
  });
  tx();
  return flags;
}

export function listAuditFlags(db: Database.Database, sceneId: string): AuditFlag[] {
  const rows = db
    .prepare(
      `SELECT * FROM audit_flags WHERE scene_id = ? ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
    )
    .all(sceneId) as any[];
  return rows.map(rowToFlag);
}

export function resolveAuditFlag(db: Database.Database, id: string, action: string, wasActionable: boolean): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE audit_flags SET resolved = 1, resolved_action = ?, was_actionable = ?, updated_at = ? WHERE id = ?`,
    )
    .run(action, wasActionable ? 1 : 0, now, id);
  return result.changes > 0;
}

export function getAuditStats(db: Database.Database, sceneId: string): AuditStats {
  const flags = listAuditFlags(db, sceneId);
  const resolved = flags.filter((f) => f.resolved);
  const actionable = resolved.filter((f) => f.wasActionable === true);
  const dismissed = resolved.filter((f) => f.wasActionable === false);
  const pending = flags.filter((f) => !f.resolved);
  const decided = actionable.length + dismissed.length;

  const byCategory: Record<string, { total: number; actionable: number }> = {};
  for (const flag of flags) {
    const cat = byCategory[flag.category] ?? { total: 0, actionable: 0 };
    cat.total++;
    if (flag.wasActionable === true) cat.actionable++;
    byCategory[flag.category] = cat;
  }

  return {
    total: flags.length,
    resolved: resolved.length,
    actionable: actionable.length,
    dismissed: dismissed.length,
    pending: pending.length,
    nonActionable: dismissed.length,
    signalToNoiseRatio: decided > 0 ? actionable.length / decided : 1,
    byCategory,
  };
}

function rowToFlag(row: any): AuditFlag {
  return {
    id: row.id,
    sceneId: row.scene_id,
    severity: row.severity,
    category: row.category,
    message: row.message,
    lineReference: row.line_reference,
    resolved: row.resolved === 1,
    resolvedAction: row.resolved_action,
    wasActionable: row.was_actionable === null ? null : row.was_actionable === 1,
  };
}
