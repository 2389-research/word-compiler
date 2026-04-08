import { lintPayload } from "../linter/index.js";
import type { VoiceGuide } from "../profile/types.js";
import { countTokens } from "../tokens/index.js";
import type {
  Bible,
  ChapterArc,
  Chunk,
  CompilationConfig,
  CompilationLog,
  CompiledPayload,
  LintResult,
  NarrativeIR,
  ScenePlan,
} from "../types/index.js";
import { generateId } from "../types/index.js";
import { enforceBudget } from "./budget.js";
import { buildRing1 } from "./ring1.js";
import { buildRing2, type Ring2Result } from "./ring2.js";
import { buildRing3 } from "./ring3.js";

export interface CompileResult {
  payload: CompiledPayload;
  log: CompilationLog;
  lintResult: LintResult;
}

export function compilePayload(
  bible: Bible,
  plan: ScenePlan,
  previousChunks: Chunk[],
  chunkNumber: number,
  config: CompilationConfig,
  chapterArc?: ChapterArc,
  previousSceneLastChunk?: Chunk,
  previousSceneIRs?: NarrativeIR[],
  voiceGuide?: VoiceGuide,
): CompileResult {
  const irList = previousSceneIRs ?? [];

  // 1. Build rings
  const ring1Result = buildRing1(bible, config, voiceGuide);
  const ring2Result: Ring2Result | null = chapterArc ? buildRing2(chapterArc, bible, irList, config) : null;
  // Pass the last verified IR as the previous-scene IR for Part B bridge
  const lastVerifiedIR = [...irList].reverse().find((ir) => ir.verified);
  const ring3Result = buildRing3(
    plan,
    bible,
    previousChunks,
    chunkNumber,
    config,
    previousSceneLastChunk,
    lastVerifiedIR,
  );

  // 2. Budget enforcement
  const available = config.modelContextWindow - config.reservedForOutput;
  const budgetResult = enforceBudget(
    ring1Result.sections,
    ring3Result.sections,
    available,
    config,
    ring2Result?.sections,
  );

  // 3. Lint (using post-budget values)
  const postBudgetR1 = {
    ...ring1Result,
    text: budgetResult.r1,
    tokenCount: countTokens(budgetResult.r1),
    sections: budgetResult.r1Sections,
  };
  const postBudgetR3 = {
    ...ring3Result,
    text: budgetResult.r3,
    tokenCount: countTokens(budgetResult.r3),
    sections: budgetResult.r3Sections,
  };
  const r2TokenCount = budgetResult.r2 ? countTokens(budgetResult.r2) : 0;
  const lintResult = lintPayload(postBudgetR1, postBudgetR3, plan, bible, config, r2TokenCount);

  // 4. Generation instruction
  const chunkDesc = plan.chunkDescriptions[chunkNumber] ?? "";
  const wordTarget = Math.round((plan.estimatedWordCount[0] + plan.estimatedWordCount[1]) / 2 / plan.chunkCount);

  const continuationNote =
    chunkNumber > 0
      ? `Continue directly from where the preceding text ends — do not repeat, summarize, or re-establish what was already written. Pick up mid-argument. `
      : "";

  const genInstruction =
    `Continue this essay (~${wordTarget} words). ` +
    `This is section ${chunkNumber + 1} of ${plan.chunkCount}${chunkDesc ? `: ${chunkDesc}` : ""}. ` +
    continuationNote +
    `Follow all constraints in the voice specifications and section contract. ` +
    `Support claims with reasoning. Maintain argumentative coherence with prior sections. ` +
    `Match the author's voice.`;

  // 5. Assemble
  const userMessage = [budgetResult.r2, budgetResult.r3, genInstruction].filter(Boolean).join("\n\n---\n\n");

  const payload: CompiledPayload = {
    systemMessage: budgetResult.r1,
    userMessage,
    temperature: config.defaultTemperature,
    topP: config.defaultTopP,
    maxTokens: config.reservedForOutput,
    model: config.defaultModel,
  };

  // 6. Build log
  const payloadHash = generateId(); // Unique ID per compilation (not a content hash)
  const log: CompilationLog = {
    id: generateId(),
    chunkId: `${plan.id}_chunk${chunkNumber}`,
    payloadHash,
    ring1Tokens: countTokens(budgetResult.r1),
    ring2Tokens: budgetResult.r2 ? countTokens(budgetResult.r2) : 0,
    ring3Tokens: countTokens(budgetResult.r3),
    totalTokens:
      countTokens(budgetResult.r1) +
      (budgetResult.r2 ? countTokens(budgetResult.r2) : 0) +
      countTokens(budgetResult.r3),
    availableBudget: available,
    ring1Contents: budgetResult.r1Sections.map((s) => s.name),
    ring2Contents: budgetResult.r2Sections?.map((s) => s.name) ?? [],
    ring3Contents: budgetResult.r3Sections.map((s) => s.name),
    lintWarnings: lintResult.issues.filter((i) => i.severity === "warning").map((i) => i.message),
    lintErrors: lintResult.issues.filter((i) => i.severity === "error").map((i) => i.message),
    timestamp: new Date().toISOString(),
  };

  return { payload, log, lintResult };
}
