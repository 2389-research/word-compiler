import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as chunks from "../../../server/db/repositories/chunks.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import {
  createEmptyScenePlan,
  makeChapterArc,
  makeChunk,
  makeEditPattern,
  makeLearnedPatternInput,
  makeProfileAdjustmentInput,
  makeProject,
} from "../../helpers/factories.js";

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

/** Seed project → chapter arc → scene plan → chunk and return IDs. */
function seedFullChain(): {
  projectId: string;
  chapterId: string;
  sceneId: string;
  chunkId: string;
} {
  const project = makeProject();
  projects.createProject(db, project);

  const arc = makeChapterArc(project.id);
  chapterArcs.createChapterArc(db, arc);

  const plan = createEmptyScenePlan(project.id);
  plan.chapterId = arc.id;
  scenePlans.createScenePlan(db, plan, 0);

  const chunk = makeChunk(plan.id, 1);
  chunks.createChunk(db, chunk);

  return { projectId: project.id, chapterId: arc.id, sceneId: plan.id, chunkId: chunk.id };
}

/** Seed only a project and return its ID. */
function seedProject(): string {
  const project = makeProject();
  projects.createProject(db, project);
  return project.id;
}

// ═══════════════════════════════════════════════════════════
//  Edit Patterns
// ═══════════════════════════════════════════════════════════

describe("GET /api/projects/:projectId/edit-patterns", () => {
  it("returns an empty array when no patterns exist", async () => {
    const projectId = seedProject();

    const res = await request(app).get(`/api/projects/${projectId}/edit-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists edit patterns for the project", async () => {
    const { projectId, sceneId, chunkId } = seedFullChain();
    const patterns = [
      makeEditPattern({ projectId, sceneId, chunkId, editType: "DELETION", subType: "CUT_FILLER" }),
      makeEditPattern({ projectId, sceneId, chunkId, editType: "SUBSTITUTION", subType: "TONE_SHIFT" }),
    ];

    await request(app).post("/api/edit-patterns").send(patterns);

    const res = await request(app).get(`/api/projects/${projectId}/edit-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].projectId).toBe(projectId);
    expect(res.body[1].projectId).toBe(projectId);
  });
});

describe("GET /api/scenes/:sceneId/edit-patterns", () => {
  it("returns an empty array when no patterns exist for the scene", async () => {
    const { sceneId } = seedFullChain();

    const res = await request(app).get(`/api/scenes/${sceneId}/edit-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists edit patterns scoped to the scene", async () => {
    const { projectId, sceneId, chunkId } = seedFullChain();
    const patterns = [
      makeEditPattern({ projectId, sceneId, chunkId, originalText: "um" }),
      makeEditPattern({ projectId, sceneId, chunkId, originalText: "well" }),
    ];

    await request(app).post("/api/edit-patterns").send(patterns);

    const res = await request(app).get(`/api/scenes/${sceneId}/edit-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].sceneId).toBe(sceneId);
    expect(res.body[1].sceneId).toBe(sceneId);
  });
});

describe("POST /api/edit-patterns", () => {
  it("creates a batch of edit patterns and returns 201", async () => {
    const { projectId, sceneId, chunkId } = seedFullChain();
    const patterns = [
      makeEditPattern({ projectId, sceneId, chunkId, subType: "CUT_FILLER" }),
      makeEditPattern({ projectId, sceneId, chunkId, subType: "TONE_SHIFT" }),
      makeEditPattern({ projectId, sceneId, chunkId, subType: "CUT_FILLER" }),
    ];

    const res = await request(app).post("/api/edit-patterns").send(patterns);
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: patterns[0]!.id,
        projectId,
        sceneId,
        chunkId,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
//  Learned Patterns
// ═══════════════════════════════════════════════════════════

describe("GET /api/projects/:projectId/learned-patterns", () => {
  it("returns an empty array when no patterns exist", async () => {
    const projectId = seedProject();

    const res = await request(app).get(`/api/projects/${projectId}/learned-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists all learned patterns for the project", async () => {
    const projectId = seedProject();
    const input1 = makeLearnedPatternInput({ projectId, status: "proposed" });
    const input2 = makeLearnedPatternInput({ projectId, status: "accepted", confidence: 0.9 });

    await request(app).post("/api/learned-patterns").send(input1);
    await request(app).post("/api/learned-patterns").send(input2);

    const res = await request(app).get(`/api/projects/${projectId}/learned-patterns`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Ordered by confidence DESC, so 0.9 comes before 0.65
    expect(res.body[0].confidence).toBe(0.9);
    expect(res.body[1].confidence).toBe(0.65);
  });

  it("filters learned patterns by status query param", async () => {
    const projectId = seedProject();
    await request(app)
      .post("/api/learned-patterns")
      .send(makeLearnedPatternInput({ projectId, status: "proposed" }));
    await request(app)
      .post("/api/learned-patterns")
      .send(makeLearnedPatternInput({ projectId, status: "accepted" }));
    await request(app)
      .post("/api/learned-patterns")
      .send(makeLearnedPatternInput({ projectId, status: "proposed" }));

    const res = await request(app).get(`/api/projects/${projectId}/learned-patterns?status=proposed`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const pattern of res.body) {
      expect(pattern.status).toBe("proposed");
    }
  });
});

describe("POST /api/learned-patterns", () => {
  it("creates a learned pattern and returns 201", async () => {
    const projectId = seedProject();
    const input = makeLearnedPatternInput({ projectId });

    const res = await request(app).post("/api/learned-patterns").send(input);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        projectId,
        patternType: "CUT_FILLER",
        occurrences: 6,
        confidence: 0.65,
        status: "proposed",
      }),
    );
    // Server generates an id and timestamps
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();
  });
});

describe("PATCH /api/learned-patterns/:id/status", () => {
  it("updates the status of an existing pattern", async () => {
    const projectId = seedProject();
    const input = makeLearnedPatternInput({ projectId, status: "proposed" });
    const createRes = await request(app).post("/api/learned-patterns").send(input);
    const patternId = createRes.body.id;

    const res = await request(app).patch(`/api/learned-patterns/${patternId}/status`).send({ status: "accepted" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify the status change persisted
    const listRes = await request(app).get(`/api/projects/${projectId}/learned-patterns?status=accepted`);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(patternId);
    expect(listRes.body[0].status).toBe("accepted");
  });

  it("returns 404 for a nonexistent pattern", async () => {
    const res = await request(app).patch("/api/learned-patterns/nonexistent-id/status").send({ status: "rejected" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Learned pattern not found" });
  });
});

// ═══════════════════════════════════════════════════════════
//  Profile Adjustments
// ═══════════════════════════════════════════════════════════

describe("GET /api/projects/:projectId/profile-adjustments", () => {
  it("returns an empty array when no adjustments exist", async () => {
    const projectId = seedProject();

    const res = await request(app).get(`/api/projects/${projectId}/profile-adjustments`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists all profile adjustments for the project", async () => {
    const projectId = seedProject();
    await request(app)
      .post("/api/profile-adjustments")
      .send(makeProfileAdjustmentInput({ projectId, parameter: "defaultTemperature" }));
    await request(app)
      .post("/api/profile-adjustments")
      .send(makeProfileAdjustmentInput({ projectId, parameter: "topP" }));

    const res = await request(app).get(`/api/projects/${projectId}/profile-adjustments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("filters profile adjustments by status query param", async () => {
    const projectId = seedProject();
    await request(app)
      .post("/api/profile-adjustments")
      .send(makeProfileAdjustmentInput({ projectId, status: "pending" }));
    await request(app)
      .post("/api/profile-adjustments")
      .send(makeProfileAdjustmentInput({ projectId, status: "accepted" }));
    await request(app)
      .post("/api/profile-adjustments")
      .send(makeProfileAdjustmentInput({ projectId, status: "pending" }));

    const res = await request(app).get(`/api/projects/${projectId}/profile-adjustments?status=pending`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const adj of res.body) {
      expect(adj.status).toBe("pending");
    }
  });
});

describe("POST /api/profile-adjustments", () => {
  it("creates a profile adjustment and returns 201", async () => {
    const projectId = seedProject();
    const input = makeProfileAdjustmentInput({ projectId });

    const res = await request(app).post("/api/profile-adjustments").send(input);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        projectId,
        parameter: "defaultTemperature",
        currentValue: 0.8,
        suggestedValue: 0.6,
        rationale: "High edit ratio detected",
        confidence: 0.75,
        status: "pending",
      }),
    );
    // Server generates an id and timestamp
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });
});

describe("PATCH /api/profile-adjustments/:id/status", () => {
  it("updates the status of an existing adjustment", async () => {
    const projectId = seedProject();
    const input = makeProfileAdjustmentInput({ projectId, status: "pending" });
    const createRes = await request(app).post("/api/profile-adjustments").send(input);
    const adjustmentId = createRes.body.id;

    const res = await request(app)
      .patch(`/api/profile-adjustments/${adjustmentId}/status`)
      .send({ status: "accepted" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify the status change persisted
    const listRes = await request(app).get(`/api/projects/${projectId}/profile-adjustments?status=accepted`);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(adjustmentId);
    expect(listRes.body[0].status).toBe("accepted");
  });

  it("returns 404 for a nonexistent adjustment", async () => {
    const res = await request(app).patch("/api/profile-adjustments/nonexistent-id/status").send({ status: "rejected" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Profile adjustment not found" });
  });
});
