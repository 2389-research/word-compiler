import type {
  CompilationConfig,
  CompilationLog,
  LintResult,
  AuditFlag,
  ProseMetrics,
} from "../src/types/index.js";

// ─── Check Results ──────────────────────────────────────

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ─── Judge Scores ───────────────────────────────────────

export type JudgeDimension =
  | "voice_consistency"
  | "subtext_adherence"
  | "tone_whiplash"
  | "metaphoric_register"
  | "scene_goal"
  | "continuity";

export interface JudgeScore {
  dimension: JudgeDimension;
  score: number;
  passed: boolean;
  reasoning: string;
}

// ─── Per-Scene Eval Data ────────────────────────────────

export interface EvalSceneResult {
  sceneId: string;
  compilationLog: CompilationLog;
  lintResult: LintResult;
  chunks: Array<{
    generatedText: string;
    auditFlags: AuditFlag[];
    metrics: ProseMetrics;
  }>;
}

// ─── Cost Tracking ──────────────────────────────────────

export interface EvalCost {
  generatorInputTokens: number;
  generatorOutputTokens: number;
  judgeInputTokens: number;
  judgeOutputTokens: number;
}

// ─── Run Artifact ───────────────────────────────────────

export interface EvalRunArtifact {
  runId: string;
  timestamp: string;
  // Inputs
  bibleVersion: number;
  scenePlanIds: string[];
  chapterArcId: string;
  generatorModel: string;
  judgeModel: string;
  config: CompilationConfig;
  // Per-scene results
  scenes: EvalSceneResult[];
  // Evaluation results
  deterministicChecks: CheckResult[];
  judgeScores: JudgeScore[];
  // Aggregates
  overallPass: boolean;
  voiceConsistencyScore: number;
  continuityScore: number;
  cost: EvalCost;
}

// ─── Eval Report ────────────────────────────────────────

export interface EvalReport {
  summary: string;
  deterministicPassRate: number;
  judgePassRate: number;
  overallPass: boolean;
  failures: string[];
  markdown: string;
}

// ─── Runner Options ─────────────────────────────────────

export interface RunnerOptions {
  rollouts: number;
  mock: boolean;
  judgeModel: string;
  generatorModel: string;
  artifactDir: string;
}
