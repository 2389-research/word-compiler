import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as significantEditsRepo from "../../../server/db/repositories/significant-edits.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";
import { makeSignificantEdit } from "../../helpers/serverFactories.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

// IMPORTANT: the returned statement object must match every column in the
// `preference_statements` table, because the route calls
// preferenceStatementsRepo.createPreferenceStatement(db, statement) which
// runs a real INSERT. Required columns per
// `server/db/repositories/preference-statements.ts`:
//   id, projectId, statement, editCount, createdAt
vi.mock("../../../server/profile/cipher.js", () => ({
  CIPHER_BATCH_SIZE: 10,
  inferBatchPreferences: vi.fn(async (_client: unknown, projectId: string) => ({
    id: "stmt-1",
    projectId,
    statement: "Mocked preference statement.",
    editCount: 1,
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: vi.fn(async () => ({ ring1Injection: "updated" })),
  distillVoice: vi.fn(async () => "redistilled ring1 injection"),
}));

beforeEach(() => {
  silenceConsole();
});

describe("POST /api/projects/:projectId/cipher/batch", () => {
  it("returns { statement: null } when there are no unprocessed edits", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app).post("/api/projects/proj-empty/cipher/batch");
    expect(res.status).toBe(200);
    const body = unwrap<{ statement: null }>(res);
    expect(body).toEqual({ statement: null });
  });

  it("returns 500 when Anthropic client is not configured", async () => {
    const { app, db } = makeApiTestApp();
    // Ensure project exists (FK constraint on significant_edits.project_id).
    db.prepare("INSERT INTO projects (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      "proj-x",
      "Test",
      "drafting",
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const edit = makeSignificantEdit({ id: "e1", projectId: "proj-x" });
    significantEditsRepo.createSignificantEdit(db, edit);
    const res = await request(app).post("/api/projects/proj-x/cipher/batch");
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 201 with statement and marks edits processed on success", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    // Ensure project exists (FK constraint on significant_edits.project_id).
    db.prepare("INSERT INTO projects (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      "proj-y",
      "Test",
      "drafting",
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const edit = makeSignificantEdit({ id: "e2", projectId: "proj-y" });
    significantEditsRepo.createSignificantEdit(db, edit);

    const res = await request(app).post("/api/projects/proj-y/cipher/batch");
    expect(res.status).toBe(201);
    const body = unwrap<{ statement: { statement: string }; ring1Injection: string }>(res);
    expect(body.statement).toBeDefined();
    expect(body.statement.statement).toBe("Mocked preference statement.");
    expect(body.ring1Injection).toBe("redistilled ring1 injection");

    // Edits marked processed
    const remaining = significantEditsRepo.listUnprocessedEdits(db, "proj-y");
    expect(remaining).toHaveLength(0);
  });
});
