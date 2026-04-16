import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as projectVoiceGuideRepo from "../../../server/db/repositories/project-voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeVoiceGuide } from "../../helpers/serverFactories.js";
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

describe("GET /api/projects/:projectId/project-voice-guide", () => {
  it("returns { guide: null } when no guide is saved for the project", async () => {
    const res = await request(app).get("/api/projects/no-guide/project-voice-guide");
    expect(res.status).toBe(200);
    const body = unwrap<{ guide: null }>(res);
    expect(body).toEqual({ guide: null });
  });

  it("returns the saved guide when present", async () => {
    // Ensure project exists (FK constraint on project_voice_guide.project_id).
    db.prepare("INSERT INTO projects (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      "proj-42",
      "Test",
      "drafting",
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const guide = makeVoiceGuide({ ring1Injection: "project voice" });
    projectVoiceGuideRepo.saveProjectVoiceGuide(db, "proj-42", guide);

    const res = await request(app).get("/api/projects/proj-42/project-voice-guide");
    expect(res.status).toBe(200);
    const body = unwrap<{ guide: { ring1Injection: string } }>(res);
    expect(body.guide).not.toBeNull();
    expect(body.guide.ring1Injection).toBe("project voice");
  });
});
