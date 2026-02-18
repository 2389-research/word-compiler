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

export function updateProject(db: Database.Database, id: string, updates: Partial<Pick<Project, "title" | "status">>): Project | null {
  const existing = getProject(db, id);
  if (!existing) return null;

  const title = updates.title ?? existing.title;
  const status = updates.status ?? existing.status;
  const updatedAt = new Date().toISOString();

  db.prepare(
    `UPDATE projects SET title = ?, status = ?, updated_at = ? WHERE id = ?`,
  ).run(title, status, updatedAt, id);

  return { ...existing, title, status, updatedAt };
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}
