import { countTokens } from "../tokens/index.js";
import type { BudgetResult, CompilationConfig, RingSection } from "../types/index.js";
import { assembleSections } from "./helpers.js";

function buildBudgetResult(
  r1Sections: RingSection[],
  r2Sections: RingSection[],
  r3Sections: RingSection[],
  r1Tokens: number,
  r2Tokens: number,
  r3Tokens: number,
  r1Text: string,
  r2Text: string,
  r3Text: string,
  wasCompressed: boolean,
  compressionLog: string[],
): BudgetResult {
  return {
    r1: r1Text,
    r2: r2Sections.length > 0 ? r2Text : undefined,
    r3: r3Text,
    r1Sections,
    r2Sections: r2Sections.length > 0 ? r2Sections : undefined,
    r3Sections,
    r1Tokens,
    r2Tokens: r2Sections.length > 0 ? r2Tokens : 0,
    r3Tokens,
    wasCompressed,
    compressionLog,
  };
}

/**
 * Compress a ring to fit within `budget` tokens by removing non-immune
 * sections in priority order (highest priority number cut first). Returns
 * the trimmed section list AND the final assembled text + token count so
 * callers don't have to re-count.
 */
function compressSections(
  sections: RingSection[],
  budget: number,
  log: string[],
  ringLabel: string,
): { sections: RingSection[]; text: string; tokens: number } {
  let current = [...sections];
  let currentText = assembleSections(current);
  let currentTokens = countTokens(currentText);

  const removable = current.filter((s) => !s.immune).sort((a, b) => b.priority - a.priority);

  for (const section of removable) {
    if (currentTokens <= budget) break;
    current = current.filter((s) => s !== section);
    currentText = assembleSections(current);
    currentTokens = countTokens(currentText);
    log.push(`${ringLabel}: Removed ${section.name} (priority ${section.priority})`);
  }

  return { sections: current, text: currentText, tokens: currentTokens };
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

  // Initial assemble-and-count, once per ring.
  let r1Text = assembleSections(currentR1);
  let r2Text = currentR2.length > 0 ? assembleSections(currentR2) : "";
  let r3Text = assembleSections(currentR3);
  let r1Tokens = countTokens(r1Text);
  let r2Tokens = currentR2.length > 0 ? countTokens(r2Text) : 0;
  let r3Tokens = countTokens(r3Text);

  // Step 1: Ring 1 hard cap
  if (r1Tokens > config.ring1HardCap) {
    compressionLog.push(`Ring 1 exceeds hard cap (${r1Tokens} > ${config.ring1HardCap})`);
    const compressed = compressSections(currentR1, config.ring1HardCap, compressionLog, "R1");
    currentR1 = compressed.sections;
    r1Text = compressed.text;
    r1Tokens = compressed.tokens;
    wasCompressed = true;
  }

  // Step 2: Check total (R1 + R2 + R3)
  if (r1Tokens + r2Tokens + r3Tokens <= availableTokens) {
    return buildBudgetResult(
      currentR1,
      currentR2,
      currentR3,
      r1Tokens,
      r2Tokens,
      r3Tokens,
      r1Text,
      r2Text,
      r3Text,
      wasCompressed,
      compressionLog,
    );
  }

  // Step 3: Compress Ring 1 first (highest priority numbers cut first)
  const r1BudgetForStep3 = Math.max(0, availableTokens - r2Tokens - r3Tokens);
  if (r1Tokens > r1BudgetForStep3) {
    compressionLog.push(`Compressing R1 to fit ${r1BudgetForStep3} tokens`);
    const compressed = compressSections(currentR1, r1BudgetForStep3, compressionLog, "R1");
    currentR1 = compressed.sections;
    r1Text = compressed.text;
    r1Tokens = compressed.tokens;
    wasCompressed = true;
  }

  // Step 4: Re-check after Ring 1 compression
  if (r1Tokens + r2Tokens + r3Tokens <= availableTokens) {
    return buildBudgetResult(
      currentR1,
      currentR2,
      currentR3,
      r1Tokens,
      r2Tokens,
      r3Tokens,
      r1Text,
      r2Text,
      r3Text,
      wasCompressed,
      compressionLog,
    );
  }

  // Step 5: Compress Ring 2 (if present)
  if (currentR2.length > 0) {
    const r2Budget = Math.max(0, availableTokens - r1Tokens - r3Tokens);
    if (r2Tokens > r2Budget) {
      compressionLog.push(`Compressing R2 to fit ${r2Budget} tokens`);
      const compressed = compressSections(currentR2, r2Budget, compressionLog, "R2");
      currentR2 = compressed.sections;
      r2Text = compressed.text;
      r2Tokens = compressed.tokens;
      wasCompressed = true;
    }
  }

  // Step 6: Re-check after Ring 2 compression
  if (r1Tokens + r2Tokens + r3Tokens <= availableTokens) {
    return buildBudgetResult(
      currentR1,
      currentR2,
      currentR3,
      r1Tokens,
      r2Tokens,
      r3Tokens,
      r1Text,
      r2Text,
      r3Text,
      wasCompressed,
      compressionLog,
    );
  }

  // Step 7: Compress Ring 3 if Ring 1+2 compression insufficient
  const r3Budget = Math.max(0, availableTokens - r1Tokens - r2Tokens);
  if (r3Tokens > r3Budget) {
    compressionLog.push(`Ring 1+2 compression insufficient. Compressing Ring 3 to fit ${r3Budget} tokens`);
    const compressed = compressSections(currentR3, r3Budget, compressionLog, "R3");
    currentR3 = compressed.sections;
    r3Text = compressed.text;
    r3Tokens = compressed.tokens;
    wasCompressed = true;
  }

  return buildBudgetResult(
    currentR1,
    currentR2,
    currentR3,
    r1Tokens,
    r2Tokens,
    r3Tokens,
    r1Text,
    r2Text,
    r3Text,
    wasCompressed,
    compressionLog,
  );
}
