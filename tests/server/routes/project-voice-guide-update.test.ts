import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as projectVoiceGuideRepo from "../../../server/db/repositories/project-voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";
import { makeVoiceGuide } from "../../helpers/serverFactories.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

const updateProjectVoice = vi.fn();
const distillVoice = vi.fn();

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: (...args: unknown[]) => updateProjectVoice(...args),
  distillVoice: (...args: unknown[]) => distillVoice(...args),
}));

beforeEach(() => {
  updateProjectVoice.mockReset();
  distillVoice.mockReset();
  silenceConsole();
});

describe("POST /api/projects/:projectId/project-voice-guide/update", () => {
  it("returns 500 when Anthropic client is not configured", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app)
      .post("/api/projects/p/project-voice-guide/update")
      .send({ sceneId: "s1", sceneText: "Text." });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 201 with updated project guide and distilled injection", async () => {
    const guide = makeVoiceGuide({ ring1Injection: "new project voice" });
    updateProjectVoice.mockResolvedValue(guide);
    distillVoice.mockResolvedValue("final distilled");

    const { app, db } = makeApiTestAppWithAnthropic();
    // Ensure project exists (FK constraint on project_voice_guide.project_id).
    db.prepare("INSERT INTO projects (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      "proj-upd",
      "Test",
      "drafting",
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const res = await request(app)
      .post("/api/projects/proj-upd/project-voice-guide/update")
      .send({ sceneId: "s1", sceneText: "Scene prose." });

    expect(res.status).toBe(201);
    const body = unwrap<{ projectGuide: { ring1Injection: string }; ring1Injection: string }>(res);
    expect(body.projectGuide.ring1Injection).toBe("new project voice");
    expect(body.ring1Injection).toBe("final distilled");
    expect(updateProjectVoice).toHaveBeenCalledTimes(1);
    expect(distillVoice).toHaveBeenCalledTimes(1);

    // Verify the DB side effect.
    const stored = projectVoiceGuideRepo.getProjectVoiceGuide(db, "proj-upd");
    expect(stored).not.toBeNull();
    expect(stored!.ring1Injection).toBe("new project voice");
  });

  it("returns 500 when a downstream profile call throws", async () => {
    updateProjectVoice.mockRejectedValue(new Error("profile crash"));

    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app)
      .post("/api/projects/proj-err/project-voice-guide/update")
      .send({ sceneId: "s2", sceneText: "x" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("profile crash");
  });
});
