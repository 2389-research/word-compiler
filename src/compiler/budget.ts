import type { RingSection, CompilationConfig, BudgetResult } from "../types/index.js";
import { countTokens, truncateToTokens } from "../tokens/index.js";
import { assembleSections } from "./helpers.js";

export function enforceBudget(
  r1Sections: RingSection[],
  r3Sections: RingSection[],
  availableTokens: number,
  config: CompilationConfig,
): BudgetResult {
  let currentR1 = [...r1Sections];
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

  // Step 2: Check total
  const r1Final = assembleSections(currentR1);
  const r3Final = assembleSections(currentR3);
  const total = countTokens(r1Final) + countTokens(r3Final);

  if (total <= availableTokens) {
    return {
      r1: r1Final,
      r3: r3Final,
      r1Sections: currentR1,
      r3Sections: currentR3,
      wasCompressed,
      compressionLog,
    };
  }

  // Step 3: Compress Ring 1 first
  const r3Tokens = countTokens(r3Final);
  const r1Budget = availableTokens - r3Tokens;

  if (r1Budget > 0 && countTokens(r1Final) > r1Budget) {
    compressionLog.push(`Total over budget. Compressing Ring 1 to fit ${r1Budget} tokens`);
    currentR1 = compressSections(currentR1, r1Budget, compressionLog, "R1");
    wasCompressed = true;
  }

  // Step 4: Re-check after Ring 1 compression
  const r1After = assembleSections(currentR1);
  const totalAfterR1 = countTokens(r1After) + r3Tokens;

  if (totalAfterR1 <= availableTokens) {
    return {
      r1: r1After,
      r3: r3Final,
      r1Sections: currentR1,
      r3Sections: currentR3,
      wasCompressed,
      compressionLog,
    };
  }

  // Step 5: Compress Ring 3 if Ring 1 compression insufficient
  const r1TokensNow = countTokens(r1After);
  const r3Budget = availableTokens - r1TokensNow;

  if (r3Budget > 0) {
    compressionLog.push(`Ring 1 compression insufficient. Compressing Ring 3 to fit ${r3Budget} tokens`);
    currentR3 = compressSections(currentR3, r3Budget, compressionLog, "R3");
    wasCompressed = true;
  }

  return {
    r1: assembleSections(currentR1),
    r3: assembleSections(currentR3),
    r1Sections: currentR1,
    r3Sections: currentR3,
    wasCompressed,
    compressionLog,
  };
}

/**
 * Remove non-immune sections by priority (highest priority number = cut first)
 * until totalTokens fits within budget.
 */
function compressSections(
  sections: RingSection[],
  budget: number,
  log: string[],
  ringLabel: string,
): RingSection[] {
  let current = [...sections];

  // Sort removable sections by priority descending (cut highest first)
  const removable = current
    .filter((s) => !s.immune)
    .sort((a, b) => b.priority - a.priority);

  for (const section of removable) {
    if (countTokens(assembleSections(current)) <= budget) break;

    current = current.filter((s) => s !== section);
    log.push(`${ringLabel}: Removed ${section.name} (priority ${section.priority})`);
  }

  return current;
}
