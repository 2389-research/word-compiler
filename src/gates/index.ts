import type { ScenePlan, LintResult, Chunk, AuditFlag, Bible } from "../types/index.js";

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
    messages: [`Chunk ${chunk.sequenceNumber + 1} is "${chunk.status}" — must be accepted or edited before continuing.`],
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
    messages: unresolvedCritical.map(
      (f) => `Unresolved critical flag: [${f.category}] ${f.message}`,
    ),
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
    messages: [`Bible version ${bible.version} is outdated — latest is ${latestVersion}. Recompile with current bible.`],
  };
}
