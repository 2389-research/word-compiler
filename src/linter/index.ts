import type {
  Ring1Result,
  Ring3Result,
  ScenePlan,
  Bible,
  CompilationConfig,
  LintIssue,
  LintResult,
} from "../types/index.js";
import { countTokens } from "../tokens/index.js";

export function lintPayload(
  ring1: Ring1Result,
  ring3: Ring3Result,
  plan: ScenePlan,
  bible: Bible,
  config: CompilationConfig,
): LintResult {
  const issues: LintIssue[] = [];

  // R1_OVER_CAP
  if (ring1.tokenCount > config.ring1HardCap) {
    issues.push({
      code: "R1_OVER_CAP",
      severity: "error",
      message: `Ring 1 at ${ring1.tokenCount} tokens (cap: ${config.ring1HardCap}). Remove exemplars or vocabulary preferences.`,
    });
  }

  // R3_STARVED — check Ring 3's share of actually-used tokens, not the full window
  const available = config.modelContextWindow - config.reservedForOutput;
  const totalUsed = ring1.tokenCount + ring3.tokenCount;
  const r3Fraction = totalUsed > 0 ? ring3.tokenCount / totalUsed : 1;
  if (r3Fraction < 0.4) {
    issues.push({
      code: "R3_STARVED",
      severity: "warning",
      message: `Ring 3 only ${(r3Fraction * 100).toFixed(0)}% of used context (${ring3.tokenCount}/${totalUsed} tokens). Ring 1 may be too large.`,
    });
  }

  // NEG_EXEMPLAR_LONG
  for (const exemplar of bible.styleGuide.negativeExemplars) {
    if (countTokens(exemplar.text) > config.maxNegativeExemplarTokens) {
      issues.push({
        code: "NEG_EXEMPLAR_LONG",
        severity: "warning",
        message: `Negative exemplar "${exemplar.text.slice(0, 40)}..." exceeds ${config.maxNegativeExemplarTokens} token cap. Shorten or convert to structural ban.`,
      });
    }
  }

  // MISSING_VOICE_SAMPLES
  const speakingCharIds = Object.keys(plan.dialogueConstraints);
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

  // MISSING_SUBTEXT
  if (speakingCharIds.length >= 2 && !plan.subtext) {
    issues.push({
      code: "MISSING_SUBTEXT",
      severity: "warning",
      message: `Multi-character dialogue scene has no subtext contract. High ablation risk.`,
    });
  }

  // NO_FAILURE_MODE
  if (!plan.failureModeToAvoid) {
    issues.push({
      code: "NO_FAILURE_MODE",
      severity: "warning",
      message: `No failure mode specified. The compiler can't protect against unknown risks.`,
    });
  }

  // POV_CHAR_MISSING
  const povChar = bible.characters.find((c) => c.id === plan.povCharacterId);
  if (!povChar) {
    issues.push({
      code: "POV_CHAR_MISSING",
      severity: "error",
      message: `POV character "${plan.povCharacterId}" not found in bible.`,
    });
  }

  // EMPTY_KILL_LIST
  if (bible.styleGuide.killList.length === 0) {
    issues.push({
      code: "EMPTY_KILL_LIST",
      severity: "info",
      message: `No kill list entries. Consider adding banned phrases for voice consistency.`,
    });
  }

  // NO_ANCHOR_LINES
  if (plan.anchorLines.length === 0) {
    issues.push({
      code: "NO_ANCHOR_LINES",
      severity: "info",
      message: `No anchor lines. Human-authored lines are the strongest voice signal.`,
    });
  }

  // MISSING_LOCATION
  if (plan.locationId) {
    const loc = bible.locations.find((l) => l.id === plan.locationId);
    if (!loc) {
      issues.push({
        code: "MISSING_LOCATION",
        severity: "info",
        message: `Location "${plan.locationId}" not found in bible. Sensory palette will be absent.`,
      });
    }
  }

  // TOTAL_OVER_BUDGET
  const totalTokens = ring1.tokenCount + ring3.tokenCount;
  if (totalTokens > available) {
    issues.push({
      code: "TOTAL_OVER_BUDGET",
      severity: "error",
      message: `Total tokens ${totalTokens} exceeds available budget ${available}.`,
    });
  }

  return { issues };
}
