import type Database from "better-sqlite3";
import type { Project } from "../../../src/types/index.js";

export function createProject(db: Database.Database, project: Project): Project {
  db.prepare(
    `INSERT INTO projects (id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(project.id, project.title, project.status, project.createdAt, project.updatedAt);
  return project;
}

export function getProject(db: Database.Database, id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(db: Database.Database): Project[] {
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as any[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateProject(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<Project, "title" | "status">>,
): Project | null {
  const existing = getProject(db, id);
  if (!existing) return null;

  const title = updates.title ?? existing.title;
  const status = updates.status ?? existing.status;
  const updatedAt = new Date().toISOString();

  db.prepare(`UPDATE projects SET title = ?, status = ?, updated_at = ? WHERE id = ?`).run(
    title,
    status,
    updatedAt,
    id,
  );

  return { ...existing, title, status, updatedAt };
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const deleteAll = db.transaction((projectId: string) => {
    // Delete leaf records first, then parents
    // Chunks, compilation logs, compiled payloads, audit flags, narrative IRs reference scene_plans
    const sceneIds = db
      .prepare("SELECT id FROM scene_plans WHERE project_id = ?")
      .all(projectId)
      .map((r) => (r as { id: string }).id);

    // Delete edit_patterns first — they reference both chunks and scenes via FK
    db.prepare("DELETE FROM edit_patterns WHERE project_id = ?").run(projectId);

    for (const sceneId of sceneIds) {
      // Delete logs/payloads before chunks (they reference chunk IDs but have no FK constraint)
      const chunkIds = db
        .prepare("SELECT id FROM chunks WHERE scene_id = ?")
        .all(sceneId)
        .map((r) => (r as { id: string }).id);
      for (const chunkId of chunkIds) {
        db.prepare("DELETE FROM compilation_logs WHERE chunk_id = ?").run(chunkId);
        db.prepare("DELETE FROM compiled_payloads WHERE chunk_id = ?").run(chunkId);
      }
      db.prepare("DELETE FROM chunks WHERE scene_id = ?").run(sceneId);
      db.prepare("DELETE FROM audit_flags WHERE scene_id = ?").run(sceneId);
      db.prepare("DELETE FROM narrative_irs WHERE scene_id = ?").run(sceneId);
    }

    db.prepare("DELETE FROM significant_edits WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM preference_statements WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM scene_plans WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM chapter_arcs WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM bibles WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM learned_patterns WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM profile_adjustments WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_voice_guide WHERE project_id = ?").run(projectId);

    const result = db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    return result.changes > 0;
  });

  return deleteAll(id);
}
