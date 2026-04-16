import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeApiTestAppWithAnthropic } from "../../helpers/apiTestAppWithAnthropic.js";
import { makeVoiceGuide, makeWritingSample } from "../../helpers/serverFactories.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";

const runPipeline = vi.fn();

vi.mock("../../../server/profile/pipeline.js", () => ({
  runPipeline: (...args: unknown[]) => runPipeline(...args),
}));

beforeEach(() => {
  silenceConsole();
  runPipeline.mockReset();
  runPipeline.mockResolvedValue(makeVoiceGuide({ ring1Injection: "generated injection" }));
});

describe("POST /api/voice-guide/generate", () => {
  it("returns 400 when sampleIds is missing", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/voice-guide/generate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sampleIds");
  });

  it("returns 400 when sampleIds is an empty array", async () => {
    const { app } = makeApiTestApp();
    const res = await request(app).post("/api/voice-guide/generate").send({ sampleIds: [] });
    expect(res.status).toBe(400);
  });

  it("returns 404 when no writing samples match the supplied IDs", async () => {
    const { app } = makeApiTestAppWithAnthropic();
    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: ["nonexistent-id"] });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("No writing samples");
  });

  it("returns 500 when Anthropic client is not configured", async () => {
    const { app, db } = makeApiTestApp();
    const sample = makeWritingSample({ id: "s1" });
    writingSampleRepo.createWritingSampleRecord(db, sample);

    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: [sample.id] });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Anthropic");
  });

  it("returns 500 when runPipeline throws", async () => {
    runPipeline.mockRejectedValueOnce(new Error("pipeline crash"));
    const { app, db } = makeApiTestAppWithAnthropic();
    const sample = makeWritingSample({ id: "s-throw" });
    writingSampleRepo.createWritingSampleRecord(db, sample);
    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: ["s-throw"] });
    expect(res.status).toBe(500);
    const body = res.body as { error?: string | { message?: string } };
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    expect(msg).toContain("pipeline crash");
  });

  it("returns 201 with generated guide when pipeline succeeds", async () => {
    const { app, db } = makeApiTestAppWithAnthropic();
    const sample = makeWritingSample({ id: "s2" });
    writingSampleRepo.createWritingSampleRecord(db, sample);

    const res = await request(app)
      .post("/api/voice-guide/generate")
      .send({ sampleIds: [sample.id] });
    expect(res.status).toBe(201);
    expect(res.body.ring1Injection).toBe("generated injection");
  });
});
