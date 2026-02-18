import type {
  Bible,
  ScenePlan,
  Chunk,
  CompilationConfig,
  CompiledPayload,
  CompilationLog,
  LintResult,
} from "../types/index.js";
import { generateId } from "../types/index.js";
import { countTokens } from "../tokens/index.js";
import { buildRing1 } from "./ring1.js";
import { buildRing3 } from "./ring3.js";
import { enforceBudget } from "./budget.js";
import { lintPayload } from "../linter/index.js";

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
): CompileResult {
  // 1. Build rings
  const ring1Result = buildRing1(bible, config);
  const ring3Result = buildRing3(plan, bible, previousChunks, chunkNumber, config);

  // 2. Budget enforcement
  const available = config.modelContextWindow - config.reservedForOutput;
  const budgetResult = enforceBudget(
    ring1Result.sections,
    ring3Result.sections,
    available,
    config,
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
  const lintResult = lintPayload(postBudgetR1, postBudgetR3, plan, bible, config);

  // 4. Generation instruction
  const chunkDesc = plan.chunkDescriptions[chunkNumber] ?? "";
  const wordTarget = Math.round(
    (plan.estimatedWordCount[0] + plan.estimatedWordCount[1]) / 2 / plan.chunkCount,
  );

  const genInstruction =
    `Write the next section of this scene (~${wordTarget} words). ` +
    `This is section ${chunkNumber + 1} of ${plan.chunkCount}${chunkDesc ? `: ${chunkDesc}` : ""}. ` +
    `Follow all constraints in the scene contract and voice specifications. ` +
    `Do not summarize. Do not resolve tension unless the plan calls for it. ` +
    `Do not make subtext into text. Do not explain what characters are feeling — show it.`;

  // 5. Assemble
  const userMessage = [budgetResult.r3, genInstruction]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const payload: CompiledPayload = {
    systemMessage: budgetResult.r1,
    userMessage,
    temperature: config.defaultTemperature,
    topP: config.defaultTopP,
    maxTokens: config.reservedForOutput,
    model: config.defaultModel,
  };

  // 6. Build log
  const payloadHash = generateId(); // Placeholder — real hash in Phase 1
  const log: CompilationLog = {
    id: generateId(),
    chunkId: `${plan.id}_chunk${chunkNumber}`,
    payloadHash,
    ring1Tokens: countTokens(budgetResult.r1),
    ring2Tokens: 0, // Phase 0: no Ring 2
    ring3Tokens: countTokens(budgetResult.r3),
    totalTokens: countTokens(budgetResult.r1) + countTokens(budgetResult.r3),
    availableBudget: available,
    ring1Contents: budgetResult.r1Sections.map((s) => s.name),
    ring3Contents: budgetResult.r3Sections.map((s) => s.name),
    lintWarnings: lintResult.issues
      .filter((i) => i.severity === "warning")
      .map((i) => i.message),
    lintErrors: lintResult.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message),
    timestamp: new Date().toISOString(),
  };

  return { payload, log, lintResult };
}
