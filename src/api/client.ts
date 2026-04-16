import type {
  PipelineConfig,
  PreferenceStatement,
  VoiceGuide,
  VoiceGuideVersion,
  WritingSample,
} from "@/profile/types.js";
import type {
  AuditFlag,
  AuditStats,
  Bible,
  ChapterArc,
  Chunk,
  CompilationLog,
  NarrativeIR,
  Project,
  ScenePlan,
} from "../types/index.js";
import { ApiError, type ApiErrorCode } from "./errors.js";

const BASE = "/api/data";

// ─── Envelope helpers ───────────────────────────────

function isErrEnvelope(body: unknown): body is { ok: false; error: { code: string; message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === false &&
    typeof (body as { error?: unknown }).error === "object"
  );
}

function isOkEnvelope<T>(body: unknown): body is { ok: true; data: T } {
  return (
    typeof body === "object" && body !== null && (body as { ok?: unknown }).ok === true && "data" in (body as object)
  );
}

function isListEnvelope<T>(body: unknown): body is { ok: true; data: T[]; nextPageToken: string | null } {
  return isOkEnvelope<T[]>(body) && "nextPageToken" in (body as object);
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function requestIdOf(res: Response): string | undefined {
  return res.headers.get("x-request-id") ?? undefined;
}

// ─── Core fetch wrappers ────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (caught) {
    throw new ApiError("UNKNOWN", "Network error", 0, { cause: caught });
  }

  // DELETE endpoints return 204 No Content with no body. Envelope contract
  // only applies when a body exists.
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(body.error.code as ApiErrorCode, body.error.message, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (isOkEnvelope<T>(body)) {
    return body.data;
  }
  throw new ApiError("UNKNOWN", "Malformed API response", res.status, {
    body,
    requestId: requestIdOf(res),
  });
}

export interface PageRequest {
  limit?: number;
  pageToken?: string | null;
}

export interface Page<T> {
  data: T[];
  nextPageToken: string | null;
}

async function fetchList<T>(url: string, page?: PageRequest, init?: RequestInit): Promise<Page<T>> {
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set("limit", String(page.limit));
  if (page?.pageToken) params.set("pageToken", page.pageToken);
  const sep = url.includes("?") ? "&" : "?";
  const full = params.toString() ? `${url}${sep}${params.toString()}` : url;

  let res: Response;
  try {
    res = await fetch(full, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (caught) {
    throw new ApiError("UNKNOWN", "Network error", 0, { cause: caught });
  }

  const body = await readBody(res);

  if (isErrEnvelope(body)) {
    throw new ApiError(body.error.code as ApiErrorCode, body.error.message, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (!res.ok) {
    throw new ApiError("UNKNOWN", `HTTP ${res.status}`, res.status, {
      body,
      requestId: requestIdOf(res),
    });
  }
  if (isListEnvelope<T>(body)) {
    return { data: body.data, nextPageToken: body.nextPageToken };
  }
  throw new ApiError("UNKNOWN", "Malformed list response", res.status, {
    body,
    requestId: requestIdOf(res),
  });
}

// ─── Projects ─────────────────────────────────────────

export function apiListProjects(page?: PageRequest): Promise<Page<Project>> {
  return fetchList(`${BASE}/projects`, page);
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

export function apiListBibleVersions(
  projectId: string,
  page?: PageRequest,
): Promise<Page<{ version: number; createdAt: string }>> {
  return fetchList(`${BASE}/projects/${projectId}/bibles`, page);
}

export function apiSaveBible(bible: Bible): Promise<Bible> {
  return fetchJson(`${BASE}/projects/${bible.projectId}/bibles`, {
    method: "POST",
    body: JSON.stringify(bible),
  });
}

// ─── Chapter Arcs ────────────────────────────────────

export function apiListChapterArcs(projectId: string, page?: PageRequest): Promise<Page<ChapterArc>> {
  return fetchList(`${BASE}/projects/${projectId}/chapters`, page);
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
  page?: PageRequest,
): Promise<Page<{ plan: ScenePlan; status: SceneStatus; sceneOrder: number }>> {
  return fetchList(`${BASE}/chapters/${chapterId}/scenes`, page);
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

export function apiListChunks(sceneId: string, page?: PageRequest): Promise<Page<Chunk>> {
  return fetchList(`${BASE}/scenes/${sceneId}/chunks`, page);
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

export async function apiDeleteChunk(id: string): Promise<void> {
  await fetchJson<void>(`${BASE}/chunks/${id}`, { method: "DELETE" });
}

// ─── Audit Flags ─────────────────────────────────────

export function apiListAuditFlags(sceneId: string, page?: PageRequest): Promise<Page<AuditFlag>> {
  return fetchList(`${BASE}/scenes/${sceneId}/audit-flags`, page);
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

export type { AuditStats };

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

export function apiListCompilationLogs(chunkId: string, page?: PageRequest): Promise<Page<CompilationLog>> {
  return fetchList(`${BASE}/chunks/${chunkId}/compilation-logs`, page);
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

export function apiListChapterIRs(chapterId: string, page?: PageRequest): Promise<Page<NarrativeIR>> {
  return fetchList(`${BASE}/chapters/${chapterId}/irs`, page);
}

export function apiListVerifiedChapterIRs(chapterId: string, page?: PageRequest): Promise<Page<NarrativeIR>> {
  return fetchList(`${BASE}/chapters/${chapterId}/irs/verified`, page);
}

// ─── Edit Patterns (Learner) ─────────────────────────

export function apiListEditPatterns(projectId: string, page?: PageRequest): Promise<Page<unknown>> {
  return fetchList(`${BASE}/projects/${projectId}/edit-patterns`, page);
}

export function apiListEditPatternsForScene(sceneId: string, page?: PageRequest): Promise<Page<unknown>> {
  return fetchList(`${BASE}/scenes/${sceneId}/edit-patterns`, page);
}

// ─── Learned Patterns (Learner) ──────────────────────

export function apiListLearnedPatterns(projectId: string, status?: string, page?: PageRequest): Promise<Page<unknown>> {
  const query = status ? `?status=${status}` : "";
  return fetchList(`${BASE}/projects/${projectId}/learned-patterns${query}`, page);
}

// ─── Profile Adjustments (Auto-Tuning) ──────────

export interface ProfileAdjustmentData {
  id: string;
  projectId: string;
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  rationale: string;
  confidence: number;
  evidence: { editedChunkCount: number; sceneCount: number; avgEditRatio: number };
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export function apiListProfileAdjustments(
  projectId: string,
  status?: string,
  page?: PageRequest,
): Promise<Page<ProfileAdjustmentData>> {
  const query = status ? `?status=${status}` : "";
  return fetchList(`${BASE}/projects/${projectId}/profile-adjustments${query}`, page);
}

export function apiCreateProfileAdjustment(
  data: Omit<ProfileAdjustmentData, "id" | "createdAt">,
): Promise<ProfileAdjustmentData> {
  return fetchJson(`${BASE}/profile-adjustments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function apiUpdateProfileAdjustmentStatus(id: string, status: "accepted" | "rejected"): Promise<void> {
  return fetchJson(`${BASE}/profile-adjustments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Voice Guide ─────────────────────────────────────

export async function apiGetVoiceGuide(): Promise<VoiceGuide | null> {
  const data = await fetchJson<{ guide: VoiceGuide | null }>(`${BASE}/voice-guide`);
  return data.guide;
}

export async function apiGenerateVoiceGuide(
  sampleIds: string[],
  config?: Partial<PipelineConfig>,
): Promise<VoiceGuide> {
  return fetchJson<VoiceGuide>(`${BASE}/voice-guide/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sampleIds, config }),
    signal: AbortSignal.timeout(600_000),
  });
}

export function apiListVoiceGuideVersions(page?: PageRequest): Promise<Page<VoiceGuideVersion>> {
  return fetchList(`${BASE}/voice-guide/versions`, page);
}

// ─── Writing Samples ─────────────────────────────────

export function apiListWritingSamples(page?: PageRequest): Promise<Page<WritingSample>> {
  return fetchList(`${BASE}/writing-samples`, page);
}

export function apiCreateWritingSample(filename: string | null, domain: string, text: string): Promise<WritingSample> {
  return fetchJson<WritingSample>(`${BASE}/writing-samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, domain, text }),
  });
}

export async function apiDeleteWritingSample(id: string): Promise<void> {
  await fetchJson<void>(`${BASE}/writing-samples/${id}`, { method: "DELETE" });
}

// ─── Project Voice Learning ─────────────────────────

export async function apiStoreSignificantEdit(
  projectId: string,
  chunkId: string,
  originalText: string,
  editedText: string,
): Promise<number> {
  const data = await fetchJson<{ count: number }>(`${BASE}/projects/${projectId}/significant-edits`, {
    method: "POST",
    body: JSON.stringify({ chunkId, originalText, editedText }),
  });
  return data.count;
}

export interface CipherBatchResult {
  statement: PreferenceStatement | null;
  ring1Injection?: string;
}

export async function apiFireBatchCipher(projectId: string): Promise<CipherBatchResult> {
  const data = await fetchJson<CipherBatchResult | { statement: null }>(`${BASE}/projects/${projectId}/cipher/batch`, {
    method: "POST",
  });
  if ("statement" in data && data.statement === null) return { statement: null };
  return data as CipherBatchResult;
}

export async function apiGetProjectVoiceGuide(projectId: string): Promise<VoiceGuide | null> {
  const data = await fetchJson<{ guide: VoiceGuide | null }>(`${BASE}/projects/${projectId}/project-voice-guide`);
  return data.guide;
}

export interface VoiceUpdateResult {
  projectGuide: VoiceGuide;
  ring1Injection: string;
}

export async function apiUpdateProjectVoiceGuide(
  projectId: string,
  sceneId: string,
  sceneText: string,
): Promise<VoiceUpdateResult> {
  return fetchJson<VoiceUpdateResult>(`${BASE}/projects/${projectId}/project-voice-guide/update`, {
    method: "POST",
    body: JSON.stringify({ sceneId, sceneText }),
    signal: AbortSignal.timeout(600_000),
  });
}

export async function apiRedistillVoice(projectId: string): Promise<{ ring1Injection: string; skipped?: boolean }> {
  return fetchJson<{ ring1Injection: string; skipped?: boolean }>(`${BASE}/projects/${projectId}/voice/redistill`, {
    method: "POST",
  });
}
