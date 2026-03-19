import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditStats, ProfileAdjustmentData } from "../../src/api/client.js";
import {
  apiCreateProfileAdjustment,
  apiCreateProject,
  apiCreateSceneIR,
  apiDeleteChunk,
  apiGetAuditStats,
  apiGetBibleVersion,
  apiGetChapterArc,
  apiGetLatestBible,
  apiGetProject,
  apiGetSceneIR,
  apiGetScenePlan,
  apiListAuditFlags,
  apiListBibleVersions,
  apiListChapterArcs,
  apiListChapterIRs,
  apiListChunks,
  apiListProfileAdjustments,
  apiListProjects,
  apiListScenePlans,
  apiListVerifiedChapterIRs,
  apiResolveAuditFlag,
  apiSaveAuditFlags,
  apiSaveBible,
  apiSaveChapterArc,
  apiSaveChunk,
  apiSaveCompilationLog,
  apiSaveScenePlan,
  apiUpdateChapterArc,
  apiUpdateChunk,
  apiUpdateProfileAdjustmentStatus,
  apiUpdateProject,
  apiUpdateSceneIR,
  apiUpdateScenePlan,
  apiUpdateSceneStatus,
  apiVerifySceneIR,
} from "../../src/api/client.js";
import type {
  AuditFlag,
  Bible,
  ChapterArc,
  Chunk,
  CompilationLog,
  NarrativeIR,
  Project,
  ScenePlan,
} from "../../src/types/index.js";

// ─── Helpers ────────────────────────────────────────────

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    json: vi.fn().mockResolvedValue(body),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function mockFetchJsonFailure(status: number): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: `Status ${status}`,
    json: vi.fn().mockRejectedValue(new Error("invalid json")),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function lastFetchCall(fn: ReturnType<typeof vi.fn>) {
  const [url, init] = fn.mock.calls[0]!;
  return { url, init };
}

function lastFetchBody(fn: ReturnType<typeof vi.fn>): unknown {
  const { init } = lastFetchCall(fn);
  return JSON.parse(init?.body as string);
}

// ─── fetchJson error handling ───────────────────────────

describe("fetchJson error handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws with error message from JSON body when response is not ok", async () => {
    mockFetch(400, { error: "Validation failed" });
    await expect(apiListProjects()).rejects.toThrow("Validation failed");
  });

  it("throws with HTTP status when JSON body has no error field", async () => {
    mockFetch(500, { detail: "something else" });
    await expect(apiListProjects()).rejects.toThrow("HTTP 500");
  });

  it("falls back to statusText when response body is not valid JSON", async () => {
    mockFetchJsonFailure(502);
    await expect(apiListProjects()).rejects.toThrow("Status 502");
  });

  it("sets Content-Type header to application/json", async () => {
    const fn = mockFetch(200, []);
    await apiListProjects();
    const { init } = lastFetchCall(fn);
    expect(init.headers).toEqual(expect.objectContaining({ "Content-Type": "application/json" }));
  });

  it("merges custom headers with Content-Type", async () => {
    // All client functions go through fetchJson which sets Content-Type.
    // We verify the header is present on an arbitrary call.
    const fn = mockFetch(200, {});
    await apiGetProject("p1");
    const { init } = lastFetchCall(fn);
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});

// ─── Projects ───────────────────────────────────────────

describe("Projects", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListProjects fetches GET /api/data/projects", async () => {
    const projects = [{ id: "p1" }] as Project[];
    const fn = mockFetch(200, projects);
    const result = await apiListProjects();
    expect(result).toEqual(projects);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/projects");
    expect(init.method).toBeUndefined();
  });

  it("apiGetProject fetches GET /api/data/projects/:id", async () => {
    const project = { id: "p1", title: "Novel" } as Project;
    const fn = mockFetch(200, project);
    const result = await apiGetProject("p1");
    expect(result).toEqual(project);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1");
  });

  it("apiCreateProject sends POST with project body", async () => {
    const project = { id: "p1", title: "New Novel" } as Project;
    const fn = mockFetch(201, project);
    const result = await apiCreateProject(project);
    expect(result).toEqual(project);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/projects");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(project);
  });

  it("apiUpdateProject sends PATCH with partial updates", async () => {
    const updated = { id: "p1", title: "Renamed" } as Project;
    const fn = mockFetch(200, updated);
    const result = await apiUpdateProject("p1", { title: "Renamed" });
    expect(result).toEqual(updated);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(lastFetchBody(fn)).toEqual({ title: "Renamed" });
  });
});

// ─── Bibles ─────────────────────────────────────────────

describe("Bibles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiGetLatestBible fetches GET /api/data/projects/:projectId/bibles/latest", async () => {
    const bible = { projectId: "p1", version: 3 } as unknown as Bible;
    const fn = mockFetch(200, bible);
    const result = await apiGetLatestBible("p1");
    expect(result).toEqual(bible);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/bibles/latest");
  });

  it("apiGetBibleVersion fetches GET /api/data/projects/:projectId/bibles/:version", async () => {
    const bible = { projectId: "p1", version: 2 } as unknown as Bible;
    const fn = mockFetch(200, bible);
    const result = await apiGetBibleVersion("p1", 2);
    expect(result).toEqual(bible);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/bibles/2");
  });

  it("apiListBibleVersions fetches GET /api/data/projects/:projectId/bibles", async () => {
    const versions = [{ version: 1, createdAt: "2026-01-01" }];
    const fn = mockFetch(200, versions);
    const result = await apiListBibleVersions("p1");
    expect(result).toEqual(versions);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/bibles");
  });

  it("apiSaveBible sends POST using bible.projectId in URL", async () => {
    const bible = { projectId: "proj-42", version: 1 } as unknown as Bible;
    const fn = mockFetch(201, bible);
    const result = await apiSaveBible(bible);
    expect(result).toEqual(bible);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/projects/proj-42/bibles");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(bible);
  });
});

// ─── Chapter Arcs ───────────────────────────────────────

describe("Chapter Arcs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListChapterArcs fetches GET /api/data/projects/:projectId/chapters", async () => {
    const arcs = [{ id: "ch1" }] as ChapterArc[];
    const fn = mockFetch(200, arcs);
    const result = await apiListChapterArcs("p1");
    expect(result).toEqual(arcs);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/chapters");
  });

  it("apiGetChapterArc fetches GET /api/data/chapters/:id", async () => {
    const arc = { id: "ch1" } as ChapterArc;
    const fn = mockFetch(200, arc);
    const result = await apiGetChapterArc("ch1");
    expect(result).toEqual(arc);
    expect(lastFetchCall(fn).url).toBe("/api/data/chapters/ch1");
  });

  it("apiSaveChapterArc sends POST with arc body", async () => {
    const arc = { id: "ch1", projectId: "p1" } as ChapterArc;
    const fn = mockFetch(201, arc);
    const result = await apiSaveChapterArc(arc);
    expect(result).toEqual(arc);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/chapters");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(arc);
  });

  it("apiUpdateChapterArc sends PUT using arc.id in URL", async () => {
    const arc = { id: "ch-99", projectId: "p1" } as ChapterArc;
    const fn = mockFetch(200, arc);
    const result = await apiUpdateChapterArc(arc);
    expect(result).toEqual(arc);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/chapters/ch-99");
    expect(init.method).toBe("PUT");
    expect(lastFetchBody(fn)).toEqual(arc);
  });
});

// ─── Scene Plans ────────────────────────────────────────

describe("Scene Plans", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListScenePlans fetches GET /api/data/chapters/:chapterId/scenes", async () => {
    const scenes = [{ plan: {}, status: "planned", sceneOrder: 1 }];
    const fn = mockFetch(200, scenes);
    const result = await apiListScenePlans("ch1");
    expect(result).toEqual(scenes);
    expect(lastFetchCall(fn).url).toBe("/api/data/chapters/ch1/scenes");
  });

  it("apiGetScenePlan fetches GET /api/data/scenes/:id", async () => {
    const scene = { plan: {}, status: "drafting", sceneOrder: 2 };
    const fn = mockFetch(200, scene);
    const result = await apiGetScenePlan("s1");
    expect(result).toEqual(scene);
    expect(lastFetchCall(fn).url).toBe("/api/data/scenes/s1");
  });

  it("apiSaveScenePlan sends POST with plan and sceneOrder in body", async () => {
    const plan = { id: "s1", chapterId: "ch1" } as unknown as ScenePlan;
    const fn = mockFetch(201, plan);
    const result = await apiSaveScenePlan(plan, 3);
    expect(result).toEqual(plan);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual({ plan, sceneOrder: 3 });
  });

  it("apiUpdateScenePlan sends PUT using plan.id in URL", async () => {
    const plan = { id: "s-77" } as unknown as ScenePlan;
    const fn = mockFetch(200, plan);
    const result = await apiUpdateScenePlan(plan);
    expect(result).toEqual(plan);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes/s-77");
    expect(init.method).toBe("PUT");
    expect(lastFetchBody(fn)).toEqual(plan);
  });

  it("apiUpdateSceneStatus sends PATCH with status body", async () => {
    const fn = mockFetch(200, undefined);
    await apiUpdateSceneStatus("s1", "complete");
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes/s1/status");
    expect(init.method).toBe("PATCH");
    expect(lastFetchBody(fn)).toEqual({ status: "complete" });
  });
});

// ─── Chunks ─────────────────────────────────────────────

describe("Chunks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListChunks fetches GET /api/data/scenes/:sceneId/chunks", async () => {
    const chunks = [{ id: "ck1" }] as Chunk[];
    const fn = mockFetch(200, chunks);
    const result = await apiListChunks("s1");
    expect(result).toEqual(chunks);
    expect(lastFetchCall(fn).url).toBe("/api/data/scenes/s1/chunks");
  });

  it("apiSaveChunk sends POST with chunk body", async () => {
    const chunk = { id: "ck1", sceneId: "s1" } as unknown as Chunk;
    const fn = mockFetch(201, chunk);
    const result = await apiSaveChunk(chunk);
    expect(result).toEqual(chunk);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/chunks");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(chunk);
  });

  it("apiUpdateChunk sends PUT using chunk.id in URL", async () => {
    const chunk = { id: "ck-55" } as unknown as Chunk;
    const fn = mockFetch(200, chunk);
    const result = await apiUpdateChunk(chunk);
    expect(result).toEqual(chunk);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/chunks/ck-55");
    expect(init.method).toBe("PUT");
    expect(lastFetchBody(fn)).toEqual(chunk);
  });

  it("apiDeleteChunk sends DELETE to /api/data/chunks/:id", async () => {
    const fn = mockFetch(200, undefined);
    await apiDeleteChunk("ck-del");
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/chunks/ck-del");
    expect(init.method).toBe("DELETE");
  });
});

// ─── Audit Flags ────────────────────────────────────────

describe("Audit Flags", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListAuditFlags fetches GET /api/data/scenes/:sceneId/audit-flags", async () => {
    const flags = [{ id: "af1" }] as AuditFlag[];
    const fn = mockFetch(200, flags);
    const result = await apiListAuditFlags("s1");
    expect(result).toEqual(flags);
    expect(lastFetchCall(fn).url).toBe("/api/data/scenes/s1/audit-flags");
  });

  it("apiSaveAuditFlags sends POST with flags array", async () => {
    const flags = [{ id: "af1" }, { id: "af2" }] as AuditFlag[];
    const fn = mockFetch(201, flags);
    const result = await apiSaveAuditFlags(flags);
    expect(result).toEqual(flags);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/audit-flags");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(flags);
  });

  it("apiResolveAuditFlag sends PATCH with action and wasActionable", async () => {
    const fn = mockFetch(200, undefined);
    await apiResolveAuditFlag("af1", "revised-text", true);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/audit-flags/af1/resolve");
    expect(init.method).toBe("PATCH");
    expect(lastFetchBody(fn)).toEqual({ action: "revised-text", wasActionable: true });
  });

  it("apiResolveAuditFlag sends wasActionable=false when dismissed", async () => {
    const fn = mockFetch(200, undefined);
    await apiResolveAuditFlag("af2", "dismissed", false);
    expect(lastFetchBody(fn)).toEqual({ action: "dismissed", wasActionable: false });
  });

  it("apiGetAuditStats fetches GET /api/data/scenes/:sceneId/audit-stats", async () => {
    const stats: AuditStats = {
      total: 10,
      resolved: 5,
      actionable: 3,
      dismissed: 2,
      pending: 5,
      nonActionable: 2,
      signalToNoiseRatio: 0.6,
      byCategory: { prose: { total: 4, actionable: 2 } },
    };
    const fn = mockFetch(200, stats);
    const result = await apiGetAuditStats("s1");
    expect(result).toEqual(stats);
    expect(lastFetchCall(fn).url).toBe("/api/data/scenes/s1/audit-stats");
  });
});

// ─── Compilation Logs ───────────────────────────────────

describe("Compilation Logs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiSaveCompilationLog sends POST with log body", async () => {
    const log = { id: "cl1", sceneId: "s1" } as unknown as CompilationLog;
    const fn = mockFetch(201, log);
    const result = await apiSaveCompilationLog(log);
    expect(result).toEqual(log);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/compilation-logs");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(log);
  });
});

// ─── Narrative IRs ──────────────────────────────────────

describe("Narrative IRs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiGetSceneIR fetches GET /api/data/scenes/:sceneId/ir", async () => {
    const ir = { sceneId: "s1" } as unknown as NarrativeIR;
    const fn = mockFetch(200, ir);
    const result = await apiGetSceneIR("s1");
    expect(result).toEqual(ir);
    expect(lastFetchCall(fn).url).toBe("/api/data/scenes/s1/ir");
  });

  it("apiCreateSceneIR sends POST with IR body", async () => {
    const ir = { sceneId: "s1", deltas: [] } as unknown as NarrativeIR;
    const fn = mockFetch(201, ir);
    const result = await apiCreateSceneIR("s1", ir);
    expect(result).toEqual(ir);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes/s1/ir");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(ir);
  });

  it("apiUpdateSceneIR sends PUT with IR body", async () => {
    const ir = { sceneId: "s1", deltas: [{}] } as unknown as NarrativeIR;
    const fn = mockFetch(200, ir);
    const result = await apiUpdateSceneIR("s1", ir);
    expect(result).toEqual(ir);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes/s1/ir");
    expect(init.method).toBe("PUT");
    expect(lastFetchBody(fn)).toEqual(ir);
  });

  it("apiVerifySceneIR sends PATCH to /api/data/scenes/:sceneId/ir/verify", async () => {
    const fn = mockFetch(200, undefined);
    await apiVerifySceneIR("s1");
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/scenes/s1/ir/verify");
    expect(init.method).toBe("PATCH");
  });

  it("apiListChapterIRs fetches GET /api/data/chapters/:chapterId/irs", async () => {
    const irs = [{ sceneId: "s1" }] as unknown as NarrativeIR[];
    const fn = mockFetch(200, irs);
    const result = await apiListChapterIRs("ch1");
    expect(result).toEqual(irs);
    expect(lastFetchCall(fn).url).toBe("/api/data/chapters/ch1/irs");
  });

  it("apiListVerifiedChapterIRs fetches GET /api/data/chapters/:chapterId/irs/verified", async () => {
    const irs = [{ sceneId: "s2" }] as unknown as NarrativeIR[];
    const fn = mockFetch(200, irs);
    const result = await apiListVerifiedChapterIRs("ch1");
    expect(result).toEqual(irs);
    expect(lastFetchCall(fn).url).toBe("/api/data/chapters/ch1/irs/verified");
  });
});

// ─── Profile Adjustments ────────────────────────────────

describe("Profile Adjustments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("apiListProfileAdjustments fetches GET without query param when no status", async () => {
    const adjustments = [{ id: "pa1" }] as unknown as ProfileAdjustmentData[];
    const fn = mockFetch(200, adjustments);
    const result = await apiListProfileAdjustments("p1");
    expect(result).toEqual(adjustments);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/profile-adjustments");
  });

  it("apiListProfileAdjustments appends ?status= query param when status provided", async () => {
    const adjustments = [{ id: "pa1", status: "pending" }] as unknown as ProfileAdjustmentData[];
    const fn = mockFetch(200, adjustments);
    const result = await apiListProfileAdjustments("p1", "pending");
    expect(result).toEqual(adjustments);
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/profile-adjustments?status=pending");
  });

  it("apiListProfileAdjustments handles accepted status filter", async () => {
    const fn = mockFetch(200, []);
    await apiListProfileAdjustments("p1", "accepted");
    expect(lastFetchCall(fn).url).toBe("/api/data/projects/p1/profile-adjustments?status=accepted");
  });

  it("apiCreateProfileAdjustment sends POST with adjustment data", async () => {
    const data = {
      projectId: "p1",
      parameter: "temperature",
      currentValue: 0.7,
      suggestedValue: 0.8,
      rationale: "Higher creativity needed",
      confidence: 0.85,
      evidence: { editedChunkCount: 5, sceneCount: 3, avgEditRatio: 0.2 },
      status: "pending" as const,
    };
    const response = { ...data, id: "pa-new", createdAt: "2026-02-24" };
    const fn = mockFetch(201, response);
    const result = await apiCreateProfileAdjustment(data);
    expect(result).toEqual(response);
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/profile-adjustments");
    expect(init.method).toBe("POST");
    expect(lastFetchBody(fn)).toEqual(data);
  });

  it("apiUpdateProfileAdjustmentStatus sends PATCH with accepted status", async () => {
    const fn = mockFetch(200, undefined);
    await apiUpdateProfileAdjustmentStatus("pa1", "accepted");
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/profile-adjustments/pa1/status");
    expect(init.method).toBe("PATCH");
    expect(lastFetchBody(fn)).toEqual({ status: "accepted" });
  });

  it("apiUpdateProfileAdjustmentStatus sends PATCH with rejected status", async () => {
    const fn = mockFetch(200, undefined);
    await apiUpdateProfileAdjustmentStatus("pa2", "rejected");
    const { url, init } = lastFetchCall(fn);
    expect(url).toBe("/api/data/profile-adjustments/pa2/status");
    expect(init.method).toBe("PATCH");
    expect(lastFetchBody(fn)).toEqual({ status: "rejected" });
  });
});
