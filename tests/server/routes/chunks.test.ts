import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as chunks from "../../../server/db/repositories/chunks.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { createEmptyScenePlan, makeChapterArc, makeChunk, makeProject } from "../../helpers/factories.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

/** Seeds the full FK chain: project -> chapter arc -> scene plan. Returns the scene plan. */
function seedSceneChain() {
  const p = makeProject();
  projects.createProject(db, p);
  const arc = makeChapterArc(p.id, { chapterNumber: 1 });
  const createdArc = chapterArcs.createChapterArc(db, arc);
  const plan = { ...createEmptyScenePlan(p.id), chapterId: createdArc.id };
  scenePlans.createScenePlan(db, plan, 0);
  return { project: p, chapter: createdArc, scene: plan };
}

describe("GET /api/scenes/:sceneId/chunks", () => {
  it("lists chunks ordered by sequence_number", async () => {
    const { scene } = seedSceneChain();
    const c1 = makeChunk(scene.id, 1, { generatedText: "First chunk" });
    const c2 = makeChunk(scene.id, 3, { generatedText: "Third chunk" });
    const c3 = makeChunk(scene.id, 2, { generatedText: "Second chunk" });
    chunks.createChunk(db, c1);
    chunks.createChunk(db, c2);
    chunks.createChunk(db, c3);

    const res = await request(app).get(`/api/scenes/${scene.id}/chunks`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].sequenceNumber).toBe(1);
    expect(res.body.data[1].sequenceNumber).toBe(2);
    expect(res.body.data[2].sequenceNumber).toBe(3);
  });

  it("returns an empty list envelope when no chunks exist for the scene", async () => {
    const { scene } = seedSceneChain();

    const res = await request(app).get(`/api/scenes/${scene.id}/chunks`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: [], nextPageToken: null });
  });
});

describe("GET /api/chunks/:id", () => {
  it("returns the chunk when it exists", async () => {
    const { scene } = seedSceneChain();
    const c = makeChunk(scene.id, 1, { generatedText: "Hello world" });
    chunks.createChunk(db, c);

    const res = await request(app).get(`/api/chunks/${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: c.id,
        sceneId: scene.id,
        sequenceNumber: 1,
        generatedText: "Hello world",
        status: "pending",
      }),
    );
  });

  it("returns 404 for a nonexistent chunk", async () => {
    const res = await request(app).get("/api/chunks/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Chunk not found" } });
  });
});

describe("POST /api/chunks", () => {
  it("creates a chunk and returns 201", async () => {
    const { scene } = seedSceneChain();
    const c = makeChunk(scene.id, 1, { generatedText: "Generated prose" });

    const res = await request(app).post("/api/chunks").send(c);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: c.id,
        sceneId: scene.id,
        sequenceNumber: 1,
        generatedText: "Generated prose",
      }),
    );

    const stored = chunks.getChunk(db, c.id);
    expect(stored).not.toBeNull();
    expect(stored!.generatedText).toBe("Generated prose");
  });
});

describe("PUT /api/chunks/:id", () => {
  it("updates a chunk and reflects the changes", async () => {
    const { scene } = seedSceneChain();
    const c = makeChunk(scene.id, 1, { status: "pending" });
    chunks.createChunk(db, c);

    const updated = { ...c, status: "accepted", editedText: "Revised prose", humanNotes: "Looks good" };
    const res = await request(app).put(`/api/chunks/${c.id}`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe("accepted");
    expect(res.body.data.editedText).toBe("Revised prose");
    expect(res.body.data.humanNotes).toBe("Looks good");
  });
});

describe("DELETE /api/chunks/:id", () => {
  it("deletes an existing chunk and returns { ok: true, data: { deleted: true } }", async () => {
    const { scene } = seedSceneChain();
    const c = makeChunk(scene.id, 1);
    chunks.createChunk(db, c);

    const res = await request(app).delete(`/api/chunks/${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { deleted: true } });

    const stored = chunks.getChunk(db, c.id);
    expect(stored).toBeNull();
  });

  it("returns 404 when deleting a nonexistent chunk", async () => {
    const res = await request(app).delete("/api/chunks/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
