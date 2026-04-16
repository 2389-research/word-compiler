import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as significantEditsRepo from "../../../server/db/repositories/significant-edits.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  silenceConsole();
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("POST /api/projects/:projectId/significant-edits", () => {
  it("creates an edit and returns the unprocessed count", async () => {
    const res = await request(app)
      .post("/api/projects/proj-1/significant-edits")
      .send({ chunkId: "c-1", originalText: "Before edit.", editedText: "After edit." });

    expect(res.status).toBe(201);
    const body = unwrap<{ count: number }>(res);
    expect(body.count).toBe(1);

    const stored = significantEditsRepo.listUnprocessedEdits(db, "proj-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.originalText).toBe("Before edit.");
    expect(stored[0]!.editedText).toBe("After edit.");
    expect(stored[0]!.processed).toBe(false);
    expect(stored[0]!.id).toBeDefined();
  });

  it("increments the count for subsequent edits on the same project", async () => {
    await request(app)
      .post("/api/projects/proj-2/significant-edits")
      .send({ chunkId: "c-a", originalText: "o1", editedText: "e1" });
    const res = await request(app)
      .post("/api/projects/proj-2/significant-edits")
      .send({ chunkId: "c-b", originalText: "o2", editedText: "e2" });

    expect(res.status).toBe(201);
    const body = unwrap<{ count: number }>(res);
    expect(body.count).toBe(2);
  });

  it("auto-creates the project row if it does not exist yet", async () => {
    const res = await request(app)
      .post("/api/projects/auto-created/significant-edits")
      .send({ chunkId: "c-x", originalText: "a", editedText: "b" });

    expect(res.status).toBe(201);
    const projectRow = db.prepare("SELECT id FROM projects WHERE id = ?").get("auto-created");
    expect(projectRow).toBeDefined();
  });
});
