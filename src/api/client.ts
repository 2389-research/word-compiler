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

export function apiDeleteChunk(id: string): Promise<void> {
  return fetchJson(`${BASE}/chunks/${id}`, { method: "DELETE" });
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

export function apiListProfileAdjustments(projectId: string, status?: string): Promise<ProfileAdjustmentData[]> {
  const query = status ? `?status=${status}` : "";
  return fetchJson(`${BASE}/projects/${projectId}/profile-adjustments${query}`);
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

export async function apiListVoiceGuideVersions(): Promise<VoiceGuideVersion[]> {
  return fetchJson<VoiceGuideVersion[]>(`${BASE}/voice-guide/versions`);
}

// ─── Writing Samples ─────────────────────────────────

export function apiListWritingSamples(): Promise<WritingSample[]> {
  return fetchJson<WritingSample[]>(`${BASE}/writing-samples`);
}

export function apiCreateWritingSample(filename: string | null, domain: string, text: string): Promise<WritingSample> {
  return fetchJson<WritingSample>(`${BASE}/writing-samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, domain, text }),
  });
}

export async function apiDeleteWritingSample(id: string): Promise<void> {
  const res = await fetch(`${BASE}/writing-samples/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Failed to delete writing sample: ${(body as { error: string }).error}`);
  }
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
