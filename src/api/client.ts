import type {
  AuditFlag,
  Bible,
  ChapterArc,
  Chunk,
  CompilationLog,
  NarrativeIR,
  Project,
  ScenePlan,
} from "../types/index.js";

const BASE = "/api/data";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Projects ─────────────────────────────────────────

export function apiListProjects(): Promise<Project[]> {
  return fetchJson(`${BASE}/projects`);
}

export function apiGetProject(id: string): Promise<Project> {
  return fetchJson(`${BASE}/projects/${id}`);
}

export function apiCreateProject(project: Project): Promise<Project> {
  return fetchJson(`${BASE}/projects`, {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export function apiUpdateProject(id: string, updates: Partial<Pick<Project, "title" | "status">>): Promise<Project> {
  return fetchJson(`${BASE}/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ─── Bibles ──────────────────────────────────────────

export function apiGetLatestBible(projectId: string): Promise<Bible> {
  return fetchJson(`${BASE}/projects/${projectId}/bibles/latest`);
}

export function apiGetBibleVersion(projectId: string, version: number): Promise<Bible> {
  return fetchJson(`${BASE}/projects/${projectId}/bibles/${version}`);
}

export function apiListBibleVersions(projectId: string): Promise<Array<{ version: number; createdAt: string }>> {
  return fetchJson(`${BASE}/projects/${projectId}/bibles`);
}

export function apiSaveBible(bible: Bible): Promise<Bible> {
  return fetchJson(`${BASE}/projects/${bible.projectId}/bibles`, {
    method: "POST",
    body: JSON.stringify(bible),
  });
}

// ─── Chapter Arcs ────────────────────────────────────

export function apiListChapterArcs(projectId: string): Promise<ChapterArc[]> {
  return fetchJson(`${BASE}/projects/${projectId}/chapters`);
}

export function apiGetChapterArc(id: string): Promise<ChapterArc> {
  return fetchJson(`${BASE}/chapters/${id}`);
}

export function apiSaveChapterArc(arc: ChapterArc): Promise<ChapterArc> {
  return fetchJson(`${BASE}/chapters`, {
    method: "POST",
    body: JSON.stringify(arc),
  });
}

export function apiUpdateChapterArc(arc: ChapterArc): Promise<ChapterArc> {
  return fetchJson(`${BASE}/chapters/${arc.id}`, {
    method: "PUT",
    body: JSON.stringify(arc),
  });
}

// ─── Scene Plans ─────────────────────────────────────

type SceneStatus = "planned" | "drafting" | "complete";

export function apiListScenePlans(
  chapterId: string,
): Promise<Array<{ plan: ScenePlan; status: SceneStatus; sceneOrder: number }>> {
  return fetchJson(`${BASE}/chapters/${chapterId}/scenes`);
}

export function apiGetScenePlan(id: string): Promise<{ plan: ScenePlan; status: SceneStatus; sceneOrder: number }> {
  return fetchJson(`${BASE}/scenes/${id}`);
}

export function apiSaveScenePlan(plan: ScenePlan, sceneOrder: number): Promise<ScenePlan> {
  return fetchJson(`${BASE}/scenes`, {
    method: "POST",
    body: JSON.stringify({ plan, sceneOrder }),
  });
}

export function apiUpdateScenePlan(plan: ScenePlan): Promise<ScenePlan> {
  return fetchJson(`${BASE}/scenes/${plan.id}`, {
    method: "PUT",
    body: JSON.stringify(plan),
  });
}

export function apiUpdateSceneStatus(id: string, status: SceneStatus): Promise<void> {
  return fetchJson(`${BASE}/scenes/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Chunks ──────────────────────────────────────────

export function apiListChunks(sceneId: string): Promise<Chunk[]> {
  return fetchJson(`${BASE}/scenes/${sceneId}/chunks`);
}

export function apiSaveChunk(chunk: Chunk): Promise<Chunk> {
  return fetchJson(`${BASE}/chunks`, {
    method: "POST",
    body: JSON.stringify(chunk),
  });
}

export function apiUpdateChunk(chunk: Chunk): Promise<Chunk> {
  return fetchJson(`${BASE}/chunks/${chunk.id}`, {
    method: "PUT",
    body: JSON.stringify(chunk),
  });
}

// ─── Audit Flags ─────────────────────────────────────

export function apiListAuditFlags(sceneId: string): Promise<AuditFlag[]> {
  return fetchJson(`${BASE}/scenes/${sceneId}/audit-flags`);
}

export function apiSaveAuditFlags(flags: AuditFlag[]): Promise<AuditFlag[]> {
  return fetchJson(`${BASE}/audit-flags`, {
    method: "POST",
    body: JSON.stringify(flags),
  });
}

export function apiResolveAuditFlag(id: string, action: string, wasActionable: boolean): Promise<void> {
  return fetchJson(`${BASE}/audit-flags/${id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ action, wasActionable }),
  });
}

export interface AuditStats {
  total: number;
  resolved: number;
  actionable: number;
  dismissed: number;
  signalToNoise: number;
  byCategory: Record<string, { total: number; actionable: number }>;
}

export function apiGetAuditStats(sceneId: string): Promise<AuditStats> {
  return fetchJson(`${BASE}/scenes/${sceneId}/audit-stats`);
}

// ─── Compilation Logs ────────────────────────────────

export function apiSaveCompilationLog(log: CompilationLog): Promise<CompilationLog> {
  return fetchJson(`${BASE}/compilation-logs`, {
    method: "POST",
    body: JSON.stringify(log),
  });
}

// ─── Narrative IRs ────────────────────────────────────

export function apiGetSceneIR(sceneId: string): Promise<NarrativeIR> {
  return fetchJson(`${BASE}/scenes/${sceneId}/ir`);
}

export function apiCreateSceneIR(sceneId: string, ir: NarrativeIR): Promise<NarrativeIR> {
  return fetchJson(`${BASE}/scenes/${sceneId}/ir`, {
    method: "POST",
    body: JSON.stringify(ir),
  });
}

export function apiUpdateSceneIR(sceneId: string, ir: NarrativeIR): Promise<NarrativeIR> {
  return fetchJson(`${BASE}/scenes/${sceneId}/ir`, {
    method: "PUT",
    body: JSON.stringify(ir),
  });
}

export function apiVerifySceneIR(sceneId: string): Promise<void> {
  return fetchJson(`${BASE}/scenes/${sceneId}/ir/verify`, { method: "PATCH" });
}

export function apiListChapterIRs(chapterId: string): Promise<NarrativeIR[]> {
  return fetchJson(`${BASE}/chapters/${chapterId}/irs`);
}

export function apiListVerifiedChapterIRs(chapterId: string): Promise<NarrativeIR[]> {
  return fetchJson(`${BASE}/chapters/${chapterId}/irs/verified`);
}
