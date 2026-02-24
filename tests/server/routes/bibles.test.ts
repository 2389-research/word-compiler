import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as bibles from "../../../server/db/repositories/bibles.js";
import * as projects from "../../../server/db/repositories/projects.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { createEmptyBible, makeProject } from "../../helpers/factories.js";

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

function seedProjectAndBible(version = 1) {
  const p = makeProject();
  projects.createProject(db, p);
  const bible = { ...createEmptyBible(p.id), version };
  bibles.createBible(db, bible);
  return { project: p, bible };
}

describe("GET /api/projects/:projectId/bibles/latest", () => {
  it("returns the latest bible version", async () => {
    const p = makeProject();
    projects.createProject(db, p);
    const v1 = { ...createEmptyBible(p.id), version: 1 };
    const v2 = { ...createEmptyBible(p.id), version: 2 };
    bibles.createBible(db, v1);
    bibles.createBible(db, v2);

    const res = await request(app).get(`/api/projects/${p.id}/bibles/latest`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.projectId).toBe(p.id);
  });

  it("returns 404 when no bible exists for the project", async () => {
    const p = makeProject();
    projects.createProject(db, p);

    const res = await request(app).get(`/api/projects/${p.id}/bibles/latest`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "No bible found" });
  });
});

describe("GET /api/projects/:projectId/bibles/:version", () => {
  it("returns a specific bible version", async () => {
    const { project, bible } = seedProjectAndBible(3);

    const res = await request(app).get(`/api/projects/${project.id}/bibles/3`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    expect(res.body.projectId).toBe(project.id);
  });

  it("returns 404 for a nonexistent version", async () => {
    const { project } = seedProjectAndBible(1);

    const res = await request(app).get(`/api/projects/${project.id}/bibles/99`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Bible version not found" });
  });
});

describe("GET /api/projects/:projectId/bibles", () => {
  it("lists all bible versions ordered by version descending", async () => {
    const p = makeProject();
    projects.createProject(db, p);
    const v1 = { ...createEmptyBible(p.id), version: 1 };
    const v2 = { ...createEmptyBible(p.id), version: 2 };
    bibles.createBible(db, v1);
    bibles.createBible(db, v2);

    const res = await request(app).get(`/api/projects/${p.id}/bibles`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].version).toBe(2);
    expect(res.body[1].version).toBe(1);
  });

  it("returns an empty array when no bibles exist", async () => {
    const p = makeProject();
    projects.createProject(db, p);

    const res = await request(app).get(`/api/projects/${p.id}/bibles`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/projects/:projectId/bibles", () => {
  it("creates a bible and returns 201", async () => {
    const p = makeProject();
    projects.createProject(db, p);
    const bible = createEmptyBible(p.id);

    const res = await request(app).post(`/api/projects/${p.id}/bibles`).send(bible);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        projectId: p.id,
        version: 1,
      }),
    );
  });

  it("auto-creates the project if it does not exist (ensureProject)", async () => {
    const bible = createEmptyBible("auto-proj-id");

    const res = await request(app).post("/api/projects/auto-proj-id/bibles").send(bible);
    expect(res.status).toBe(201);

    const autoProject = projects.getProject(db, "auto-proj-id");
    expect(autoProject).not.toBeNull();
    expect(autoProject!.title).toBe("Untitled Project");
    expect(autoProject!.status).toBe("drafting");
  });
});
