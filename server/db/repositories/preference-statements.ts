import type Database from "better-sqlite3";
import type { PreferenceStatement } from "../../../src/profile/types.js";

interface PreferenceStatementRow {
  id: string;
  project_id: string;
  statement: string;
  edit_count: number;
  created_at: string;
}

function rowToStatement(row: PreferenceStatementRow): PreferenceStatement {
  return {
    id: row.id,
    projectId: row.project_id,
    statement: row.statement,
    editCount: row.edit_count,
    createdAt: row.created_at,
  };
}

export function createPreferenceStatement(db: Database.Database, statement: PreferenceStatement): PreferenceStatement {
  db.prepare(
    `INSERT INTO preference_statements (id, project_id, statement, edit_count, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(statement.id, statement.projectId, statement.statement, statement.editCount, statement.createdAt);
  return statement;
}

export function listPreferenceStatements(db: Database.Database, projectId: string): PreferenceStatement[] {
  const rows = db
    .prepare("SELECT * FROM preference_statements WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as PreferenceStatementRow[];
  return rows.map(rowToStatement);
}

/** Read all CIPHER preferences across all projects — author-scoped for distillation. */
export function listAllPreferenceStatements(db: Database.Database): PreferenceStatement[] {
  const rows = db.prepare("SELECT * FROM preference_statements ORDER BY created_at").all() as PreferenceStatementRow[];
  return rows.map(rowToStatement);
}
