import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeChapterArc, makeProject } from "../../helpers/factories.js";

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

function seedProjectWithArcs() {
  const p = makeProject();
  projects.createProject(db, p);
  const arc1 = makeChapterArc(p.id, { chapterNumber: 1, workingTitle: "Opening" });
  const arc2 = makeChapterArc(p.id, { chapterNumber: 2, workingTitle: "Conflict" });
  chapterArcs.createChapterArc(db, arc1);
  chapterArcs.createChapterArc(db, arc2);
  return { project: p, arc1, arc2 };
}

describe("GET /api/projects/:projectId/chapters", () => {
  it("lists chapter arcs ordered by chapter_number", async () => {
    const { project } = seedProjectWithArcs();

    const res = await request(app).get(`/api/projects/${project.id}/chapters`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].chapterNumber).toBe(1);
    expect(res.body[1].chapterNumber).toBe(2);
  });

  it("returns an empty array when no arcs exist", async () => {
    const p = makeProject();
    projects.createProject(db, p);

    const res = await request(app).get(`/api/projects/${p.id}/chapters`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/chapters/:id", () => {
  it("returns the chapter arc when it exists", async () => {
    const { arc1 } = seedProjectWithArcs();

    const res = await request(app).get(`/api/chapters/${arc1.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: arc1.id,
        chapterNumber: 1,
        workingTitle: "Opening",
      }),
    );
  });

  it("returns 404 for a nonexistent chapter arc", async () => {
    const res = await request(app).get("/api/chapters/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Chapter arc not found" });
  });
});

describe("POST /api/chapters", () => {
  it("creates a chapter arc and returns 201", async () => {
    const p = makeProject();
    projects.createProject(db, p);
    const arc = makeChapterArc(p.id, { chapterNumber: 5, workingTitle: "Climax" });

    const res = await request(app).post("/api/chapters").send(arc);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: arc.id,
        projectId: p.id,
        chapterNumber: 5,
        workingTitle: "Climax",
      }),
    );
  });

  it("auto-creates the project via ensureProject if projectId is present", async () => {
    const arc = makeChapterArc("auto-proj-ch", { chapterNumber: 1 });

    const res = await request(app).post("/api/chapters").send(arc);
    expect(res.status).toBe(201);

    const autoProject = projects.getProject(db, "auto-proj-ch");
    expect(autoProject).not.toBeNull();
    expect(autoProject!.title).toBe("Untitled Project");
  });
});

describe("PUT /api/chapters/:id", () => {
  it("updates a chapter arc and returns the updated data", async () => {
    const { arc1 } = seedProjectWithArcs();

    const updated = { ...arc1, workingTitle: "Revised Opening", narrativeFunction: "Setup and hook" };
    const res = await request(app).put(`/api/chapters/${arc1.id}`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.workingTitle).toBe("Revised Opening");
    expect(res.body.narrativeFunction).toBe("Setup and hook");
  });
});
