import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiRouter } from "../../server/api/routes.js";
import * as projects from "../../server/db/repositories/projects.js";
import { createSchema } from "../../server/db/schema.js";

let db: Database.Database;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  db = new Database(":memory:");
  createSchema(db);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(db));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ensureProject auto-creation", () => {
  it("POST /api/projects/:projectId/bibles auto-creates the project", async () => {
    expect(projects.getProject(db, "proj-new")).toBeNull();

    const bible = {
      id: "b1",
      projectId: "proj-new",
      version: 1,
      data: { characters: [], locations: [], killList: [], styleGuide: "" },
      createdAt: new Date().toISOString(),
    };

    const res = await post("/api/projects/proj-new/bibles", bible);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const project = projects.getProject(db, "proj-new");
    expect(project).not.toBeNull();
    expect(project!.title).toBe("Untitled Project");
    expect(project!.status).toBe("drafting");
  });

  it("POST /api/chapters auto-creates the project", async () => {
    expect(projects.getProject(db, "proj-ch")).toBeNull();

    const arc = {
      id: "ch1",
      projectId: "proj-ch",
      chapterNumber: 1,
      title: "Chapter One",
      premise: "test",
      scenes: [],
    };

    const res = await post("/api/chapters", arc);
    expect(res.status).toBe(201);

    expect(projects.getProject(db, "proj-ch")).not.toBeNull();
  });

  it("POST /api/scenes auto-creates the project", async () => {
    // Seed project + chapter for FK chain (scene → chapter → project)
    projects.createProject(db, {
      id: "proj-sc",
      title: "Test",
      status: "drafting",
      createdAt: "",
      updatedAt: "",
    });
    db.prepare(
      "INSERT INTO chapter_arcs (id, project_id, chapter_number, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("ch-sc", "proj-sc", 1, "{}", "", "");

    const plan = {
      id: "sc1",
      projectId: "proj-sc",
      chapterId: "ch-sc",
      setting: "test",
      characters: [],
      goal: "test",
      beats: [],
    };

    const res = await post("/api/scenes", { plan, sceneOrder: 0 });
    expect(res.status).toBe(201);
  });

  it("does not overwrite existing project", async () => {
    projects.createProject(db, {
      id: "proj-exists",
      title: "My Book",
      status: "revising",
      createdAt: "",
      updatedAt: "",
    });

    const bible = {
      id: "b2",
      projectId: "proj-exists",
      version: 1,
      data: { characters: [], locations: [], killList: [], styleGuide: "" },
      createdAt: new Date().toISOString(),
    };

    const res = await post("/api/projects/proj-exists/bibles", bible);
    expect(res.status).toBe(201);

    // Project retains original title (was not overwritten)
    const project = projects.getProject(db, "proj-exists");
    expect(project!.title).toBe("My Book");
    expect(project!.status).toBe("revising");
  });
});
