import type Database from "better-sqlite3";
import type { VoiceGuide } from "../../../src/profile/types.js";
import { generateId } from "../../../src/types/utils.js";

interface ProjectVoiceGuideRow {
  id: string;
  project_id: string;
  version: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export function getProjectVoiceGuide(db: Database.Database, projectId: string): VoiceGuide | null {
  const row = db.prepare("SELECT * FROM project_voice_guide WHERE project_id = ?").get(projectId) as
    | ProjectVoiceGuideRow
    | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as VoiceGuide;
}

export function saveProjectVoiceGuide(db: Database.Database, projectId: string, guide: VoiceGuide): void {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM project_voice_guide WHERE project_id = ?").run(projectId);
  db.prepare(
    `INSERT INTO project_voice_guide (id, project_id, version, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(generateId(), projectId, guide.version, JSON.stringify(guide), now, now);
}

export function deleteProjectVoiceGuide(db: Database.Database, projectId: string): boolean {
  const result = db.prepare("DELETE FROM project_voice_guide WHERE project_id = ?").run(projectId);
  return result.changes > 0;
}
