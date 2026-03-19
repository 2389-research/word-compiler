import { checkKillList } from "../../src/auditor/index.js";
import { checkDanglingSetups } from "../../src/auditor/setupPayoff.js";
import { checkCompileGate } from "../../src/gates/index.js";
import type {
  Bible,
  CharacterDossier,
  CompilationConfig,
  CompilationLog,
  LintResult,
  NarrativeIR,
  ProseMetrics,
  ScenePlan,
} from "../../src/types/index.js";
import type { CheckResult } from "../types.js";

// ─── Individual Checks ──────────────────────────────────

export function checkKillListCompliance(prose: string, bible: Bible, sceneId: string): CheckResult {
  const flags = checkKillList(prose, bible.styleGuide.killList, sceneId);
  if (flags.length === 0) {
    return { name: "kill_list", passed: true, detail: "No kill list violations." };
  }
  const violations = flags.map((f) => f.message).join("; ");
  return { name: "kill_list", passed: false, detail: `${flags.length} violation(s): ${violations}` };
}

export function checkBudgetCompliance(log: CompilationLog, config: CompilationConfig): CheckResult {
  const available = config.modelContextWindow - config.reservedForOutput;
  if (log.totalTokens <= available) {
    return {
      name: "budget_compliance",
      passed: true,
      detail: `${log.totalTokens} tokens within ${available} budget.`,
    };
  }
  return {
    name: "budget_compliance",
    passed: false,
    detail: `${log.totalTokens} tokens exceeds ${available} budget by ${log.totalTokens - available}.`,
  };
}

export function checkRing1Cap(log: CompilationLog, config: CompilationConfig): CheckResult {
  if (log.ring1Tokens <= config.ring1HardCap) {
    return {
      name: "ring1_cap",
      passed: true,
      detail: `Ring 1 at ${log.ring1Tokens} tokens (cap: ${config.ring1HardCap}).`,
    };
  }
  return {
    name: "ring1_cap",
    passed: false,
    detail: `Ring 1 at ${log.ring1Tokens} tokens exceeds hard cap of ${config.ring1HardCap}.`,
  };
}

export function checkLintCompliance(lintResult: LintResult): CheckResult {
  const gate = checkCompileGate(lintResult);
  if (gate.passed) {
    return { name: "lint_compliance", passed: true, detail: "No lint errors." };
  }
  return {
    name: "lint_compliance",
    passed: false,
    detail: `Lint errors: ${gate.messages.join("; ")}`,
  };
}

export function checkSentenceDistribution(metrics: ProseMetrics, character: CharacterDossier | undefined): CheckResult {
  // Variance check — prose should have rhythm variety
  if (metrics.sentenceLengthStdDev < 3.0 && metrics.sentenceCount >= 5) {
    return {
      name: "sentence_distribution",
      passed: false,
      detail: `Sentence variance ${metrics.sentenceLengthStdDev.toFixed(1)} below minimum 3.0 — rhythmically flat.`,
    };
  }

  // Character voice range check (if character provides one)
  if (character?.voice.sentenceLengthRange) {
    const [min, max] = character.voice.sentenceLengthRange;
    if (metrics.avgSentenceLength < min * 0.5 || metrics.avgSentenceLength > max * 2) {
      return {
        name: "sentence_distribution",
        passed: false,
        detail: `Avg sentence length ${metrics.avgSentenceLength.toFixed(1)} outside character range [${min}, ${max}] (with tolerance).`,
      };
    }
  }

  return {
    name: "sentence_distribution",
    passed: true,
    detail: `Sentence variance ${metrics.sentenceLengthStdDev.toFixed(1)}, avg length ${metrics.avgSentenceLength.toFixed(1)}.`,
  };
}

export function checkProhibitedLanguage(prose: string, character: CharacterDossier | undefined): CheckResult {
  if (!character || character.voice.prohibitedLanguage.length === 0) {
    return { name: "prohibited_language", passed: true, detail: "No prohibited language defined." };
  }

  const violations: string[] = [];
  for (const word of character.voice.prohibitedLanguage) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
    const matches = [...prose.matchAll(regex)];
    if (matches.length > 0) {
      violations.push(`"${word}" (${matches.length}×)`);
    }
  }

  if (violations.length === 0) {
    return { name: "prohibited_language", passed: true, detail: "No prohibited words found." };
  }
  return {
    name: "prohibited_language",
    passed: false,
    detail: `Prohibited language found: ${violations.join(", ")}`,
  };
}

export function checkStructuralBans(prose: string, bible: Bible): CheckResult {
  if (bible.styleGuide.structuralBans.length === 0) {
    return { name: "structural_bans", passed: true, detail: "No structural bans defined." };
  }

  const violations: string[] = [];
  for (const ban of bible.styleGuide.structuralBans) {
    try {
      const regex = new RegExp(ban, "gi");
      if (regex.test(prose)) {
        violations.push(`"${ban}"`);
      }
    } catch {
      // If the ban isn't valid regex, treat as literal substring
      if (prose.toLowerCase().includes(ban.toLowerCase())) {
        violations.push(`"${ban}"`);
      }
    }
  }

  if (violations.length === 0) {
    return { name: "structural_bans", passed: true, detail: "No structural ban violations." };
  }
  return {
    name: "structural_bans",
    passed: false,
    detail: `Structural ban violations: ${violations.join(", ")}`,
  };
}

export function checkWordCount(metrics: ProseMetrics, plan: ScenePlan): CheckResult {
  const [min, max] = plan.estimatedWordCount;
  const tolerance = 0.2;
  const effectiveMin = Math.floor(min * (1 - tolerance));
  const effectiveMax = Math.ceil(max * (1 + tolerance));

  if (metrics.wordCount >= effectiveMin && metrics.wordCount <= effectiveMax) {
    return {
      name: "word_count",
      passed: true,
      detail: `${metrics.wordCount} words within range [${effectiveMin}, ${effectiveMax}] (plan: [${min}, ${max}] ±20%).`,
    };
  }
  return {
    name: "word_count",
    passed: false,
    detail: `${metrics.wordCount} words outside range [${effectiveMin}, ${effectiveMax}] (plan: [${min}, ${max}] ±20%).`,
  };
}

export function checkDialoguePresence(prose: string): CheckResult {
  // Count dialogue pairs by matching open/close quotes
  const quoteMatches = prose.match(/[""\u201C][^""\u201D]*[""\u201D]/g) ?? [];
  const hasDialogue = quoteMatches.length > 0;
  return {
    name: "dialogue_presence",
    passed: true, // Informational — doesn't fail
    detail: hasDialogue ? `Found ${quoteMatches.length} dialogue segment(s).` : "No dialogue found in prose.",
  };
}

// ─── IR Checks ──────────────────────────────────────────

export function checkIRCompleteness(completedSceneIds: string[], sceneIRs: Map<string, NarrativeIR>): CheckResult {
  if (completedSceneIds.length === 0) {
    return { name: "ir_completeness", passed: true, detail: "No completed scenes to check." };
  }

  const missing = completedSceneIds.filter((id) => {
    const ir = sceneIRs.get(id);
    return !ir || !ir.verified;
  });

  if (missing.length === 0) {
    return {
      name: "ir_completeness",
      passed: true,
      detail: `All ${completedSceneIds.length} completed scene(s) have verified IRs.`,
    };
  }

  return {
    name: "ir_completeness",
    passed: false,
    detail: `${missing.length} completed scene(s) missing verified IRs: ${missing.join(", ")}`,
  };
}

export function checkSetupPayoffClosure(allIRs: NarrativeIR[], bible: Bible, finalSceneId: string): CheckResult {
  const flags = checkDanglingSetups(allIRs, bible, finalSceneId);

  if (flags.length === 0) {
    return {
      name: "setup_payoff_closure",
      passed: true,
      detail: "No dangling setups detected at manuscript completion.",
    };
  }

  return {
    name: "setup_payoff_closure",
    passed: false,
    detail: `${flags.length} dangling setup(s): ${flags.map((f) => f.message).join("; ")}`,
  };
}

// ─── Aggregate Runner ───────────────────────────────────

export interface DeterministicCheckInputs {
  prose: string;
  sceneId: string;
  bible: Bible;
  plan: ScenePlan;
  character: CharacterDossier | undefined;
  log: CompilationLog;
  lintResult: LintResult;
  config: CompilationConfig;
  metrics: ProseMetrics;
}

export function runAllDeterministicChecks(inputs: DeterministicCheckInputs): CheckResult[] {
  return [
    checkKillListCompliance(inputs.prose, inputs.bible, inputs.sceneId),
    checkBudgetCompliance(inputs.log, inputs.config),
    checkRing1Cap(inputs.log, inputs.config),
    checkLintCompliance(inputs.lintResult),
    checkSentenceDistribution(inputs.metrics, inputs.character),
    checkProhibitedLanguage(inputs.prose, inputs.character),
    checkStructuralBans(inputs.prose, inputs.bible),
    checkWordCount(inputs.metrics, inputs.plan),
    checkDialoguePresence(inputs.prose),
  ];
}

// ─── Helpers ────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
