import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { generateId, makeCompilationLog } from "../../helpers/factories.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let _db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  _db = testApp.db;
});

describe("POST /api/compilation-logs", () => {
  it("creates a compilation log and returns 201", async () => {
    const chunkId = generateId();
    const log = makeCompilationLog(chunkId);

    const res = await request(app).post("/api/compilation-logs").send(log);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: log.id,
        chunkId,
        ring1Tokens: 100,
        ring2Tokens: 50,
        ring3Tokens: 200,
        totalTokens: 350,
        availableBudget: 198000,
        ring1Contents: ["HEADER"],
        ring2Contents: [],
        ring3Contents: ["SCENE_CONTRACT"],
        lintWarnings: [],
        lintErrors: [],
      }),
    );
  });
});

describe("GET /api/compilation-logs/:id", () => {
  it("returns the log when it exists", async () => {
    const chunkId = generateId();
    const log = makeCompilationLog(chunkId);
    await request(app).post("/api/compilation-logs").send(log);

    const res = await request(app).get(`/api/compilation-logs/${log.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: log.id,
        chunkId,
        totalTokens: 350,
      }),
    );
  });

  it("returns 404 for a nonexistent log", async () => {
    const res = await request(app).get("/api/compilation-logs/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Log not found" });
  });
});

describe("GET /api/chunks/:chunkId/compilation-logs", () => {
  it("returns an empty array when no logs exist for the chunk", async () => {
    const chunkId = generateId();

    const res = await request(app).get(`/api/chunks/${chunkId}/compilation-logs`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists logs for a chunk ordered by timestamp descending", async () => {
    const chunkId = generateId();
    const olderLog = makeCompilationLog(chunkId, {
      timestamp: "2024-01-01T00:00:00Z",
      totalTokens: 100,
    });
    const newerLog = makeCompilationLog(chunkId, {
      timestamp: "2024-06-01T00:00:00Z",
      totalTokens: 500,
    });

    // Insert older first, then newer
    await request(app).post("/api/compilation-logs").send(olderLog);
    await request(app).post("/api/compilation-logs").send(newerLog);

    const res = await request(app).get(`/api/chunks/${chunkId}/compilation-logs`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Newer should come first (descending by created_at / timestamp)
    expect(res.body[0].totalTokens).toBe(500);
    expect(res.body[1].totalTokens).toBe(100);
  });
});
