import type Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import { Router } from "express";
import type { PipelineConfig } from "../../src/profile/types.js";
import { createWritingSample as createSample } from "../../src/profile/types.js";
import { generateId } from "../../src/types/utils.js";
import * as auditFlags from "../db/repositories/audit-flags.js";
import * as bibles from "../db/repositories/bibles.js";
import * as chapterArcs from "../db/repositories/chapter-arcs.js";
import * as chunks from "../db/repositories/chunks.js";
import * as compilationLogs from "../db/repositories/compilation-logs.js";
import * as editPatterns from "../db/repositories/edit-patterns.js";
import * as learnedPatterns from "../db/repositories/learned-patterns.js";
import * as narrativeIRs from "../db/repositories/narrative-irs.js";
import * as preferenceStatementsRepo from "../db/repositories/preference-statements.js";
import * as profileAdjustments from "../db/repositories/profile-adjustments.js";
import * as projectVoiceGuideRepo from "../db/repositories/project-voice-guide.js";
import * as projects from "../db/repositories/projects.js";
import * as scenePlans from "../db/repositories/scene-plans.js";
import * as significantEditsRepo from "../db/repositories/significant-edits.js";
import * as voiceGuideRepo from "../db/repositories/voice-guide.js";
import * as writingSampleRepo from "../db/repositories/writing-samples.js";
import { inferBatchPreferences } from "../profile/cipher.js";
import { runPipeline } from "../profile/pipeline.js";
import { distillVoice, updateProjectVoice } from "../profile/projectGuide.js";

export function createApiRouter(db: Database.Database, anthropicClient?: Anthropic): Router {
  const router = Router();

  /** Ensure a project row exists (no-op if it already does). */
  function ensureProject(projectId: string): void {
    const existing = projects.getProject(db, projectId);
    if (!existing) {
      const now = new Date().toISOString();
      projects.createProject(db, {
        id: projectId,
        title: "Untitled Project",
        status: "drafting",
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[data] Auto-created project ${projectId}`);
    }
  }

  // ─── Projects ───────────────────────────────────────
  router.get("/projects", (_req, res) => {
    const list = projects.listProjects(db);
    console.debug(`[data] Listed ${list.length} projects`);
    res.json(list);
  });

  router.get("/projects/:id", (req, res) => {
    const project = projects.getProject(db, req.params.id);
    if (!project) {
      console.warn(`[data] Project not found: ${req.params.id}`);
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  });

  router.post("/projects", (req, res) => {
    const project = projects.createProject(db, req.body);
    console.log(`[data] Created project: ${project.id} "${project.title}"`);
    res.status(201).json(project);
  });

  router.patch("/projects/:id", (req, res) => {
    const project = projects.updateProject(db, req.params.id, req.body);
    if (!project) {
      console.warn(`[data] Project not found for update: ${req.params.id}`);
      return res.status(404).json({ error: "Project not found" });
    }
    console.log(`[data] Updated project: ${project.id} (fields: ${Object.keys(req.body).join(", ")})`);
    res.json(project);
  });

  router.delete("/projects/:id", (req, res) => {
    const deleted = projects.deleteProject(db, req.params.id);
    if (!deleted) {
      console.warn(`[data] Project not found for delete: ${req.params.id}`);
      return res.status(404).json({ error: "Project not found" });
    }
    console.log(`[data] Deleted project: ${req.params.id}`);
    res.json({ ok: true });
  });

  // ─── Bibles ─────────────────────────────────────────
  router.get("/projects/:projectId/bibles/latest", (req, res) => {
    const bible = bibles.getLatestBible(db, req.params.projectId);
    if (!bible) {
      console.debug(`[data] No bible found for project: ${req.params.projectId}`);
      return res.status(404).json({ error: "No bible found" });
    }
    res.json(bible);
  });

  router.get("/projects/:projectId/bibles/:version", (req, res) => {
    const bible = bibles.getBibleVersion(db, req.params.projectId, parseInt(req.params.version, 10));
    if (!bible) {
      console.warn(`[data] Bible version not found: project=${req.params.projectId} version=${req.params.version}`);
      return res.status(404).json({ error: "Bible version not found" });
    }
    res.json(bible);
  });

  router.get("/projects/:projectId/bibles", (req, res) => {
    res.json(bibles.listBibleVersions(db, req.params.projectId));
  });

  router.post("/projects/:projectId/bibles", (req, res) => {
    ensureProject(req.params.projectId);
    const bible = bibles.createBible(db, req.body);
    console.log(
      `[data] Created bible: project=${req.params.projectId} version=${bible.version} chars=${bible.characters?.length ?? 0} locations=${bible.locations?.length ?? 0}`,
    );
    res.status(201).json(bible);
  });

  // ─── Chapter Arcs ──────────────────────────────────
  router.get("/projects/:projectId/chapters", (req, res) => {
    res.json(chapterArcs.listChapterArcs(db, req.params.projectId));
  });

  router.get("/chapters/:id", (req, res) => {
    const arc = chapterArcs.getChapterArc(db, req.params.id);
    if (!arc) {
      console.warn(`[data] Chapter arc not found: ${req.params.id}`);
      return res.status(404).json({ error: "Chapter arc not found" });
    }
    res.json(arc);
  });

  router.post("/chapters", (req, res) => {
    if (req.body.projectId) ensureProject(req.body.projectId);
    const arc = chapterArcs.createChapterArc(db, req.body);
    console.log(`[data] Created chapter arc: ${arc.id} project=${req.body.projectId}`);
    res.status(201).json(arc);
  });

  router.put("/chapters/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return res.status(400).json({ error: "URL id and body id do not match" });
    }
    const arc = chapterArcs.updateChapterArc(db, req.body);
    console.log(`[data] Updated chapter arc: ${req.params.id}`);
    res.json(arc);
  });

  // ─── Scene Plans ───────────────────────────────────
  router.get("/chapters/:chapterId/scenes", (req, res) => {
    res.json(scenePlans.listScenePlans(db, req.params.chapterId));
  });

  router.get("/scenes/:id", (req, res) => {
    const result = scenePlans.getScenePlan(db, req.params.id);
    if (!result) {
      console.warn(`[data] Scene plan not found: ${req.params.id}`);
      return res.status(404).json({ error: "Scene plan not found" });
    }
    res.json(result);
  });

  router.post("/scenes", (req, res) => {
    const { plan, sceneOrder } = req.body;
    if (plan.projectId) ensureProject(plan.projectId);
    const created = scenePlans.createScenePlan(db, plan, sceneOrder ?? 0);
    console.log(`[data] Created scene plan: ${created.id} order=${sceneOrder ?? 0}`);
    res.status(201).json(created);
  });

  router.put("/scenes/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return res.status(400).json({ error: "URL id and body id do not match" });
    }
    const updated = scenePlans.updateScenePlan(db, req.body);
    console.log(`[data] Updated scene plan: ${req.params.id}`);
    res.json(updated);
  });

  router.patch("/scenes/:id/status", (req, res) => {
    const ok = scenePlans.updateSceneStatus(db, req.params.id, req.body.status);
    if (!ok) {
      console.warn(`[data] Scene not found for status update: ${req.params.id}`);
      return res.status(404).json({ error: "Scene not found" });
    }
    console.log(`[data] Scene ${req.params.id} status → ${req.body.status}`);
    res.json({ ok: true });
  });

  // ─── Chunks ────────────────────────────────────────
  router.get("/scenes/:sceneId/chunks", (req, res) => {
    res.json(chunks.listChunksForScene(db, req.params.sceneId));
  });

  router.get("/chunks/:id", (req, res) => {
    const chunk = chunks.getChunk(db, req.params.id);
    if (!chunk) {
      console.warn(`[data] Chunk not found: ${req.params.id}`);
      return res.status(404).json({ error: "Chunk not found" });
    }
    res.json(chunk);
  });

  router.post("/chunks", (req, res) => {
    const chunk = chunks.createChunk(db, req.body);
    console.log(`[data] Created chunk: ${chunk.id} scene=${chunk.sceneId} seq=${chunk.sequenceNumber}`);
    res.status(201).json(chunk);
  });

  router.put("/chunks/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return res.status(400).json({ error: "URL id and body id do not match" });
    }
    const chunk = chunks.updateChunk(db, req.body);
    console.log(`[data] Updated chunk: ${req.params.id} (fields: ${Object.keys(req.body).join(", ")})`);
    res.json(chunk);
  });

  router.delete("/chunks/:id", (req, res) => {
    const ok = chunks.deleteChunk(db, req.params.id);
    if (!ok) {
      console.warn(`[data] Chunk not found for delete: ${req.params.id}`);
      return res.status(404).json({ error: "Chunk not found" });
    }
    console.log(`[data] Deleted chunk: ${req.params.id}`);
    res.json({ ok: true });
  });

  // ─── Audit Flags ───────────────────────────────────
  router.get("/scenes/:sceneId/audit-flags", (req, res) => {
    res.json(auditFlags.listAuditFlags(db, req.params.sceneId));
  });

  router.post("/audit-flags", (req, res) => {
    if (Array.isArray(req.body)) {
      const flags = auditFlags.createAuditFlags(db, req.body);
      console.log(`[data] Created ${flags.length} audit flags`);
      res.status(201).json(flags);
    } else {
      const flag = auditFlags.createAuditFlag(db, req.body);
      console.log(`[data] Created audit flag: ${flag.id} category=${flag.category}`);
      res.status(201).json(flag);
    }
  });

  router.patch("/audit-flags/:id/resolve", (req, res) => {
    const { action, wasActionable } = req.body;
    const ok = auditFlags.resolveAuditFlag(db, req.params.id, action, wasActionable);
    if (!ok) {
      console.warn(`[data] Audit flag not found for resolve: ${req.params.id}`);
      return res.status(404).json({ error: "Audit flag not found" });
    }
    console.log(`[data] Resolved audit flag: ${req.params.id} action=${action} actionable=${wasActionable}`);
    res.json({ ok: true });
  });

  router.get("/scenes/:sceneId/audit-stats", (req, res) => {
    res.json(auditFlags.getAuditStats(db, req.params.sceneId));
  });

  // ─── Narrative IRs ─────────────────────────────────
  router.get("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.getNarrativeIR(db, req.params.sceneId);
    if (!ir) {
      console.debug(`[data] IR not found for scene: ${req.params.sceneId}`);
      return res.status(404).json({ error: "IR not found" });
    }
    res.json(ir);
  });

  router.post("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.createNarrativeIR(db, req.body);
    console.log(`[data] Created narrative IR: scene=${req.params.sceneId}`);
    res.status(201).json(ir);
  });

  router.put("/scenes/:sceneId/ir", (req, res) => {
    if (req.body.sceneId && req.body.sceneId !== req.params.sceneId) {
      return res.status(400).json({ error: "URL sceneId and body sceneId do not match" });
    }
    const ir = narrativeIRs.updateNarrativeIR(db, req.body);
    console.log(`[data] Updated narrative IR: scene=${req.params.sceneId}`);
    res.json(ir);
  });

  router.patch("/scenes/:sceneId/ir/verify", (req, res) => {
    const ok = narrativeIRs.verifyNarrativeIR(db, req.params.sceneId);
    if (!ok) {
      console.warn(`[data] IR not found for verify: ${req.params.sceneId}`);
      return res.status(404).json({ error: "IR not found" });
    }
    console.log(`[data] Verified narrative IR: scene=${req.params.sceneId}`);
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
    console.log(`[data] Created compilation log: ${log.id} chunk=${req.body.chunkId}`);
    res.status(201).json(log);
  });

  router.get("/compilation-logs/:id", (req, res) => {
    const log = compilationLogs.getCompilationLog(db, req.params.id);
    if (!log) {
      console.warn(`[data] Compilation log not found: ${req.params.id}`);
      return res.status(404).json({ error: "Log not found" });
    }
    res.json(log);
  });

  router.get("/chunks/:chunkId/compilation-logs", (req, res) => {
    res.json(compilationLogs.listCompilationLogs(db, req.params.chunkId));
  });

  // ─── Edit Patterns (Learner) ──────────────────────
  router.get("/projects/:projectId/edit-patterns", (req, res) => {
    res.json(editPatterns.listEditPatterns(db, req.params.projectId));
  });

  router.get("/scenes/:sceneId/edit-patterns", (req, res) => {
    res.json(editPatterns.listEditPatternsForScene(db, req.params.sceneId));
  });

  router.post("/edit-patterns", (req, res) => {
    const patterns = editPatterns.createEditPatterns(db, req.body);
    console.log(`[data] Created ${patterns.length} edit patterns`);
    res.status(201).json(patterns);
  });

  // ─── Learned Patterns (Learner) ─────────────────────
  router.get("/projects/:projectId/learned-patterns", (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(learnedPatterns.listLearnedPatterns(db, req.params.projectId, status));
  });

  router.post("/learned-patterns", (req, res) => {
    const pattern = learnedPatterns.createLearnedPattern(db, req.body);
    console.log(`[data] Created learned pattern: ${pattern.id} type=${pattern.patternType}`);
    res.status(201).json(pattern);
  });

  router.patch("/learned-patterns/:id/status", (req, res) => {
    const ok = learnedPatterns.updateLearnedPatternStatus(db, req.params.id, req.body.status);
    if (!ok) {
      console.warn(`[data] Learned pattern not found: ${req.params.id}`);
      return res.status(404).json({ error: "Learned pattern not found" });
    }
    console.log(`[data] Learned pattern ${req.params.id} status → ${req.body.status}`);
    res.json({ ok: true });
  });

  // ─── Profile Adjustments (Auto-Tuning) ─────────
  router.get("/projects/:projectId/profile-adjustments", (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(profileAdjustments.listProfileAdjustments(db, req.params.projectId, status));
  });

  router.post("/profile-adjustments", (req, res) => {
    const proposal = profileAdjustments.createProfileAdjustment(db, req.body);
    console.log(`[data] Created profile adjustment: ${proposal.id} param=${proposal.parameter}`);
    res.status(201).json(proposal);
  });

  router.patch("/profile-adjustments/:id/status", (req, res) => {
    const ok = profileAdjustments.updateProfileAdjustmentStatus(db, req.params.id, req.body.status);
    if (!ok) {
      console.warn(`[data] Profile adjustment not found: ${req.params.id}`);
      return res.status(404).json({ error: "Profile adjustment not found" });
    }
    console.log(`[data] Profile adjustment ${req.params.id} status → ${req.body.status}`);
    res.json({ ok: true });
  });

  // ─── Voice Guide ───────────────────────────────────

  router.get("/voice-guide", (_req, res) => {
    const guide = voiceGuideRepo.getVoiceGuide(db);
    if (!guide) {
      return res.json({ guide: null });
    }
    res.json({ guide });
  });

  router.post("/voice-guide/generate", async (req, res) => {
    const { sampleIds, config } = req.body as { sampleIds?: string[]; config?: Partial<PipelineConfig> };
    if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
      return res.status(400).json({ error: "sampleIds must be a non-empty array" });
    }
    const samples = writingSampleRepo.getWritingSamplesByIds(db, sampleIds);
    if (samples.length === 0) {
      console.warn("[data] No writing samples found for provided IDs");
      return res.status(404).json({ error: "No writing samples found" });
    }
    if (!anthropicClient) {
      console.warn("[data] Anthropic client not available for voice guide generation");
      return res.status(500).json({ error: "Anthropic client not configured" });
    }
    req.setTimeout(600_000);
    try {
      const { createDefaultPipelineConfig } = await import("../../src/profile/types.js");
      const mergedConfig: PipelineConfig = { ...createDefaultPipelineConfig(), ...config };
      console.log(`[data] Generating voice guide from ${samples.length} samples`);
      const guide = await runPipeline(samples, mergedConfig, anthropicClient);
      voiceGuideRepo.saveVoiceGuide(db, guide);
      voiceGuideRepo.saveVoiceGuideVersion(db, guide);
      console.log(`[data] Voice guide generated: version=${guide.version}`);
      res.status(201).json(guide);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[data] Voice guide generation failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  router.get("/voice-guide/versions", (_req, res) => {
    res.json(voiceGuideRepo.listVoiceGuideVersions(db));
  });

  // ─── Writing Samples ───────────────────────────────

  router.get("/writing-samples", (_req, res) => {
    res.json(writingSampleRepo.listWritingSamples(db));
  });

  router.post("/writing-samples", (req, res) => {
    const { filename, domain, text } = req.body as { filename?: string; domain: string; text: string };
    const sample = createSample(filename ?? null, domain, text);
    const created = writingSampleRepo.createWritingSampleRecord(db, sample);
    console.log(`[data] Created writing sample: ${created.id} domain=${domain} words=${created.wordCount}`);
    res.status(201).json(created);
  });

  router.delete("/writing-samples/:id", (req, res) => {
    const deleted = writingSampleRepo.deleteWritingSample(db, req.params.id);
    if (!deleted) {
      console.warn(`[data] Writing sample not found for delete: ${req.params.id}`);
      return res.status(404).json({ error: "Writing sample not found" });
    }
    console.log(`[data] Deleted writing sample: ${req.params.id}`);
    res.status(204).send();
  });

  // ─── Project Voice Learning ───────────────────────

  router.post("/projects/:projectId/significant-edits", (req, res) => {
    const { projectId } = req.params;
    const { chunkId, originalText, editedText } = req.body as {
      chunkId: string;
      originalText: string;
      editedText: string;
    };
    ensureProject(projectId);
    const edit = {
      id: generateId(),
      projectId,
      chunkId,
      originalText,
      editedText,
      processed: false,
      createdAt: new Date().toISOString(),
    };
    significantEditsRepo.createSignificantEdit(db, edit);
    const count = significantEditsRepo.countUnprocessedEdits(db, projectId);
    console.log(`[data] Created significant edit for chunk=${chunkId} project=${projectId} unprocessed=${count}`);
    res.status(201).json({ count });
  });

  router.post("/projects/:projectId/cipher/batch", async (req, res) => {
    const { projectId } = req.params;
    const edits = significantEditsRepo.listUnprocessedEdits(db, projectId);
    if (edits.length === 0) {
      return res.json({ statement: null });
    }
    if (!anthropicClient) {
      return res.status(500).json({ error: "Anthropic client not configured" });
    }
    try {
      const mapped = edits.map((e) => ({ original: e.originalText, edited: e.editedText }));
      const statement = await inferBatchPreferences(anthropicClient, projectId, mapped);
      preferenceStatementsRepo.createPreferenceStatement(db, statement);
      significantEditsRepo.markEditsProcessed(
        db,
        edits.map((e) => e.id),
      );
      console.log(`[data] CIPHER batch: ${edits.length} edits → statement ${statement.id}`);

      // Re-distill ring1Injection now that we have new CIPHER preferences
      const authorGuide = voiceGuideRepo.getVoiceGuide(db);
      const projectGuide = projectVoiceGuideRepo.getProjectVoiceGuide(db, projectId);
      const allStatements = preferenceStatementsRepo.listAllPreferenceStatements(db);
      const cipherPrefs = allStatements.map((s) => s.statement);
      const ring1Injection = await distillVoice(
        authorGuide,
        cipherPrefs,
        projectGuide,
        authorGuide?.ring1Injection ?? null,
        anthropicClient,
      );
      if (authorGuide) {
        authorGuide.ring1Injection = ring1Injection;
        voiceGuideRepo.saveVoiceGuide(db, authorGuide);
      }
      console.log(`[data] Voice re-distilled after CIPHER batch`);

      res.status(201).json({ statement, ring1Injection });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[data] CIPHER batch failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  router.get("/projects/:projectId/project-voice-guide", (req, res) => {
    const guide = projectVoiceGuideRepo.getProjectVoiceGuide(db, req.params.projectId);
    res.json({ guide: guide ?? null });
  });

  // Re-distill ring1Injection from all 3 sources. Called on startup to ensure
  // any CIPHER preferences accumulated since last scene completion are reflected.
  router.post("/projects/:projectId/voice/redistill", async (req, res) => {
    const { projectId } = req.params;
    if (!anthropicClient) {
      return res.status(500).json({ error: "Anthropic client not configured" });
    }
    try {
      const authorGuide = voiceGuideRepo.getVoiceGuide(db);
      const projectGuide = projectVoiceGuideRepo.getProjectVoiceGuide(db, projectId);
      const statements = preferenceStatementsRepo.listAllPreferenceStatements(db);
      const cipherPrefs = statements.map((s) => s.statement);

      // Skip if no sources at all
      if (!authorGuide && cipherPrefs.length === 0 && !projectGuide) {
        return res.json({ ring1Injection: "", skipped: true });
      }

      const ring1Injection = await distillVoice(
        authorGuide,
        cipherPrefs,
        projectGuide,
        authorGuide?.ring1Injection ?? null,
        anthropicClient,
      );

      if (authorGuide) {
        authorGuide.ring1Injection = ring1Injection;
        voiceGuideRepo.saveVoiceGuide(db, authorGuide);
      }

      console.log(`[data] Voice re-distilled for project=${projectId}`);
      res.json({ ring1Injection });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[data] Voice re-distill failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  router.post("/projects/:projectId/project-voice-guide/update", async (req, res) => {
    const { projectId } = req.params;
    const { sceneId, sceneText } = req.body as { sceneId: string; sceneText: string };
    if (!anthropicClient) {
      return res.status(500).json({ error: "Anthropic client not configured" });
    }
    req.setTimeout(600_000);
    try {
      // 1. Update project voice from the new scene
      const existingProjectGuide = projectVoiceGuideRepo.getProjectVoiceGuide(db, projectId);
      const projectGuide = await updateProjectVoice(existingProjectGuide, sceneText, sceneId, anthropicClient);
      projectVoiceGuideRepo.saveProjectVoiceGuide(db, projectId, projectGuide);

      // 2. Re-distill ring1Injection from all 3 sources
      const authorGuide = voiceGuideRepo.getVoiceGuide(db);
      const statements = preferenceStatementsRepo.listAllPreferenceStatements(db);
      const cipherPrefs = statements.map((s) => s.statement);
      const ring1Injection = await distillVoice(
        authorGuide,
        cipherPrefs,
        projectGuide,
        authorGuide?.ring1Injection ?? null,
        anthropicClient,
      );

      // 3. Store the distilled injection on the author guide (if it exists)
      if (authorGuide) {
        authorGuide.ring1Injection = ring1Injection;
        voiceGuideRepo.saveVoiceGuide(db, authorGuide);
      }

      console.log(`[data] Voice updated: project=${projectId} scene=${sceneId}`);
      res.status(201).json({ projectGuide, ring1Injection });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[data] Voice update failed: ${message}`);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
