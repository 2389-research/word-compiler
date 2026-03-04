import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { createEmptyNarrativeIR, createEmptyScenePlan, makeChapterArc, makeProject } from "../../helpers/factories.js";

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

/** Seed project → chapter arc → scene plan and return IDs. */
function seedSceneChain(): { projectId: string; chapterId: string; sceneId: string } {
  const project = makeProject();
  projects.createProject(db, project);

  const arc = makeChapterArc(project.id);
  chapterArcs.createChapterArc(db, arc);

  const plan = createEmptyScenePlan(project.id);
  plan.chapterId = arc.id;
  scenePlans.createScenePlan(db, plan, 0);

  return { projectId: project.id, chapterId: arc.id, sceneId: plan.id };
}

/** Seed a second scene in the same chapter. */
function seedSecondScene(projectId: string, chapterId: string): string {
  const plan = createEmptyScenePlan(projectId);
  plan.chapterId = chapterId;
  scenePlans.createScenePlan(db, plan, 1);
  return plan.id;
}

describe("GET /api/scenes/:sceneId/ir", () => {
  it("returns 404 when no IR exists for the scene", async () => {
    const { sceneId } = seedSceneChain();

    const res = await request(app).get(`/api/scenes/${sceneId}/ir`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "IR not found" });
  });

  it("returns the IR when it exists", async () => {
    const { sceneId } = seedSceneChain();
    const ir = createEmptyNarrativeIR(sceneId);
    ir.events = ["Character enters the room"];
    ir.factsIntroduced = ["The door was locked"];

    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir);

    const res = await request(app).get(`/api/scenes/${sceneId}/ir`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        sceneId,
        verified: false,
        events: ["Character enters the room"],
        factsIntroduced: ["The door was locked"],
      }),
    );
  });
});

describe("POST /api/scenes/:sceneId/ir", () => {
  it("creates a narrative IR and returns 201", async () => {
    const { sceneId } = seedSceneChain();
    const ir = createEmptyNarrativeIR(sceneId);
    ir.events = ["Argument begins"];

    const res = await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        sceneId,
        verified: false,
        events: ["Argument begins"],
      }),
    );
  });
});

describe("PUT /api/scenes/:sceneId/ir", () => {
  it("updates the IR and persists the changes", async () => {
    const { sceneId } = seedSceneChain();
    const ir = createEmptyNarrativeIR(sceneId);
    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir);

    const updated = { ...ir, events: ["Updated event"], factsIntroduced: ["New fact"] };
    const res = await request(app).put(`/api/scenes/${sceneId}/ir`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual(["Updated event"]);
    expect(res.body.factsIntroduced).toEqual(["New fact"]);

    // Verify persistence
    const getRes = await request(app).get(`/api/scenes/${sceneId}/ir`);
    expect(getRes.body.events).toEqual(["Updated event"]);
    expect(getRes.body.factsIntroduced).toEqual(["New fact"]);
  });
});

describe("PATCH /api/scenes/:sceneId/ir/verify", () => {
  it("verifies an existing IR and returns { ok: true }", async () => {
    const { sceneId } = seedSceneChain();
    const ir = createEmptyNarrativeIR(sceneId);
    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir);

    const res = await request(app).patch(`/api/scenes/${sceneId}/ir/verify`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify the IR is now marked as verified
    const getRes = await request(app).get(`/api/scenes/${sceneId}/ir`);
    expect(getRes.body.verified).toBe(true);
  });

  it("returns 404 when no IR exists for the scene", async () => {
    const { sceneId } = seedSceneChain();

    const res = await request(app).patch(`/api/scenes/${sceneId}/ir/verify`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "IR not found" });
  });
});

describe("GET /api/chapters/:chapterId/irs", () => {
  it("lists all IRs for a chapter", async () => {
    const { projectId, chapterId, sceneId } = seedSceneChain();
    const sceneId2 = seedSecondScene(projectId, chapterId);

    const ir1 = createEmptyNarrativeIR(sceneId);
    ir1.events = ["Scene 1 event"];
    const ir2 = createEmptyNarrativeIR(sceneId2);
    ir2.events = ["Scene 2 event"];

    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir1);
    await request(app).post(`/api/scenes/${sceneId2}/ir`).send(ir2);

    const res = await request(app).get(`/api/chapters/${chapterId}/irs`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].sceneId).toBe(sceneId);
    expect(res.body[1].sceneId).toBe(sceneId2);
  });

  it("returns an empty array when no IRs exist", async () => {
    const { chapterId } = seedSceneChain();

    const res = await request(app).get(`/api/chapters/${chapterId}/irs`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/chapters/:chapterId/irs/verified", () => {
  it("returns only verified IRs", async () => {
    const { projectId, chapterId, sceneId } = seedSceneChain();
    const sceneId2 = seedSecondScene(projectId, chapterId);

    const ir1 = createEmptyNarrativeIR(sceneId);
    ir1.events = ["Verified scene event"];
    const ir2 = createEmptyNarrativeIR(sceneId2);
    ir2.events = ["Unverified scene event"];

    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir1);
    await request(app).post(`/api/scenes/${sceneId2}/ir`).send(ir2);

    // Verify only the first IR
    await request(app).patch(`/api/scenes/${sceneId}/ir/verify`);

    const res = await request(app).get(`/api/chapters/${chapterId}/irs/verified`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].sceneId).toBe(sceneId);
    expect(res.body[0].verified).toBe(true);
  });

  it("returns an empty array when no IRs are verified", async () => {
    const { chapterId, sceneId } = seedSceneChain();

    const ir = createEmptyNarrativeIR(sceneId);
    await request(app).post(`/api/scenes/${sceneId}/ir`).send(ir);

    const res = await request(app).get(`/api/chapters/${chapterId}/irs/verified`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
