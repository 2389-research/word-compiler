import { countTokens } from "../tokens/index.js";
import type {
  Bible,
  CompilationConfig,
  LintIssue,
  LintResult,
  Ring1Result,
  Ring3Result,
  ScenePlan,
} from "../types/index.js";

function checkR1OverCap(ring1: Ring1Result, config: CompilationConfig): LintIssue | null {
  if (ring1.tokenCount > config.ring1HardCap) {
    return {
      code: "R1_OVER_CAP",
      severity: "error",
      message: `Ring 1 at ${ring1.tokenCount} tokens (cap: ${config.ring1HardCap}). Remove exemplars or vocabulary preferences.`,
    };
  }
  return null;
}

function checkR2OverCap(ring2TokenCount: number, config: CompilationConfig): LintIssue | null {
  if (ring2TokenCount > 0) {
    const available = config.modelContextWindow - config.reservedForOutput;
    const r2Cap = Math.floor(available * config.ring2MaxFraction);
    if (ring2TokenCount > r2Cap) {
      return {
        code: "R2_OVER_CAP",
        severity: "warning",
        message: `Ring 2 at ${ring2TokenCount} tokens (cap: ${r2Cap}). Chapter context may be too verbose.`,
      };
    }
  }
  return null;
}

function checkR3Starved(ring1: Ring1Result, ring3: Ring3Result, ring2TokenCount: number): LintIssue | null {
  const totalUsed = ring1.tokenCount + ring2TokenCount + ring3.tokenCount;
  const r3Fraction = totalUsed > 0 ? ring3.tokenCount / totalUsed : 1;
  // Warn at 40% — softer than config's ring3MinFraction (60%) target.
  // The budget enforcer handles the hard guarantee; this lint catches critical starvation.
  if (r3Fraction < 0.4) {
    return {
      code: "R3_STARVED",
      severity: "warning",
      message: `Ring 3 only ${(r3Fraction * 100).toFixed(0)}% of used context (${ring3.tokenCount}/${totalUsed} tokens). Ring 1 may be too large.`,
    };
  }
  return null;
}

function checkNegExemplarLong(bible: Bible, config: CompilationConfig): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const exemplar of bible.styleGuide.negativeExemplars) {
    if (countTokens(exemplar.text) > config.maxNegativeExemplarTokens) {
      issues.push({
        code: "NEG_EXEMPLAR_LONG",
        severity: "warning",
        message: `Negative exemplar "${exemplar.text.slice(0, 40)}..." exceeds ${config.maxNegativeExemplarTokens} token cap. Shorten or convert to structural ban.`,
      });
    }
  }
  return issues;
}

function checkMissingVoiceSamples(speakingCharIds: string[], bible: Bible): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const charId of speakingCharIds) {
    const char = bible.characters.find((c) => c.id === charId);
    if (!char || char.voice.dialogueSamples.length === 0) {
      issues.push({
        code: "MISSING_VOICE_SAMPLES",
        severity: "warning",
        message: `Character ${charId} speaks in this scene but has no dialogue samples. Voice will drift toward generic.`,
      });
    }
  }
  return issues;
}

function checkMissingSubtext(speakingCharIds: string[], plan: ScenePlan): LintIssue | null {
  if (speakingCharIds.length >= 2 && !plan.subtext) {
    return {
      code: "MISSING_SUBTEXT",
      severity: "warning",
      message: `Multi-character dialogue scene has no subtext contract. High ablation risk.`,
    };
  }
  return null;
}

function checkNoFailureMode(plan: ScenePlan): LintIssue | null {
  if (!plan.failureModeToAvoid) {
    return {
      code: "NO_FAILURE_MODE",
      severity: "warning",
      message: `No failure mode specified. The compiler can't protect against unknown risks.`,
    };
  }
  return null;
}

function checkPovCharMissing(plan: ScenePlan, bible: Bible): LintIssue | null {
  const povChar = bible.characters.find((c) => c.id === plan.povCharacterId);
  if (!povChar) {
    return {
      code: "POV_CHAR_MISSING",
      severity: "error",
      message: `POV character "${plan.povCharacterId}" not found in bible.`,
    };
  }
  return null;
}

function checkEmptyKillList(bible: Bible): LintIssue | null {
  if (bible.styleGuide.killList.length === 0) {
    return {
      code: "EMPTY_KILL_LIST",
      severity: "info",
      message: `No avoid list entries. Consider adding banned phrases for voice consistency.`,
    };
  }
  return null;
}

function checkNoAnchorLines(plan: ScenePlan): LintIssue | null {
  if (plan.anchorLines.length === 0) {
    return {
      code: "NO_ANCHOR_LINES",
      severity: "info",
      message: `No anchor lines. Human-authored lines are the strongest voice signal.`,
    };
  }
  return null;
}

function checkMissingLocation(plan: ScenePlan, bible: Bible): LintIssue | null {
  if (plan.locationId) {
    const loc = bible.locations.find((l) => l.id === plan.locationId);
    if (!loc) {
      return {
        code: "MISSING_LOCATION",
        severity: "info",
        message: `Location "${plan.locationId}" not found in bible. Sensory palette will be absent.`,
      };
    }
  }
  return null;
}

function checkTotalOverBudget(
  ring1: Ring1Result,
  ring3: Ring3Result,
  config: CompilationConfig,
  ring2TokenCount: number,
): LintIssue | null {
  const available = config.modelContextWindow - config.reservedForOutput;
  const totalTokens = ring1.tokenCount + ring2TokenCount + ring3.tokenCount;
  if (totalTokens > available) {
    return {
      code: "TOTAL_OVER_BUDGET",
      severity: "error",
      message: `Total tokens ${totalTokens} exceeds available budget ${available}.`,
    };
  }
  return null;
}

export function lintPayload(
  ring1: Ring1Result,
  ring3: Ring3Result,
  plan: ScenePlan,
  bible: Bible,
  config: CompilationConfig,
  ring2TokenCount: number = 0,
): LintResult {
  const speakingCharIds = Object.keys(plan.dialogueConstraints);

  const issues: LintIssue[] = [
    checkR1OverCap(ring1, config),
    checkR2OverCap(ring2TokenCount, config),
    checkR3Starved(ring1, ring3, ring2TokenCount),
    ...checkNegExemplarLong(bible, config),
    ...checkMissingVoiceSamples(speakingCharIds, bible),
    checkMissingSubtext(speakingCharIds, plan),
    checkNoFailureMode(plan),
    checkPovCharMissing(plan, bible),
    checkEmptyKillList(bible),
    checkNoAnchorLines(plan),
    checkMissingLocation(plan, bible),
    checkTotalOverBudget(ring1, ring3, config, ring2TokenCount),
  ].filter((issue): issue is LintIssue => issue !== null);

  return { issues };
}
