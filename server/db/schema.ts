import type Database from "better-sqlite3";

export function createSchema(db: Database.Database): void {
  db.exec(`
    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'bootstrap',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bibles (versioned per project)
    CREATE TABLE IF NOT EXISTS bibles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version INTEGER NOT NULL DEFAULT 1,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_bibles_project ON bibles(project_id, version);

    -- Chapter Arcs
    CREATE TABLE IF NOT EXISTS chapter_arcs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      chapter_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, chapter_number)
    );
    CREATE INDEX IF NOT EXISTS idx_chapter_arcs_project ON chapter_arcs(project_id);

    -- Scene Plans
    CREATE TABLE IF NOT EXISTS scene_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      chapter_id TEXT REFERENCES chapter_arcs(id),
      scene_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_scene_plans_chapter ON scene_plans(chapter_id, scene_order);

    -- Chunks
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scene_plans(id),
      sequence_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_scene ON chunks(scene_id, sequence_number);

    -- Compilation Logs
    CREATE TABLE IF NOT EXISTS compilation_logs (
      id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_compilation_logs_chunk ON compilation_logs(chunk_id);

    -- Audit Flags
    CREATE TABLE IF NOT EXISTS audit_flags (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL REFERENCES scene_plans(id),
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      line_reference TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_action TEXT,
      was_actionable INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_flags_scene ON audit_flags(scene_id, resolved);

    -- Compiled Payloads (cached for debugging)
    CREATE TABLE IF NOT EXISTS compiled_payloads (
      id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_compiled_payloads_chunk ON compiled_payloads(chunk_id);
  `);
}
