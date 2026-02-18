import type { RingSection, CompilationConfig, BudgetResult } from "../types/index.js";
import { countTokens } from "../tokens/index.js";
import { assembleSections } from "./helpers.js";

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
    return {
      r1: r1Final,
      r2: r2Final || undefined,
      r3: r3Final,
      r1Sections: currentR1,
      r2Sections: currentR2.length > 0 ? currentR2 : undefined,
      r3Sections: currentR3,
      wasCompressed,
      compressionLog,
    };
  }

  // Step 3: Compress Ring 1 first (highest priority numbers cut first)
  const r2Tokens = countTokens(r2Final);
  const r3Tokens = countTokens(r3Final);
  const r1Budget = availableTokens - r2Tokens - r3Tokens;

  if (r1Budget > 0 && countTokens(r1Final) > r1Budget) {
    compressionLog.push(`Total over budget. Compressing Ring 1 to fit ${r1Budget} tokens`);
    currentR1 = compressSections(currentR1, r1Budget, compressionLog, "R1");
    wasCompressed = true;
  }

  // Step 4: Re-check after Ring 1 compression
  const r1After = assembleSections(currentR1);
  const totalAfterR1 = countTokens(r1After) + r2Tokens + r3Tokens;

  if (totalAfterR1 <= availableTokens) {
    return {
      r1: r1After,
      r2: r2Final || undefined,
      r3: r3Final,
      r1Sections: currentR1,
      r2Sections: currentR2.length > 0 ? currentR2 : undefined,
      r3Sections: currentR3,
      wasCompressed,
      compressionLog,
    };
  }

  // Step 5: Compress Ring 2 (if present)
  if (currentR2.length > 0) {
    const r1TokensNow = countTokens(r1After);
    const r2Budget = availableTokens - r1TokensNow - r3Tokens;
    if (r2Budget > 0 && r2Tokens > r2Budget) {
      compressionLog.push(`Ring 1 compression insufficient. Compressing Ring 2 to fit ${r2Budget} tokens`);
      currentR2 = compressSections(currentR2, r2Budget, compressionLog, "R2");
      wasCompressed = true;
    }
  }

  // Step 6: Re-check after Ring 2 compression
  const r2After = assembleSections(currentR2);
  const totalAfterR2 = countTokens(r1After) + countTokens(r2After) + r3Tokens;

  if (totalAfterR2 <= availableTokens) {
    return {
      r1: r1After,
      r2: r2After || undefined,
      r3: r3Final,
      r1Sections: currentR1,
      r2Sections: currentR2.length > 0 ? currentR2 : undefined,
      r3Sections: currentR3,
      wasCompressed,
      compressionLog,
    };
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

  return {
    r1: assembleSections(currentR1),
    r2: assembleSections(currentR2) || undefined,
    r3: assembleSections(currentR3),
    r1Sections: currentR1,
    r2Sections: currentR2.length > 0 ? currentR2 : undefined,
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
