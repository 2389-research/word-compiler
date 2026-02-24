import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as projects from "../../../server/db/repositories/projects.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeProject } from "../../helpers/factories.js";

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

describe("GET /api/projects", () => {
  it("returns an empty array when no projects exist", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists projects ordered by updatedAt descending", async () => {
    const older = makeProject({ title: "Older", updatedAt: "2024-01-01T00:00:00Z" });
    const newer = makeProject({ title: "Newer", updatedAt: "2024-06-01T00:00:00Z" });
    projects.createProject(db, older);
    projects.createProject(db, newer);

    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(newer.id);
    expect(res.body[1].id).toBe(older.id);
  });
});

describe("GET /api/projects/:id", () => {
  it("returns the project when it exists", async () => {
    const p = makeProject({ title: "My Novel" });
    projects.createProject(db, p);

    const res = await request(app).get(`/api/projects/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: p.id,
        title: "My Novel",
        status: "bootstrap",
      }),
    );
  });

  it("returns 404 for a nonexistent project", async () => {
    const res = await request(app).get("/api/projects/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});

describe("POST /api/projects", () => {
  it("creates a project and returns 201", async () => {
    const p = makeProject({ title: "Brand New Book" });

    const res = await request(app).post("/api/projects").send(p);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: p.id,
        title: "Brand New Book",
      }),
    );

    const stored = projects.getProject(db, p.id);
    expect(stored).not.toBeNull();
    expect(stored!.title).toBe("Brand New Book");
  });
});

describe("PATCH /api/projects/:id", () => {
  it("updates project fields and returns the updated project", async () => {
    const p = makeProject({ title: "Original Title", status: "bootstrap" });
    projects.createProject(db, p);

    const res = await request(app).patch(`/api/projects/${p.id}`).send({ title: "Updated Title", status: "drafting" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.status).toBe("drafting");
  });

  it("returns 404 when updating a nonexistent project", async () => {
    const res = await request(app).patch("/api/projects/nonexistent-id").send({ title: "Nope" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes an existing project and returns { ok: true }", async () => {
    const p = makeProject();
    projects.createProject(db, p);

    const res = await request(app).delete(`/api/projects/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stored = projects.getProject(db, p.id);
    expect(stored).toBeNull();
  });

  it("returns 404 when deleting a nonexistent project", async () => {
    const res = await request(app).delete("/api/projects/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});
