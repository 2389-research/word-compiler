import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as voiceGuideRepo from "../../../server/db/repositories/voice-guide.js";
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

describe("GET /api/voice-guide", () => {
  it("returns { guide: null } when no voice guide exists", async () => {
    const res = await request(app).get("/api/voice-guide");
    expect(res.status).toBe(200);
    const body = unwrap<{ guide: null }>(res);
    expect(body).toEqual({ guide: null });
  });

  it("returns { guide } when a guide exists", async () => {
    const guide = makeVoiceGuide({ ring1Injection: "Write in a literary voice." });
    voiceGuideRepo.saveVoiceGuide(db, guide);

    const res = await request(app).get("/api/voice-guide");
    expect(res.status).toBe(200);
    const body = unwrap<{ guide: { ring1Injection: string } }>(res);
    expect(body.guide).not.toBeNull();
    expect(body.guide.ring1Injection).toBe("Write in a literary voice.");
  });
});
