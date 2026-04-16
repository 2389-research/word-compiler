import type Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import type express from "express";
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
import { err, ok, okList, statusFor } from "./envelope.js";
import { PageExpiredError, paginate, parseListQuery } from "./pagination.js";

export function createApiRouter(db: Database.Database, anthropicClient?: Anthropic): Router {
  const router = Router();

  function notFound(res: express.Response, message: string): void {
    res.status(statusFor("NOT_FOUND")).json(err("NOT_FOUND", message));
  }
  function badRequest(res: express.Response, message: string): void {
    res.status(statusFor("BAD_REQUEST")).json(err("BAD_REQUEST", message));
  }
  function conflict(res: express.Response, message: string): void {
    res.status(statusFor("CONFLICT")).json(err("CONFLICT", message));
  }
  function internal(res: express.Response, message: string): void {
    res.status(statusFor("INTERNAL")).json(err("INTERNAL", message));
  }
  function upstream(res: express.Response, message: string): void {
    res.status(statusFor("UPSTREAM_UNAVAILABLE")).json(err("UPSTREAM_UNAVAILABLE", message));
  }

  /** Parse ?limit and ?pageToken, paginate rows, and send the list envelope. */
  function sendList<T>(req: express.Request, res: express.Response, rows: readonly T[]): void {
    let query: ReturnType<typeof parseListQuery>;
    try {
      query = parseListQuery(req.query as Record<string, unknown>);
    } catch (e) {
      badRequest(res, (e as Error).message);
      return;
    }
    try {
      const page = paginate(rows, { limit: query.limit, token: query.token });
      res.json(okList(page.data, page.nextPageToken));
    } catch (e) {
      if (e instanceof PageExpiredError) {
        res.status(statusFor("PAGE_EXPIRED")).json(err("PAGE_EXPIRED", e.message));
        return;
      }
      throw e;
    }
  }

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
  router.get("/projects", (req, res) => {
    const list = projects.listProjects(db);
    console.debug(`[data] Listed ${list.length} projects`);
    sendList(req, res, list);
  });

  router.get("/projects/:id", (req, res) => {
    const project = projects.getProject(db, req.params.id);
    if (!project) {
      console.warn(`[data] Project not found: ${req.params.id}`);
      return notFound(res, "Project not found");
    }
    res.json(ok(project));
  });

  router.post("/projects", (req, res) => {
    const project = projects.createProject(db, req.body);
    console.log(`[data] Created project: ${project.id} "${project.title}"`);
    res.status(201).json(ok(project));
  });

  router.patch("/projects/:id", (req, res) => {
    const project = projects.updateProject(db, req.params.id, req.body);
    if (!project) {
      console.warn(`[data] Project not found for update: ${req.params.id}`);
      return notFound(res, "Project not found");
    }
    console.log(`[data] Updated project: ${project.id} (fields: ${Object.keys(req.body).join(", ")})`);
    res.json(ok(project));
  });

  router.delete("/projects/:id", (req, res) => {
    const deleted = projects.deleteProject(db, req.params.id);
    if (!deleted) {
      console.warn(`[data] Project not found for delete: ${req.params.id}`);
      return notFound(res, "Project not found");
    }
    console.log(`[data] Deleted project: ${req.params.id}`);
    res.json(ok({ deleted: true }));
  });

  // ─── Bibles ─────────────────────────────────────────
  router.get("/projects/:projectId/bibles/latest", (req, res) => {
    const bible = bibles.getLatestBible(db, req.params.projectId);
    if (!bible) {
      console.debug(`[data] No bible found for project: ${req.params.projectId}`);
      return notFound(res, "No bible found");
    }
    res.json(ok(bible));
  });

  router.get("/projects/:projectId/bibles/:version", (req, res) => {
    const bible = bibles.getBibleVersion(db, req.params.projectId, parseInt(req.params.version, 10));
    if (!bible) {
      console.warn(`[data] Bible version not found: project=${req.params.projectId} version=${req.params.version}`);
      return notFound(res, "Bible version not found");
    }
    res.json(ok(bible));
  });

  router.get("/projects/:projectId/bibles", (req, res) => {
    sendList(req, res, bibles.listBibleVersions(db, req.params.projectId));
  });

  router.post("/projects/:projectId/bibles", (req, res) => {
    ensureProject(req.params.projectId);
    const bible = bibles.createBible(db, req.body);
    console.log(
      `[data] Created bible: project=${req.params.projectId} version=${bible.version} chars=${bible.characters?.length ?? 0} locations=${bible.locations?.length ?? 0}`,
    );
    res.status(201).json(ok(bible));
  });

  // ─── Chapter Arcs ──────────────────────────────────
  router.get("/projects/:projectId/chapters", (req, res) => {
    sendList(req, res, chapterArcs.listChapterArcs(db, req.params.projectId));
  });

  router.get("/chapters/:id", (req, res) => {
    const arc = chapterArcs.getChapterArc(db, req.params.id);
    if (!arc) {
      console.warn(`[data] Chapter arc not found: ${req.params.id}`);
      return notFound(res, "Chapter arc not found");
    }
    res.json(ok(arc));
  });

  router.post("/chapters", (req, res) => {
    if (req.body.projectId) ensureProject(req.body.projectId);
    const arc = chapterArcs.createChapterArc(db, req.body);
    console.log(`[data] Created chapter arc: ${arc.id} project=${req.body.projectId}`);
    res.status(201).json(ok(arc));
  });

  router.put("/chapters/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return conflict(res, "URL id and body id do not match");
    }
    const arc = chapterArcs.updateChapterArc(db, req.body);
    console.log(`[data] Updated chapter arc: ${req.params.id}`);
    res.json(ok(arc));
  });

  // ─── Scene Plans ───────────────────────────────────
  router.get("/chapters/:chapterId/scenes", (req, res) => {
    sendList(req, res, scenePlans.listScenePlans(db, req.params.chapterId));
  });

  router.get("/scenes/:id", (req, res) => {
    const result = scenePlans.getScenePlan(db, req.params.id);
    if (!result) {
      console.warn(`[data] Scene plan not found: ${req.params.id}`);
      return notFound(res, "Scene plan not found");
    }
    res.json(ok(result));
  });

  router.post("/scenes", (req, res) => {
    const { plan, sceneOrder } = req.body;
    if (plan.projectId) ensureProject(plan.projectId);
    const created = scenePlans.createScenePlan(db, plan, sceneOrder ?? 0);
    console.log(`[data] Created scene plan: ${created.id} order=${sceneOrder ?? 0}`);
    res.status(201).json(ok(created));
  });

  router.put("/scenes/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return conflict(res, "URL id and body id do not match");
    }
    const updated = scenePlans.updateScenePlan(db, req.body);
    console.log(`[data] Updated scene plan: ${req.params.id}`);
    res.json(ok(updated));
  });

  router.patch("/scenes/:id/status", (req, res) => {
    const success = scenePlans.updateSceneStatus(db, req.params.id, req.body.status);
    if (!success) {
      console.warn(`[data] Scene not found for status update: ${req.params.id}`);
      return notFound(res, "Scene not found");
    }
    console.log(`[data] Scene ${req.params.id} status → ${req.body.status}`);
    res.json(ok({ updated: true }));
  });

  // ─── Chunks ────────────────────────────────────────
  router.get("/scenes/:sceneId/chunks", (req, res) => {
    sendList(req, res, chunks.listChunksForScene(db, req.params.sceneId));
  });

  router.get("/chunks/:id", (req, res) => {
    const chunk = chunks.getChunk(db, req.params.id);
    if (!chunk) {
      console.warn(`[data] Chunk not found: ${req.params.id}`);
      return notFound(res, "Chunk not found");
    }
    res.json(ok(chunk));
  });

  router.post("/chunks", (req, res) => {
    const chunk = chunks.createChunk(db, req.body);
    console.log(`[data] Created chunk: ${chunk.id} scene=${chunk.sceneId} seq=${chunk.sequenceNumber}`);
    res.status(201).json(ok(chunk));
  });

  router.put("/chunks/:id", (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      return conflict(res, "URL id and body id do not match");
    }
    const chunk = chunks.updateChunk(db, req.body);
    console.log(`[data] Updated chunk: ${req.params.id} (fields: ${Object.keys(req.body).join(", ")})`);
    res.json(ok(chunk));
  });

  router.delete("/chunks/:id", (req, res) => {
    const success = chunks.deleteChunk(db, req.params.id);
    if (!success) {
      console.warn(`[data] Chunk not found for delete: ${req.params.id}`);
      return notFound(res, "Chunk not found");
    }
    console.log(`[data] Deleted chunk: ${req.params.id}`);
    res.json(ok({ deleted: true }));
  });

  // ─── Audit Flags ───────────────────────────────────
  router.get("/scenes/:sceneId/audit-flags", (req, res) => {
    sendList(req, res, auditFlags.listAuditFlags(db, req.params.sceneId));
  });

  router.post("/audit-flags", (req, res) => {
    if (Array.isArray(req.body)) {
      const flags = auditFlags.createAuditFlags(db, req.body);
      console.log(`[data] Created ${flags.length} audit flags`);
      res.status(201).json(ok(flags));
    } else {
      const flag = auditFlags.createAuditFlag(db, req.body);
      console.log(`[data] Created audit flag: ${flag.id} category=${flag.category}`);
      res.status(201).json(ok(flag));
    }
  });

  router.patch("/audit-flags/:id/resolve", (req, res) => {
    const { action, wasActionable } = req.body;
    const success = auditFlags.resolveAuditFlag(db, req.params.id, action, wasActionable);
    if (!success) {
      console.warn(`[data] Audit flag not found for resolve: ${req.params.id}`);
      return notFound(res, "Audit flag not found");
    }
    console.log(`[data] Resolved audit flag: ${req.params.id} action=${action} actionable=${wasActionable}`);
    res.json(ok({ resolved: true }));
  });

  router.get("/scenes/:sceneId/audit-stats", (req, res) => {
    res.json(ok(auditFlags.getAuditStats(db, req.params.sceneId)));
  });

  // ─── Narrative IRs ─────────────────────────────────
  router.get("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.getNarrativeIR(db, req.params.sceneId);
    if (!ir) {
      console.debug(`[data] IR not found for scene: ${req.params.sceneId}`);
      return notFound(res, "IR not found");
    }
    res.json(ok(ir));
  });

  router.post("/scenes/:sceneId/ir", (req, res) => {
    const ir = narrativeIRs.createNarrativeIR(db, req.body);
    console.log(`[data] Created narrative IR: scene=${req.params.sceneId}`);
    res.status(201).json(ok(ir));
  });

  router.put("/scenes/:sceneId/ir", (req, res) => {
    if (req.body.sceneId && req.body.sceneId !== req.params.sceneId) {
      return conflict(res, "URL sceneId and body sceneId do not match");
    }
    const ir = narrativeIRs.updateNarrativeIR(db, req.body);
    console.log(`[data] Updated narrative IR: scene=${req.params.sceneId}`);
    res.json(ok(ir));
  });

  router.patch("/scenes/:sceneId/ir/verify", (req, res) => {
    const success = narrativeIRs.verifyNarrativeIR(db, req.params.sceneId);
    if (!success) {
      console.warn(`[data] IR not found for verify: ${req.params.sceneId}`);
      return notFound(res, "IR not found");
    }
    console.log(`[data] Verified narrative IR: scene=${req.params.sceneId}`);
    res.json(ok({ verified: true }));
  });

  router.get("/chapters/:chapterId/irs", (req, res) => {
    sendList(req, res, narrativeIRs.listAllIRsForChapter(db, req.params.chapterId));
  });

  router.get("/chapters/:chapterId/irs/verified", (req, res) => {
    sendList(req, res, narrativeIRs.listVerifiedIRsForChapter(db, req.params.chapterId));
  });

  // ─── Compilation Logs ──────────────────────────────
  router.post("/compilation-logs", (req, res) => {
    const log = compilationLogs.createCompilationLog(db, req.body);
    console.log(`[data] Created compilation log: ${log.id} chunk=${req.body.chunkId}`);
    res.status(201).json(ok(log));
  });

  router.get("/compilation-logs/:id", (req, res) => {
    const log = compilationLogs.getCompilationLog(db, req.params.id);
    if (!log) {
      console.warn(`[data] Compilation log not found: ${req.params.id}`);
      return notFound(res, "Log not found");
    }
    res.json(ok(log));
  });

  router.get("/chunks/:chunkId/compilation-logs", (req, res) => {
    sendList(req, res, compilationLogs.listCompilationLogs(db, req.params.chunkId));
  });

  // ─── Edit Patterns (Learner) ──────────────────────
  router.get("/projects/:projectId/edit-patterns", (req, res) => {
    sendList(req, res, editPatterns.listEditPatterns(db, req.params.projectId));
  });

  router.get("/scenes/:sceneId/edit-patterns", (req, res) => {
    sendList(req, res, editPatterns.listEditPatternsForScene(db, req.params.sceneId));
  });

  router.post("/edit-patterns", (req, res) => {
    const patterns = editPatterns.createEditPatterns(db, req.body);
    console.log(`[data] Created ${patterns.length} edit patterns`);
    res.status(201).json(ok(patterns));
  });

  // ─── Learned Patterns (Learner) ─────────────────────
  router.get("/projects/:projectId/learned-patterns", (req, res) => {
    const status = req.query.status as string | undefined;
    sendList(req, res, learnedPatterns.listLearnedPatterns(db, req.params.projectId, status));
  });

  router.post("/learned-patterns", (req, res) => {
    const pattern = learnedPatterns.createLearnedPattern(db, req.body);
    console.log(`[data] Created learned pattern: ${pattern.id} type=${pattern.patternType}`);
    res.status(201).json(ok(pattern));
  });

  router.patch("/learned-patterns/:id/status", (req, res) => {
    const success = learnedPatterns.updateLearnedPatternStatus(db, req.params.id, req.body.status);
    if (!success) {
      console.warn(`[data] Learned pattern not found: ${req.params.id}`);
      return notFound(res, "Learned pattern not found");
    }
    console.log(`[data] Learned pattern ${req.params.id} status → ${req.body.status}`);
    res.json(ok({ updated: true }));
  });

  // ─── Profile Adjustments (Auto-Tuning) ─────────
  router.get("/projects/:projectId/profile-adjustments", (req, res) => {
    const status = req.query.status as string | undefined;
    sendList(req, res, profileAdjustments.listProfileAdjustments(db, req.params.projectId, status));
  });

  router.post("/profile-adjustments", (req, res) => {
    const proposal = profileAdjustments.createProfileAdjustment(db, req.body);
    console.log(`[data] Created profile adjustment: ${proposal.id} param=${proposal.parameter}`);
    res.status(201).json(ok(proposal));
  });

  router.patch("/profile-adjustments/:id/status", (req, res) => {
    const success = profileAdjustments.updateProfileAdjustmentStatus(db, req.params.id, req.body.status);
    if (!success) {
      console.warn(`[data] Profile adjustment not found: ${req.params.id}`);
      return notFound(res, "Profile adjustment not found");
    }
    console.log(`[data] Profile adjustment ${req.params.id} status → ${req.body.status}`);
    res.json(ok({ updated: true }));
  });

  // ─── Voice Guide ───────────────────────────────────

  router.get("/voice-guide", (_req, res) => {
    const guide = voiceGuideRepo.getVoiceGuide(db);
    if (!guide) {
      return res.json(ok({ guide: null }));
    }
    res.json(ok({ guide }));
  });

  router.post("/voice-guide/generate", async (req, res) => {
    const { sampleIds, config } = req.body as { sampleIds?: string[]; config?: Partial<PipelineConfig> };
    if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
      return badRequest(res, "sampleIds must be a non-empty array");
    }
    const samples = writingSampleRepo.getWritingSamplesByIds(db, sampleIds);
    if (samples.length === 0) {
      console.warn("[data] No writing samples found for provided IDs");
      return notFound(res, "No writing samples found");
    }
    if (!anthropicClient) {
      console.warn("[data] Anthropic client not available for voice guide generation");
      return upstream(res, "Anthropic client not configured");
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
      res.status(201).json(ok(guide));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`[data] Voice guide generation failed: ${message}`);
      internal(res, message);
    }
  });

  router.get("/voice-guide/versions", (req, res) => {
    sendList(req, res, voiceGuideRepo.listVoiceGuideVersions(db));
  });

  // ─── Writing Samples ───────────────────────────────

  router.get("/writing-samples", (req, res) => {
    sendList(req, res, writingSampleRepo.listWritingSamples(db));
  });

  router.post("/writing-samples", (req, res) => {
    const { filename, domain, text } = req.body as { filename?: string; domain: string; text: string };
    const sample = createSample(filename ?? null, domain, text);
    const created = writingSampleRepo.createWritingSampleRecord(db, sample);
    console.log(`[data] Created writing sample: ${created.id} domain=${domain} words=${created.wordCount}`);
    res.status(201).json(ok(created));
  });

  router.delete("/writing-samples/:id", (req, res) => {
    const deleted = writingSampleRepo.deleteWritingSample(db, req.params.id);
    if (!deleted) {
      console.warn(`[data] Writing sample not found for delete: ${req.params.id}`);
      return notFound(res, "Writing sample not found");
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
    res.status(201).json(ok({ count }));
  });

  router.post("/projects/:projectId/cipher/batch", async (req, res) => {
    const { projectId } = req.params;
    const edits = significantEditsRepo.listUnprocessedEdits(db, projectId);
    if (edits.length === 0) {
      return res.json(ok({ statement: null }));
    }
    if (!anthropicClient) {
      return upstream(res, "Anthropic client not configured");
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

      res.status(201).json(ok({ statement, ring1Injection }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`[data] CIPHER batch failed: ${message}`);
      internal(res, message);
    }
  });

  router.get("/projects/:projectId/project-voice-guide", (req, res) => {
    const guide = projectVoiceGuideRepo.getProjectVoiceGuide(db, req.params.projectId);
    res.json(ok({ guide: guide ?? null }));
  });

  // Re-distill ring1Injection from all 3 sources. Called on startup to ensure
  // any CIPHER preferences accumulated since last scene completion are reflected.
  router.post("/projects/:projectId/voice/redistill", async (req, res) => {
    const { projectId } = req.params;
    if (!anthropicClient) {
      return upstream(res, "Anthropic client not configured");
    }
    try {
      const authorGuide = voiceGuideRepo.getVoiceGuide(db);
      const projectGuide = projectVoiceGuideRepo.getProjectVoiceGuide(db, projectId);
      const statements = preferenceStatementsRepo.listAllPreferenceStatements(db);
      const cipherPrefs = statements.map((s) => s.statement);

      // Skip if no sources at all
      if (!authorGuide && cipherPrefs.length === 0 && !projectGuide) {
        return res.json(ok({ ring1Injection: "", skipped: true }));
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
      res.json(ok({ ring1Injection }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`[data] Voice re-distill failed: ${message}`);
      internal(res, message);
    }
  });

  router.post("/projects/:projectId/project-voice-guide/update", async (req, res) => {
    const { projectId } = req.params;
    const { sceneId, sceneText } = req.body as { sceneId: string; sceneText: string };
    if (!anthropicClient) {
      return upstream(res, "Anthropic client not configured");
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
      res.status(201).json(ok({ projectGuide, ring1Injection }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`[data] Voice update failed: ${message}`);
      internal(res, message);
    }
  });

  return router;
}
