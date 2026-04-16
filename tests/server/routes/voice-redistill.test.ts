import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as voiceGuideRepo from "../../../server/db/repositories/voice-guide.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";
import { makeVoiceGuide } from "../../helpers/serverFactories.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

vi.mock("../../../server/profile/projectGuide.js", () => ({
  updateProjectVoice: vi.fn(),
  distillVoice: vi.fn(async () => "distilled output"),
}));

beforeEach(() => {
  silenceConsole();
});

describe("POST /api/projects/:projectId/voice/redistill", () => {
  it("returns 500 when Anthropic client is not configured", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/projects/p/voice/redistill");
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns { skipped: true } when there are no sources at all", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app).post("/api/projects/empty-proj/voice/redistill");
    expect(res.status).toBe(200);
    const body = unwrap<{ ring1Injection: string; skipped: boolean }>(res);
    expect(body).toEqual({ ring1Injection: "", skipped: true });
  });

  it("returns the distilled ring1Injection when a source exists", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    const guide = makeVoiceGuide({ ring1Injection: "existing" });
    voiceGuideRepo.saveVoiceGuide(db, guide);

    const res = await request(app).post("/api/projects/proj-rd/voice/redistill");
    expect(res.status).toBe(200);
    const body = unwrap<{ ring1Injection: string }>(res);
    expect(body.ring1Injection).toBe("distilled output");
  });
});
