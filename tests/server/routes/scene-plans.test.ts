import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { createEmptyScenePlan, makeChapterArc, makeProject } from "../../helpers/factories.js";

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

function seedProjectAndChapter() {
  const p = makeProject();
  projects.createProject(db, p);
  const arc = makeChapterArc(p.id, { chapterNumber: 1 });
  const created = chapterArcs.createChapterArc(db, arc);
  return { project: p, chapter: created };
}

function seedScene(projectId: string, chapterId: string, sceneOrder: number) {
  const plan = { ...createEmptyScenePlan(projectId), chapterId };
  scenePlans.createScenePlan(db, plan, sceneOrder);
  return plan;
}

describe("GET /api/chapters/:chapterId/scenes", () => {
  it("lists scene plans ordered by scene_order", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const scene1 = seedScene(project.id, chapter.id, 0);
    const scene2 = seedScene(project.id, chapter.id, 1);

    const res = await request(app).get(`/api/chapters/${chapter.id}/scenes`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].sceneOrder).toBe(0);
    expect(res.body[0].plan.id).toBe(scene1.id);
    expect(res.body[1].sceneOrder).toBe(1);
    expect(res.body[1].plan.id).toBe(scene2.id);
  });

  it("returns an empty array when no scenes exist for the chapter", async () => {
    const { chapter } = seedProjectAndChapter();

    const res = await request(app).get(`/api/chapters/${chapter.id}/scenes`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/scenes/:id", () => {
  it("returns the scene plan when it exists", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = seedScene(project.id, chapter.id, 0);

    const res = await request(app).get(`/api/scenes/${plan.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        plan: expect.objectContaining({ id: plan.id, projectId: project.id }),
        status: "planned",
        sceneOrder: 0,
      }),
    );
  });

  it("returns 404 for a nonexistent scene plan", async () => {
    const res = await request(app).get("/api/scenes/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Scene plan not found" });
  });
});

describe("POST /api/scenes", () => {
  it("creates a scene plan and returns 201", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = { ...createEmptyScenePlan(project.id), chapterId: chapter.id };

    const res = await request(app).post("/api/scenes").send({ plan, sceneOrder: 5 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: plan.id,
        projectId: project.id,
        chapterId: chapter.id,
      }),
    );
  });

  it("succeeds when project already exists (ensureProject is no-op)", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = { ...createEmptyScenePlan(project.id), chapterId: chapter.id };

    const res = await request(app).post("/api/scenes").send({ plan, sceneOrder: 0 });
    expect(res.status).toBe(201);

    // Project retains its original title (ensureProject did not overwrite it)
    const stored = projects.getProject(db, project.id);
    expect(stored!.title).toBe("Test Project");
  });

  it("creates a scene plan with null chapterId when no chapter FK needed", async () => {
    // ensureProject auto-creates the project row; chapterId=null avoids chapter FK
    const plan = { ...createEmptyScenePlan("auto-proj-scene"), chapterId: null };

    const res = await request(app).post("/api/scenes").send({ plan, sceneOrder: 0 });
    expect(res.status).toBe(201);

    const autoProject = projects.getProject(db, "auto-proj-scene");
    expect(autoProject).not.toBeNull();
    expect(autoProject!.title).toBe("Untitled Project");
  });
});

describe("PUT /api/scenes/:id", () => {
  it("updates a scene plan and returns the updated data", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = seedScene(project.id, chapter.id, 0);

    const updated = { ...plan, title: "Revised Scene Title", narrativeGoal: "Build tension" };
    const res = await request(app).put(`/api/scenes/${plan.id}`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Revised Scene Title");
    expect(res.body.narrativeGoal).toBe("Build tension");
  });

  it("round-trips presentCharacterIds through JSON storage", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = {
      ...createEmptyScenePlan(project.id),
      chapterId: chapter.id,
      presentCharacterIds: ["char-1", "char-2", "char-3"],
    };
    scenePlans.createScenePlan(db, plan, 0);

    const res = await request(app).get(`/api/scenes/${plan.id}`);
    expect(res.status).toBe(200);
    expect(res.body.plan.presentCharacterIds).toEqual(["char-1", "char-2", "char-3"]);
  });
});

describe("PATCH /api/scenes/:id/status", () => {
  it("updates the scene status", async () => {
    const { project, chapter } = seedProjectAndChapter();
    const plan = seedScene(project.id, chapter.id, 0);

    const res = await request(app).patch(`/api/scenes/${plan.id}/status`).send({ status: "drafting" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stored = scenePlans.getScenePlan(db, plan.id);
    expect(stored!.status).toBe("drafting");
  });

  it("returns 404 for a nonexistent scene", async () => {
    const res = await request(app).patch("/api/scenes/nonexistent-id/status").send({ status: "drafting" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Scene not found" });
  });
});
