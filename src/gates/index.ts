import type { AuditFlag, Bible, Chunk, LintResult, ScenePlan, SceneStatus } from "../types/index.js";

export interface GateResult {
  passed: boolean;
  messages: string[];
}

/**
 * Gate 1: Scene plan has minimum required fields before compilation.
 */
export function checkScenePlanGate(plan: ScenePlan): GateResult {
  const messages: string[] = [];

  if (!plan.title.trim()) {
    messages.push("Scene title is required.");
  }
  if (!plan.povCharacterId.trim()) {
    messages.push("POV character must be selected.");
  }
  if (!plan.narrativeGoal.trim()) {
    messages.push("Narrative goal is required.");
  }
  if (!plan.failureModeToAvoid.trim()) {
    messages.push("Failure mode to avoid is required.");
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Gate 2: No lint errors before generation.
 */
export function checkCompileGate(lintResult: LintResult): GateResult {
  const errors = lintResult.issues.filter((i) => i.severity === "error");
  if (errors.length === 0) {
    return { passed: true, messages: [] };
  }
  return {
    passed: false,
    messages: errors.map((e) => `[${e.code}] ${e.message}`),
  };
}

/**
 * Gate 3: Chunk must be reviewed (accepted or edited) before generating the next.
 */
export function checkChunkReviewGate(chunk: Chunk): GateResult {
  if (chunk.status === "accepted" || chunk.status === "edited") {
    return { passed: true, messages: [] };
  }
  return {
    passed: false,
    messages: [
      `Chunk ${chunk.sequenceNumber + 1} is "${chunk.status}" — must be accepted or edited before continuing.`,
    ],
  };
}

/**
 * Gate 4: All expected chunks are present and reviewed.
 */
export function checkSceneCompletionGate(chunks: Chunk[], plan: ScenePlan): GateResult {
  const messages: string[] = [];

  if (chunks.length < plan.chunkCount) {
    messages.push(`Only ${chunks.length} of ${plan.chunkCount} chunks generated.`);
  }

  for (const chunk of chunks) {
    if (chunk.status !== "accepted" && chunk.status !== "edited") {
      messages.push(`Chunk ${chunk.sequenceNumber + 1} is "${chunk.status}" — must be accepted or edited.`);
    }
  }

  return { passed: messages.length === 0, messages };
}

/**
 * Gate 5: No unresolved critical audit flags.
 */
export function checkAuditResolutionGate(flags: AuditFlag[]): GateResult {
  const unresolvedCritical = flags.filter((f) => f.severity === "critical" && !f.resolved);
  if (unresolvedCritical.length === 0) {
    return { passed: true, messages: [] };
  }
  return {
    passed: false,
    messages: unresolvedCritical.map((f) => `Unresolved critical flag: [${f.category}] ${f.message}`),
  };
}

/**
 * Gate 6: Bible version matches the latest available version.
 */
export function checkBibleVersioningGate(bible: Bible, latestVersion: number): GateResult {
  if (bible.version >= latestVersion) {
    return { passed: true, messages: [] };
  }
  return {
    passed: false,
    messages: [
      `Bible version ${bible.version} is outdated — latest is ${latestVersion}. Recompile with current bible.`,
    ],
  };
}

// ─── Workflow Stage Gates ──────────────────────────

function getUnresolvedCriticalFlags(flags: AuditFlag[]): AuditFlag[] {
  return flags.filter((f) => f.severity === "critical" && !f.resolved);
}

/**
 * Stage gate: Bootstrap → Plan. Bible must exist with at least 1 character.
 */
export function checkBootstrapToPlanGate(bible: Bible | null): GateResult {
  if (!bible) {
    return { passed: false, messages: ["Create an essay brief first."] };
  }
  if (bible.characters.length === 0) {
    return { passed: false, messages: ["Add an author voice to your brief."] };
  }
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Plan → Draft. At least 1 scene plan with title and narrative goal.
 */
export function checkPlanToDraftGate(scenePlans: ScenePlan[]): GateResult {
  const ready = scenePlans.filter((p) => p.title.trim() && p.narrativeGoal.trim());
  if (ready.length === 0) {
    return { passed: false, messages: ["Create at least 1 section plan with a title and section goal."] };
  }
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Draft → Audit. At least 1 chunk generated in any scene.
 */
export function checkDraftToAuditGate(sceneChunks: Record<string, Chunk[]>): GateResult {
  const hasChunks = Object.values(sceneChunks).some((chunks) => chunks.length > 0);
  if (!hasChunks) {
    return { passed: false, messages: ["Generate at least 1 chunk before auditing."] };
  }
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Audit → Edit. No unresolved critical audit flags.
 */
export function checkAuditToEditGate(flags: AuditFlag[]): GateResult {
  const unresolved = getUnresolvedCriticalFlags(flags);
  if (unresolved.length > 0) {
    return {
      passed: false,
      messages: [`${unresolved.length} unresolved critical flag(s) remain.`],
    };
  }
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Edit → Complete. Soft gate — always passes (editing is subjective).
 */
export function checkEditToCompleteGate(): GateResult {
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Audit → Complete. No unresolved critical audit flags.
 */
export function checkAuditToCompleteGate(flags: AuditFlag[]): GateResult {
  const unresolved = getUnresolvedCriticalFlags(flags);
  if (unresolved.length > 0) {
    return {
      passed: false,
      messages: [`${unresolved.length} unresolved critical flag(s) remain.`],
    };
  }
  return { passed: true, messages: [] };
}

/**
 * Stage gate: Complete → Export. At least 1 scene marked "complete".
 */
export function checkCompleteToExportGate(scenes: Array<{ status: SceneStatus }>): GateResult {
  const complete = scenes.filter((s) => s.status === "complete");
  if (complete.length === 0) {
    return { passed: false, messages: ["Mark at least 1 section as complete."] };
  }
  return { passed: true, messages: [] };
}
