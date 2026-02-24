import { countTokens } from "../tokens/index.js";
import type { BudgetResult, CompilationConfig, RingSection } from "../types/index.js";
import { assembleSections } from "./helpers.js";

function buildBudgetResult(
  r1Sections: RingSection[],
  r2Sections: RingSection[],
  r3Sections: RingSection[],
  wasCompressed: boolean,
  compressionLog: string[],
): BudgetResult {
  return {
    r1: assembleSections(r1Sections),
    r2: assembleSections(r2Sections) || undefined,
    r3: assembleSections(r3Sections),
    r1Sections,
    r2Sections: r2Sections.length > 0 ? r2Sections : undefined,
    r3Sections,
    wasCompressed,
    compressionLog,
  };
}

function tryCompressRing(
  sections: RingSection[],
  budget: number,
  compressionLog: string[],
  ringLabel: string,
): { sections: RingSection[]; compressed: boolean } {
  const currentTokens = countTokens(assembleSections(sections));
  if (budget > 0 && currentTokens > budget) {
    compressionLog.push(`Compressing ${ringLabel} to fit ${budget} tokens`);
    return { sections: compressSections(sections, budget, compressionLog, ringLabel), compressed: true };
  }
  return { sections, compressed: false };
}

export function enforceBudget(
  r1Sections: RingSection[],
  r3Sections: RingSection[],
  availableTokens: number,
  config: CompilationConfig,
  r2Sections?: RingSection[],
): BudgetResult {
  let currentR1 = [...r1Sections];
  let currentR2 = r2Sections ? [...r2Sections] : [];
  let currentR3 = [...r3Sections];
  const compressionLog: string[] = [];
  let wasCompressed = false;

  // Step 1: Ring 1 hard cap
  const r1Text = assembleSections(currentR1);
  if (countTokens(r1Text) > config.ring1HardCap) {
    compressionLog.push(`Ring 1 exceeds hard cap (${countTokens(r1Text)} > ${config.ring1HardCap})`);
    currentR1 = compressSections(currentR1, config.ring1HardCap, compressionLog, "R1");
    wasCompressed = true;
  }

  // Step 2: Check total (R1 + R2 + R3)
  const r1Final = assembleSections(currentR1);
  const r2Final = assembleSections(currentR2);
  const r3Final = assembleSections(currentR3);
  const total = countTokens(r1Final) + countTokens(r2Final) + countTokens(r3Final);

  if (total <= availableTokens) {
    return buildBudgetResult(currentR1, currentR2, currentR3, wasCompressed, compressionLog);
  }

  // Step 3: Compress Ring 1 first (highest priority numbers cut first)
  const r2Tokens = countTokens(r2Final);
  const r3Tokens = countTokens(r3Final);
  const r1Budget = availableTokens - r2Tokens - r3Tokens;

  const r1Compress = tryCompressRing(currentR1, r1Budget, compressionLog, "R1");
  currentR1 = r1Compress.sections;
  wasCompressed = wasCompressed || r1Compress.compressed;

  // Step 4: Re-check after Ring 1 compression
  const r1After = assembleSections(currentR1);
  const totalAfterR1 = countTokens(r1After) + r2Tokens + r3Tokens;

  if (totalAfterR1 <= availableTokens) {
    return buildBudgetResult(currentR1, currentR2, currentR3, wasCompressed, compressionLog);
  }

  // Step 5: Compress Ring 2 (if present)
  if (currentR2.length > 0) {
    const r1TokensNow = countTokens(r1After);
    const r2Budget = availableTokens - r1TokensNow - r3Tokens;
    const r2Compress = tryCompressRing(currentR2, r2Budget, compressionLog, "R2");
    currentR2 = r2Compress.sections;
    wasCompressed = wasCompressed || r2Compress.compressed;
  }

  // Step 6: Re-check after Ring 2 compression
  const r2After = assembleSections(currentR2);
  const totalAfterR2 = countTokens(r1After) + countTokens(r2After) + r3Tokens;

  if (totalAfterR2 <= availableTokens) {
    return buildBudgetResult(currentR1, currentR2, currentR3, wasCompressed, compressionLog);
  }

  // Step 7: Compress Ring 3 if Ring 1+2 compression insufficient
  const r1TokensFinal = countTokens(r1After);
  const r2TokensFinal = countTokens(r2After);
  const r3Budget = availableTokens - r1TokensFinal - r2TokensFinal;

  if (r3Budget > 0) {
    compressionLog.push(`Ring 1+2 compression insufficient. Compressing Ring 3 to fit ${r3Budget} tokens`);
    currentR3 = compressSections(currentR3, r3Budget, compressionLog, "R3");
    wasCompressed = true;
  }

  return buildBudgetResult(currentR1, currentR2, currentR3, wasCompressed, compressionLog);
}

/**
 * Remove non-immune sections by priority (highest priority number = cut first)
 * until totalTokens fits within budget.
 */
function compressSections(sections: RingSection[], budget: number, log: string[], ringLabel: string): RingSection[] {
  let current = [...sections];

  // Sort removable sections by priority descending (cut highest first)
  const removable = current.filter((s) => !s.immune).sort((a, b) => b.priority - a.priority);

  for (const section of removable) {
    if (countTokens(assembleSections(current)) <= budget) break;

    current = current.filter((s) => s !== section);
    log.push(`${ringLabel}: Removed ${section.name} (priority ${section.priority})`);
  }

  return current;
}
