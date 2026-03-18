import { fetchModels } from "../../llm/client.js";
import type { VoiceGuide } from "../../profile/types.js";
import type { EditorialAnnotation } from "../../review/types.js";
import type {
  AuditFlag,
  Bible,
  ChapterArc,
  Chunk,
  CompilationConfig,
  CompilationLog,
  CompiledPayload,
  LintResult,
  ModelSpec,
  NarrativeIR,
  Project,
  ProseMetrics,
  ScenePlan,
  SceneStatus,
} from "../../types/index.js";
import { createDefaultCompilationConfig } from "../../types/index.js";

export interface SceneEntry {
  plan: ScenePlan;
  status: SceneStatus;
  sceneOrder: number;
}

export class ProjectStore {
  // ─── Project-level state ───────────────────────
  project = $state<Project | null>(null);
  chapterArc = $state<ChapterArc | null>(null);
  scenes = $state<SceneEntry[]>([]);
  activeSceneIndex = $state(0);
  sceneChunks = $state<Record<string, Chunk[]>>({});
  sceneIRs = $state<Record<string, NarrativeIR>>({});
  editorialAnnotations = $state<Record<string, Map<number, EditorialAnnotation[]>>>({});
  bible = $state<Bible | null>(null);
  bibleVersions = $state<Array<{ version: number; createdAt: string }>>([]);
  voiceGuide = $state<VoiceGuide | null>(null);
  projectVoiceGuide = $state<VoiceGuide | null>(null);

  // ─── Config ────────────────────────────────────
  compilationConfig = $state<CompilationConfig>(createDefaultCompilationConfig());
  availableModels = $state<ModelSpec[]>([]);

  // ─── Derived from active scene ─────────────────
  compiledPayload = $state<CompiledPayload | null>(null);
  compilationLog = $state<CompilationLog | null>(null);
  lintResult = $state<LintResult | null>(null);
  auditFlags = $state<AuditFlag[]>([]);
  metrics = $state<ProseMetrics | null>(null);

  // ─── UI state ──────────────────────────────────
  isGenerating = $state(false);
  isAutopilot = $state(false);
  autopilotCancelled = $state(false);
  isAuditing = $state(false);
  reviewingChunks = $state<Set<number>>(new Set());
  extractingIRSceneId = $state<string | null>(null);
  selectedChunkIndex = $state<number | null>(null);
  bootstrapModalOpen = $state(false);
  bibleAuthoringOpen = $state(false);
  sceneAuthoringOpen = $state(false);
  irInspectorOpen = $state(false);
  error = $state<string | null>(null);

  // ─── Derived getters ──────────────────────────
  get activeScene(): SceneEntry | null {
    return this.scenes[this.activeSceneIndex] ?? null;
  }

  get activeScenePlan(): ScenePlan | null {
    return this.activeScene?.plan ?? null;
  }

  get activeSceneChunks(): Chunk[] {
    const id = this.activeScenePlan?.id;
    return id ? (this.sceneChunks[id] ?? []) : [];
  }

  get previousSceneLastChunk(): Chunk | null {
    if (this.activeSceneIndex <= 0) return null;
    const prevScene = this.scenes[this.activeSceneIndex - 1];
    if (!prevScene) return null;
    const prevChunks = this.sceneChunks[prevScene.plan.id] ?? [];
    return prevChunks.length > 0 ? prevChunks[prevChunks.length - 1]! : null;
  }

  get activeSceneIR(): NarrativeIR | null {
    const id = this.activeScenePlan?.id;
    return id ? (this.sceneIRs[id] ?? null) : null;
  }

  /** IRs for all scenes before the active one (ordered by scene order). */
  get previousSceneIRs(): NarrativeIR[] {
    const irs: NarrativeIR[] = [];
    for (let i = 0; i < this.activeSceneIndex; i++) {
      const scene = this.scenes[i];
      if (!scene) continue;
      const ir = this.sceneIRs[scene.plan.id];
      if (ir) irs.push(ir);
    }
    return irs;
  }

  get isExtractingIR(): boolean {
    return this.extractingIRSceneId !== null && this.extractingIRSceneId === this.activeScenePlan?.id;
  }

  // ─── Initialization ───────────────────────────
  constructor() {
    fetchModels()
      .then((models) => {
        this.availableModels = models;
      })
      .catch(() => {
        // Proxy not running — models list stays empty
      });
  }

  // ─── Mutations ────────────────────────────────
  setProject(project: Project | null) {
    this.project = project;
    this.error = null;
  }

  setBible(bible: Bible | null) {
    this.bible = bible;
    this.error = null;
  }

  setBibleVersions(versions: Array<{ version: number; createdAt: string }>) {
    this.bibleVersions = versions;
  }

  setVoiceGuide(guide: VoiceGuide | null) {
    this.voiceGuide = guide;
  }

  setProjectVoiceGuide(guide: VoiceGuide | null) {
    this.projectVoiceGuide = guide;
  }

  setChapterArc(arc: ChapterArc | null) {
    this.chapterArc = arc;
  }

  setScenes(scenes: SceneEntry[]) {
    this.scenes = scenes;
  }

  setActiveScene(index: number) {
    this.activeSceneIndex = index;
    this.selectedChunkIndex = null;
  }

  updateSceneStatus(sceneId: string, status: SceneStatus) {
    this.scenes = this.scenes.map((s) => (s.plan.id === sceneId ? { ...s, status } : s));
  }

  setSceneChunks(sceneId: string, chunks: Chunk[]) {
    this.sceneChunks = { ...this.sceneChunks, [sceneId]: chunks };
  }

  setConfig(config: CompilationConfig) {
    this.compilationConfig = config;
  }

  setModels(models: ModelSpec[]) {
    this.availableModels = models;
  }

  addChunk(chunk: Chunk) {
    const sceneId = chunk.sceneId;
    const existing = this.sceneChunks[sceneId] ?? [];
    // Auto-transition to drafting on first chunk
    this.scenes = this.scenes.map((s) =>
      s.plan.id === sceneId && s.status === "planned" ? { ...s, status: "drafting" as SceneStatus } : s,
    );
    this.sceneChunks = { ...this.sceneChunks, [sceneId]: [...existing, chunk] };
  }

  updateChunk(index: number, changes: Partial<Chunk>) {
    const scene = this.activeScene;
    if (!scene) return;
    this.updateChunkForScene(scene.plan.id, index, changes);
  }

  updateChunkForScene(sceneId: string, index: number, changes: Partial<Chunk>) {
    const chunks = [...(this.sceneChunks[sceneId] ?? [])];
    const existing = chunks[index];
    if (existing) {
      chunks[index] = { ...existing, ...changes };
    }
    this.sceneChunks = { ...this.sceneChunks, [sceneId]: chunks };
  }

  removeChunk(index: number) {
    const scene = this.activeScene;
    if (!scene) return;
    this.removeChunkForScene(scene.plan.id, index);
  }

  removeChunkForScene(sceneId: string, index: number) {
    const chunks = (this.sceneChunks[sceneId] ?? [])
      .filter((_, i) => i !== index)
      .map((c, i) => ({ ...c, sequenceNumber: i }));
    this.sceneChunks = { ...this.sceneChunks, [sceneId]: chunks };
  }

  setCompiled(payload: CompiledPayload | null, log: CompilationLog | null, lint: LintResult | null) {
    this.compiledPayload = payload;
    this.compilationLog = log;
    this.lintResult = lint;
  }

  setAudit(flags: AuditFlag[], metrics: ProseMetrics | null) {
    this.auditFlags = flags;
    this.metrics = metrics;
  }

  resolveAuditFlag(flagId: string, action: string, wasActionable: boolean) {
    this.auditFlags = this.auditFlags.map((f) =>
      f.id === flagId ? { ...f, resolved: true, resolvedAction: action, wasActionable } : f,
    );
  }

  dismissAuditFlag(flagId: string) {
    this.auditFlags = this.auditFlags.map((f) =>
      f.id === flagId ? { ...f, resolved: true, resolvedAction: "", wasActionable: false } : f,
    );
  }

  setGenerating(value: boolean) {
    this.isGenerating = value;
  }

  setAuditing(value: boolean) {
    this.isAuditing = value;
  }

  setReviewingChunks(chunks: Set<number>) {
    this.reviewingChunks = chunks;
  }

  setAutopilot(value: boolean) {
    this.isAutopilot = value;
    if (value) this.autopilotCancelled = false;
  }

  cancelAutopilot() {
    this.autopilotCancelled = true;
    this.isAutopilot = false;
  }

  setExtractingIR(sceneId: string | null) {
    this.extractingIRSceneId = sceneId;
  }

  setBootstrapOpen(value: boolean) {
    this.bootstrapModalOpen = value;
  }

  setBibleAuthoringOpen(value: boolean) {
    this.bibleAuthoringOpen = value;
  }

  setSceneAuthoringOpen(value: boolean) {
    this.sceneAuthoringOpen = value;
  }

  addMultipleScenePlans(plans: ScenePlan[]) {
    const newEntries: SceneEntry[] = plans.map((plan, i) => ({
      plan,
      status: "planned" as SceneStatus,
      sceneOrder: this.scenes.length + i,
    }));
    this.scenes = [...this.scenes, ...newEntries];
    if (newEntries.length > 0) {
      this.activeSceneIndex = this.scenes.length - newEntries.length;
    }
  }

  setSceneIR(sceneId: string, ir: NarrativeIR) {
    this.sceneIRs = { ...this.sceneIRs, [sceneId]: ir };
  }

  verifySceneIR(sceneId: string) {
    const ir = this.sceneIRs[sceneId];
    if (!ir) return;
    this.sceneIRs = { ...this.sceneIRs, [sceneId]: { ...ir, verified: true } };
  }

  setEditorialAnnotations(sceneId: string, chunkIndex: number, anns: EditorialAnnotation[]) {
    const existing = this.editorialAnnotations[sceneId] ?? new Map<number, EditorialAnnotation[]>();
    const updated = new Map(existing);
    updated.set(chunkIndex, anns);
    this.editorialAnnotations = { ...this.editorialAnnotations, [sceneId]: updated };
  }

  getEditorialAnnotations(sceneId: string): Map<number, EditorialAnnotation[]> {
    return this.editorialAnnotations[sceneId] ?? new Map();
  }

  clearEditorialAnnotations(sceneId: string) {
    const { [sceneId]: _, ...rest } = this.editorialAnnotations;
    this.editorialAnnotations = rest;
  }

  setIRInspectorOpen(value: boolean) {
    this.irInspectorOpen = value;
  }

  setError(error: string | null) {
    this.error = error;
  }

  selectChunk(index: number | null) {
    this.selectedChunkIndex = index;
  }

  completeScene(sceneId: string) {
    this.scenes = this.scenes.map((s) => (s.plan.id === sceneId ? { ...s, status: "complete" as SceneStatus } : s));
  }

  setScenePlan(plan: ScenePlan | null) {
    if (!plan) {
      this.scenes = [];
      this.activeSceneIndex = 0;
      return;
    }
    const entry: SceneEntry = { plan, status: "planned", sceneOrder: 0 };
    this.scenes = [entry];
    this.activeSceneIndex = 0;
  }

  addScenePlan(plan: ScenePlan) {
    // If a scene with this ID already exists, replace it in place
    const existingIndex = this.scenes.findIndex((s) => s.plan.id === plan.id);
    if (existingIndex >= 0) {
      this.scenes = this.scenes.map((s, i) => (i === existingIndex ? { ...s, plan } : s));
      return;
    }
    const entry: SceneEntry = { plan, status: "planned", sceneOrder: this.scenes.length };
    this.scenes = [...this.scenes, entry];
    this.activeSceneIndex = this.scenes.length - 1;
  }

  loadFromServer(data: {
    project: Project;
    bible: Bible | null;
    chapterArc: ChapterArc | null;
    scenes: SceneEntry[];
    sceneChunks: Record<string, Chunk[]>;
    sceneIRs: Record<string, NarrativeIR>;
    bibleVersions: Array<{ version: number; createdAt: string }>;
    voiceGuide: VoiceGuide | null;
    projectVoiceGuide?: VoiceGuide | null;
  }) {
    this.project = data.project;
    this.bible = data.bible;
    this.chapterArc = data.chapterArc;
    this.scenes = data.scenes;
    this.sceneChunks = data.sceneChunks;
    this.sceneIRs = data.sceneIRs;
    this.bibleVersions = data.bibleVersions;
    this.voiceGuide = data.voiceGuide;
    this.projectVoiceGuide = data.projectVoiceGuide ?? null;
    this.error = null;
  }

  resetForProjectSwitch() {
    this.project = null;
    this.bible = null;
    this.bibleVersions = [];
    this.voiceGuide = null;
    this.projectVoiceGuide = null;
    this.chapterArc = null;
    this.scenes = [];
    this.activeSceneIndex = 0;
    this.sceneChunks = {};
    this.sceneIRs = {};
    this.editorialAnnotations = {};
    this.compiledPayload = null;
    this.compilationLog = null;
    this.lintResult = null;
    this.auditFlags = [];
    this.metrics = null;
    this.compilationConfig = createDefaultCompilationConfig();
    this.isGenerating = false;
    this.isAuditing = false;
    this.reviewingChunks = new Set();
    this.isAutopilot = false;
    this.autopilotCancelled = false;
    this.extractingIRSceneId = null;
    this.selectedChunkIndex = null;
    this.bootstrapModalOpen = false;
    this.bibleAuthoringOpen = false;
    this.sceneAuthoringOpen = false;
    this.irInspectorOpen = false;
    this.error = null;
  }

  // ─── Utilities ────────────────────────────────
  selectModel(modelId: string) {
    const spec = this.availableModels.find((m) => m.id === modelId);
    if (spec) {
      this.compilationConfig = {
        ...this.compilationConfig,
        defaultModel: spec.id,
        modelContextWindow: spec.contextWindow,
        reservedForOutput: Math.min(this.compilationConfig.reservedForOutput, spec.maxOutput),
      };
    }
  }

  loadFile(): Promise<string | null> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    return new Promise((resolve) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const text = await file.text();
        resolve(text);
      };
      input.click();
    });
  }

  saveFile(data: unknown, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
