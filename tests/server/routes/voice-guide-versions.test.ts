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

describe("GET /api/voice-guide/versions", () => {
  it("returns an empty array when no versions exist", async () => {
    const res = await request(app).get("/api/voice-guide/versions");
    expect(res.status).toBe(200);
    const body = unwrap<unknown[]>(res);
    expect(body).toEqual([]);
  });

  it("lists saved voice-guide versions", async () => {
    const guide1 = makeVoiceGuide({
      version: "1.0.0",
      versionHistory: [
        {
          version: "1.0.0",
          updatedAt: "2024-01-01T00:00:00Z",
          changeReason: "Initial",
          changeSummary: "First version",
          confirmedFeatures: [],
          contradictedFeatures: [],
          newFeatures: [],
        },
      ],
    });
    const guide2 = makeVoiceGuide({
      version: "2.0.0",
      versionHistory: [
        {
          version: "2.0.0",
          updatedAt: "2024-02-01T00:00:00Z",
          changeReason: "Update",
          changeSummary: "Second version",
          confirmedFeatures: [],
          contradictedFeatures: [],
          newFeatures: [],
        },
      ],
    });
    voiceGuideRepo.saveVoiceGuideVersion(db, guide1);
    voiceGuideRepo.saveVoiceGuideVersion(db, guide2);

    const res = await request(app).get("/api/voice-guide/versions");
    expect(res.status).toBe(200);
    const body = unwrap<unknown[]>(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
  });
});
