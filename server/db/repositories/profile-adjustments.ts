import type Database from "better-sqlite3";
import type { TuningEvidence, TuningProposal } from "../../../src/learner/tuning.js";
import { generateId } from "../../../src/types/index.js";
import { safeJsonParse } from "../helpers.js";

interface ProfileAdjustmentRow {
  id: string;
  project_id: string;
  parameter: string;
  current_value: number;
  suggested_value: number;
  rationale: string;
  confidence: number;
  evidence: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToProposal(row: ProfileAdjustmentRow): TuningProposal | null {
  const evidence = safeJsonParse<TuningEvidence>(row.evidence, "profile_adjustments.rowToProposal");
  if (!evidence) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    parameter: row.parameter,
    currentValue: row.current_value,
    suggestedValue: row.suggested_value,
    rationale: row.rationale,
    confidence: row.confidence,
    evidence,
    status: row.status as TuningProposal["status"],
    createdAt: row.created_at,
  };
}

export function createProfileAdjustment(
  db: Database.Database,
  proposal: Omit<TuningProposal, "id" | "createdAt">,
): TuningProposal {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO profile_adjustments (id, project_id, parameter, current_value, suggested_value, rationale, confidence, evidence, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    proposal.projectId,
    proposal.parameter,
    proposal.currentValue,
    proposal.suggestedValue,
    proposal.rationale,
    proposal.confidence,
    JSON.stringify(proposal.evidence),
    proposal.status,
    now,
    now,
  );
  return {
    ...proposal,
    id,
    createdAt: now,
  };
}

export function listProfileAdjustments(db: Database.Database, projectId: string, status?: string): TuningProposal[] {
  if (status) {
    const rows = db
      .prepare("SELECT * FROM profile_adjustments WHERE project_id = ? AND status = ? ORDER BY created_at DESC")
      .all(projectId, status) as ProfileAdjustmentRow[];
    return rows.map(rowToProposal).filter((p): p is TuningProposal => p !== null);
  }
  const rows = db
    .prepare("SELECT * FROM profile_adjustments WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as ProfileAdjustmentRow[];
  return rows.map(rowToProposal).filter((p): p is TuningProposal => p !== null);
}

export function updateProfileAdjustmentStatus(
  db: Database.Database,
  id: string,
  status: TuningProposal["status"],
): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE profile_adjustments SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, now, id);
  return result.changes > 0;
}

export function deleteProfileAdjustmentsForProject(db: Database.Database, projectId: string): number {
  const result = db.prepare("DELETE FROM profile_adjustments WHERE project_id = ?").run(projectId);
  return result.changes;
}
