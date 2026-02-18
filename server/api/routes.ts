import type Database from "better-sqlite3";
import { Router } from "express";
import * as auditFlags from "../db/repositories/audit-flags.js";
import * as bibles from "../db/repositories/bibles.js";
import * as chapterArcs from "../db/repositories/chapter-arcs.js";
import * as chunks from "../db/repositories/chunks.js";
import * as compilationLogs from "../db/repositories/compilation-logs.js";
import * as narrativeIRs from "../db/repositories/narrative-irs.js";
import * as projects from "../db/repositories/projects.js";
import * as scenePlans from "../db/repositories/scene-plans.js";

export function createApiRouter(db: Database.Database): Router {
  const router = Router();

  // ─── Projects ───────────────────────────────────────
  router.get("/projects", (_req, res) => {
    res.json(projects.listProjects(db));
  });

  router.get("/projects/:id", (req, res) => {
    const project = projects.getProject(db, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.post("/projects", (req, res) => {
    const project = projects.createProject(db, req.body);
    res.status(201).json(project);
  });

  router.patch("/projects/:id", (req, res) => {
    const project = projects.updateProject(db, req.params.id, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.delete("/projects/:id", (req, res) => {
    const deleted = projects.deleteProject(db, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.json({ ok: true });
  });

  // ─── Bibles ─────────────────────────────────────────
  router.get("/projects/:projectId/bibles/latest", (req, res) => {
    const bible = bibles.getLatestBible(db, req.params.projectId);
    if (!bible) return res.status(404).json({ error: "No bible found" });
    res.json(bible);
  });

  router.get("/projects/:projectId/bibles/:version", (req, res) => {
    const bible = bibles.getBibleVersion(db, req.params.projectId, parseInt(req.params.version, 10));
    if (!bible) return res.status(404).json({ error: "Bible version not found" });
    res.json(bible);
  });

  router.get("/projects/:projectId/bibles", (req, res) => {
    res.json(bibles.listBibleVersions(db, req.params.projectId));
  });

  router.post("/projects/:projectId/bibles", (req, res) => {
    const bible = bibles.createBible(db, req.body);
    res.status(201).json(bible);
  });

  // ─── Chapter Arcs ──────────────────────────────────
  router.get("/projects/:projectId/chapters", (req, res) => {
    res.json(chapterArcs.listChapterArcs(db, req.params.projectId));
  });

  router.get("/chapters/:id", (req, res) => {
    const arc = chapterArcs.getChapterArc(db, req.params.id);
    if (!arc) return res.status(404).json({ error: "Chapter arc not found" });
    res.json(arc);
  });

  router.post("/chapters", (req, res) => {
    const arc = chapterArcs.createChapterArc(db, req.body);
    res.status(201).json(arc);
  });

  router.put("/chapters/:id", (req, res) => {
    const arc = chapterArcs.updateChapterArc(db, req.body);
    res.json(arc);
  });

  // ─── Scene Plans ───────────────────────────────────
  router.get("/chapters/:chapterId/scenes", (req, res) => {
    res.json(scenePlans.listScenePlans(db, req.params.chapterId));
  });

  router.get("/scenes/:id", (req, res) => {
    const result = scenePlans.getScenePlan(db, req.params.id);
    if (!result) return res.status(404).json({ error: "Scene plan not found" });
    res.json(result);
  });

  router.post("/scenes", (req, res) => {
    const { plan, sceneOrder } = req.body;
    const created = scenePlans.createScenePlan(db, plan, sceneOrder ?? 0);
    res.status(201).json(created);
  });

  router.put("/scenes/:id", (req, res) => {
    const updated = scenePlans.updateScenePlan(db, req.body);
    res.json(updated);
  });

  router.patch("/scenes/:id/status", (req, res) => {
    const ok = scenePlans.updateSceneStatus(db, req.params.id, req.body.status);
    if (!ok) return res.status(404).json({ error: "Scene not found" });
    res.json({ ok: true });
  });

  // ─── Chunks ────────────────────────────────────────
  router.get("/scenes/:sceneId/chunks", (req, res) => {
    res.json(chunks.listChunksForScene(db, req.params.sceneId));
  });

  router.get("/chunks/:id", (req, res) => {
    const chunk = chunks.getChunk(db, req.params.id);
    if (!chunk) return res.status(404).json({ error: "Chunk not found" });
    res.json(chunk);
  });

  router.post("/chunks", (req, res) => {
    const chunk = chunks.createChunk(db, req.body);
    res.status(201).json(chunk);
  });

  router.put("/chunks/:id", (req, res) => {
    const chunk = chunks.updateChunk(db, req.body);
    res.json(chunk);
  });

  router.delete("/chunks/:id", (req, res) => {
    const ok = chunks.deleteChunk(db, req.params.id);
    if (!ok) return res.status(404).json({ error: "Chunk not found" });
    res.json({ ok: true });
  });

  // ─── Audit Flags ───────────────────────────────────
  router.get("/scenes/:sceneId/audit-flags", (req, res) => {
    res.json(auditFlags.listAuditFlags(db, req.params.sceneId));
  });

  router.post("/audit-flags", (req, res) => {
    if (Array.isArray(req.body)) {
      const flags = auditFlags.createAuditFlags(db, req.body);
      res.status(201).json(flags);
    } else {
      const flag = auditFlags.createAuditFlag(db, req.body);
      res.status(201).json(flag);
    }
  });

  router.patch("/audit-flags/:id/resolve", (req, res) => {
    const { action, wasActionable } = req.body;
    const ok = auditFlags.resolveAuditFlag(db, req.params.id, action, wasActionable);
    if (!ok) return res.status(404).json({ error: "Audit flag not found" });
    res.json({ ok: true });
  });

  router.get("/scenes/:sceneId/audit-stats", (req, res) => {
    res.json(auditFlags.getAuditStats(db, req.params.sceneId));
  });

  // ─── Narrative IRs ─────────────────────────────────
  router.get("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.getNarrativeIR(db, req.params.sceneId);
    if (!ir) return res.status(404).json({ error: "IR not found" });
    res.json(ir);
  });

  router.post("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.createNarrativeIR(db, req.body);
    res.status(201).json(ir);
  });

  router.put("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.updateNarrativeIR(db, req.body);
    res.json(ir);
  });

  router.patch("/scenes/:sceneId/ir/verify", (req, res) => {
    const ok = narrativeIRs.verifyNarrativeIR(db, req.params.sceneId);
    if (!ok) return res.status(404).json({ error: "IR not found" });
    res.json({ ok: true });
  });

  router.get("/chapters/:chapterId/irs", (req, res) => {
    res.json(narrativeIRs.listAllIRsForChapter(db, req.params.chapterId));
  });

  router.get("/chapters/:chapterId/irs/verified", (req, res) => {
    res.json(narrativeIRs.listVerifiedIRsForChapter(db, req.params.chapterId));
  });

  // ─── Compilation Logs ──────────────────────────────
  router.post("/compilation-logs", (req, res) => {
    const log = compilationLogs.createCompilationLog(db, req.body);
    res.status(201).json(log);
  });

  router.get("/compilation-logs/:id", (req, res) => {
    const log = compilationLogs.getCompilationLog(db, req.params.id);
    if (!log) return res.status(404).json({ error: "Log not found" });
    res.json(log);
  });

  router.get("/chunks/:chunkId/compilation-logs", (req, res) => {
    res.json(compilationLogs.listCompilationLogs(db, req.params.chunkId));
  });

  return router;
}
