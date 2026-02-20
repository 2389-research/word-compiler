import { fetchModels } from "../../llm/client.js";
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
  bible = $state<Bible | null>(null);
  bibleVersions = $state<Array<{ version: number; createdAt: string }>>([]);

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
  isExtractingIR = $state(false);
  selectedChunkIndex = $state<number | null>(null);
  bootstrapModalOpen = $state(false);
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
    const sceneId = scene.plan.id;
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
    const sceneId = scene.plan.id;
    const chunks = (this.sceneChunks[sceneId] ?? []).filter((_, i) => i !== index);
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

  setExtractingIR(value: boolean) {
    this.isExtractingIR = value;
  }

  setBootstrapOpen(value: boolean) {
    this.bootstrapModalOpen = value;
  }

  setSceneIR(sceneId: string, ir: NarrativeIR) {
    this.sceneIRs = { ...this.sceneIRs, [sceneId]: ir };
  }

  verifySceneIR(sceneId: string) {
    const ir = this.sceneIRs[sceneId];
    if (!ir) return;
    this.sceneIRs = { ...this.sceneIRs, [sceneId]: { ...ir, verified: true } };
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

  loadFromServer(data: {
    project: Project;
    bible: Bible | null;
    chapterArc: ChapterArc | null;
    scenes: SceneEntry[];
    sceneChunks: Record<string, Chunk[]>;
    bibleVersions: Array<{ version: number; createdAt: string }>;
  }) {
    this.project = data.project;
    this.bible = data.bible;
    this.chapterArc = data.chapterArc;
    this.scenes = data.scenes;
    this.sceneChunks = data.sceneChunks;
    this.bibleVersions = data.bibleVersions;
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
