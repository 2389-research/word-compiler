import type Database from "better-sqlite3";
import type { LearnedPattern, PatternData, ProposedAction } from "../../../src/learner/patterns.js";
import { generateId } from "../../../src/types/index.js";

interface LearnedPatternRow {
  id: string;
  project_id: string;
  pattern_type: string;
  pattern_data: string;
  occurrences: number;
  confidence: number;
  status: string;
  proposed_action: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPattern(row: LearnedPatternRow): LearnedPattern {
  return {
    id: row.id,
    projectId: row.project_id,
    patternType: row.pattern_type as LearnedPattern["patternType"],
    patternData: JSON.parse(row.pattern_data) as PatternData,
    occurrences: row.occurrences,
    confidence: row.confidence,
    status: row.status as LearnedPattern["status"],
    proposedAction: row.proposed_action ? (JSON.parse(row.proposed_action) as ProposedAction) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createLearnedPattern(
  db: Database.Database,
  pattern: Omit<LearnedPattern, "id" | "createdAt" | "updatedAt">,
): LearnedPattern {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO learned_patterns (id, project_id, pattern_type, pattern_data, occurrences, confidence, status, proposed_action, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    pattern.projectId,
    pattern.patternType,
    JSON.stringify(pattern.patternData),
    pattern.occurrences,
    pattern.confidence,
    pattern.status,
    pattern.proposedAction ? JSON.stringify(pattern.proposedAction) : null,
    now,
    now,
  );
  return {
    ...pattern,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export function listLearnedPatterns(db: Database.Database, projectId: string, status?: string): LearnedPattern[] {
  if (status) {
    const rows = db
      .prepare("SELECT * FROM learned_patterns WHERE project_id = ? AND status = ? ORDER BY confidence DESC")
      .all(projectId, status) as LearnedPatternRow[];
    return rows.map(rowToPattern);
  }
  const rows = db
    .prepare("SELECT * FROM learned_patterns WHERE project_id = ? ORDER BY confidence DESC")
    .all(projectId) as LearnedPatternRow[];
  return rows.map(rowToPattern);
}

export function updateLearnedPatternStatus(
  db: Database.Database,
  id: string,
  status: LearnedPattern["status"],
): boolean {
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE learned_patterns SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
  return result.changes > 0;
}

export function deleteLearnedPatternsForProject(db: Database.Database, projectId: string): number {
  const result = db.prepare("DELETE FROM learned_patterns WHERE project_id = ?").run(projectId);
  return result.changes;
}
