import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chapterArcs from "../../../server/db/repositories/chapter-arcs.js";
import * as projects from "../../../server/db/repositories/projects.js";
import * as scenePlans from "../../../server/db/repositories/scene-plans.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { createEmptyScenePlan, makeAuditFlag, makeChapterArc, makeProject } from "../../helpers/factories.js";

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

/** Seed project → chapter arc → scene plan and return the sceneId. */
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

describe("GET /api/scenes/:sceneId/audit-flags", () => {
  it("returns an empty array when no flags exist", async () => {
    const { sceneId } = seedSceneChain();

    const res = await request(app).get(`/api/scenes/${sceneId}/audit-flags`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns flags ordered by severity: critical > warning > info", async () => {
    const { sceneId } = seedSceneChain();

    const info = makeAuditFlag(sceneId, { severity: "info", message: "Info flag" });
    const critical = makeAuditFlag(sceneId, { severity: "critical", message: "Critical flag" });
    const warning = makeAuditFlag(sceneId, { severity: "warning", message: "Warning flag" });

    // Insert in non-sorted order
    await request(app).post("/api/audit-flags").send(info);
    await request(app).post("/api/audit-flags").send(critical);
    await request(app).post("/api/audit-flags").send(warning);

    const res = await request(app).get(`/api/scenes/${sceneId}/audit-flags`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].severity).toBe("critical");
    expect(res.body[1].severity).toBe("warning");
    expect(res.body[2].severity).toBe("info");
  });
});

describe("POST /api/audit-flags", () => {
  it("creates a single flag and returns 201", async () => {
    const { sceneId } = seedSceneChain();
    const flag = makeAuditFlag(sceneId, { category: "epistemic_leak", message: "Character knows too much" });

    const res = await request(app).post("/api/audit-flags").send(flag);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: flag.id,
        sceneId,
        category: "epistemic_leak",
        message: "Character knows too much",
        resolved: false,
      }),
    );
  });

  it("creates a batch of flags and returns 201", async () => {
    const { sceneId } = seedSceneChain();
    const flags = [
      makeAuditFlag(sceneId, { severity: "critical", message: "Flag 1" }),
      makeAuditFlag(sceneId, { severity: "warning", message: "Flag 2" }),
      makeAuditFlag(sceneId, { severity: "info", message: "Flag 3" }),
    ];

    const res = await request(app).post("/api/audit-flags").send(flags);
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].id).toBe(flags[0]!.id);
    expect(res.body[1].id).toBe(flags[1]!.id);
    expect(res.body[2].id).toBe(flags[2]!.id);
  });
});

describe("PATCH /api/audit-flags/:id/resolve", () => {
  it("resolves an existing flag and returns { ok: true }", async () => {
    const { sceneId } = seedSceneChain();
    const flag = makeAuditFlag(sceneId);
    await request(app).post("/api/audit-flags").send(flag);

    const res = await request(app)
      .patch(`/api/audit-flags/${flag.id}/resolve`)
      .send({ action: "fixed the prose", wasActionable: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify the flag is now resolved in the database
    const listRes = await request(app).get(`/api/scenes/${sceneId}/audit-flags`);
    const resolved = listRes.body.find((f: any) => f.id === flag.id);
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedAction).toBe("fixed the prose");
    expect(resolved.wasActionable).toBe(true);
  });

  it("returns 404 for a nonexistent flag", async () => {
    const res = await request(app)
      .patch("/api/audit-flags/nonexistent-id/resolve")
      .send({ action: "n/a", wasActionable: false });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Audit flag not found" });
  });
});

describe("GET /api/scenes/:sceneId/audit-stats", () => {
  it("returns zeroed stats when no flags exist", async () => {
    const { sceneId } = seedSceneChain();

    const res = await request(app).get(`/api/scenes/${sceneId}/audit-stats`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      resolved: 0,
      actionable: 0,
      dismissed: 0,
      pending: 0,
      nonActionable: 0,
      signalToNoiseRatio: 1,
      byCategory: {},
    });
  });

  it("returns correct totals and byCategory after seeding and resolving flags", async () => {
    const { sceneId } = seedSceneChain();

    const flag1 = makeAuditFlag(sceneId, { category: "kill_list", severity: "critical" });
    const flag2 = makeAuditFlag(sceneId, { category: "kill_list", severity: "warning" });
    const flag3 = makeAuditFlag(sceneId, { category: "sentence_variance", severity: "info" });
    const flag4 = makeAuditFlag(sceneId, { category: "sentence_variance", severity: "warning" });

    await request(app).post("/api/audit-flags").send([flag1, flag2, flag3, flag4]);

    // Resolve flag1 as actionable, flag3 as dismissed
    await request(app).patch(`/api/audit-flags/${flag1.id}/resolve`).send({ action: "fixed", wasActionable: true });
    await request(app).patch(`/api/audit-flags/${flag3.id}/resolve`).send({ action: "ignored", wasActionable: false });

    const res = await request(app).get(`/api/scenes/${sceneId}/audit-stats`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.resolved).toBe(2);
    expect(res.body.actionable).toBe(1);
    expect(res.body.dismissed).toBe(1);
    expect(res.body.signalToNoiseRatio).toBe(0.5);
    expect(res.body.byCategory).toEqual({
      kill_list: { total: 2, actionable: 1 },
      sentence_variance: { total: 2, actionable: 0 },
    });
  });
});
