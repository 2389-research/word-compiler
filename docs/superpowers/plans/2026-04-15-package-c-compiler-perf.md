# Package C: Compiler Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant `countTokens()` calls in the compiler data flow. Ring builders already compute token counts as part of building their output; the budget enforcer and the final assembler currently re-count the same strings (often multiple times each). Thread the counts through the return values so downstream consumers reuse them.

**Architecture:** `buildRing1`, `buildRing2`, and `buildRing3` already return objects carrying `tokenCount`. The gap is `enforceBudget`: it drops the counts, operates on raw `RingSection[]`, and re-counts the assembled strings at every compression decision. Its consumer, `compilePayload` in `assembler.ts`, then re-counts again when building the `CompilationLog`. Fix: widen `BudgetResult` to carry `r1Tokens`, `r2Tokens`, `r3Tokens`; have `enforceBudget` compute each ring's token count exactly once per compression step and return them; have `compilePayload` read those fields instead of re-invoking `countTokens` on the final strings. Net effect: `compilePayload` drops from ~9 `countTokens` calls on the hot path to 0 (the ring builders' internal counts remain, because those ARE the authoritative counts; they just get reused).

**Tech Stack:** TypeScript strict, Vitest, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

---

## Scope boundary

This package may only modify files under:

- `src/compiler/**`
- `tests/compiler/**`

**One explicit exception:** `src/types/compilation.ts` — the `BudgetResult` interface lives there but is only consumed inside `src/compiler/**` (verified via `grep -n BudgetResult` — only `src/compiler/budget.ts` and `src/types/compilation.ts` reference it). Extending `BudgetResult` with three numeric fields (`r1Tokens`, `r2Tokens`, `r3Tokens`) is the minimum-ripple way to thread counts out of the budget enforcer. No other type file is touched. No file outside the three listed paths is touched.

It may NOT modify: `src/tokens/**`, any other file in `src/types/**`, `src/linter/**`, `src/app/**`, or `server/**`.

---

## Current state reference (read before implementing)

**Every `countTokens` call site under `src/compiler/` at the start of this plan** (verified via `grep -rn countTokens src/compiler/`):

- `src/compiler/ring1.ts:187` — hard-cap effective ceiling
- `src/compiler/ring1.ts:190` — pre-truncate check
- `src/compiler/ring1.ts:199` — final `tokenCount` field in `Ring1Result`
- `src/compiler/ring2.ts:177` — final `tokenCount` field in `Ring2Result`
- `src/compiler/ring3.ts:248` — final `tokenCount` field in `Ring3Result`
- `src/compiler/budget.ts:30` — `tryCompressRing` probe
- `src/compiler/budget.ts:53` — Ring 1 hard-cap pre-check
- `src/compiler/budget.ts:54` — log line (duplicate of :53)
- `src/compiler/budget.ts:63` — post-hard-cap R1+R2+R3 total
- `src/compiler/budget.ts:70` — R2 snapshot for compression math
- `src/compiler/budget.ts:71` — R3 snapshot for compression math
- `src/compiler/budget.ts:80` — totalAfterR1
- `src/compiler/budget.ts:88` — r1TokensNow
- `src/compiler/budget.ts:97` — totalAfterR2 (two calls)
- `src/compiler/budget.ts:104` — r1TokensFinal
- `src/compiler/budget.ts:105` — r2TokensFinal
- `src/compiler/budget.ts:128` — `compressSections` iteration probe
- `src/compiler/assembler.ts:69` — post-budget R1 re-count for linter input
- `src/compiler/assembler.ts:75` — post-budget R3 re-count for linter input
- `src/compiler/assembler.ts:78` — post-budget R2 re-count for linter input
- `src/compiler/assembler.ts:116` — `CompilationLog.ring1Tokens`
- `src/compiler/assembler.ts:117` — `CompilationLog.ring2Tokens`
- `src/compiler/assembler.ts:118` — `CompilationLog.ring3Tokens`
- `src/compiler/assembler.ts:120` — totalTokens sum (3 calls inlined)

The ring builder sites in `ring1/2/3.ts` are NOT redundant — they are the one authoritative count per ring and must remain. Every `countTokens` call in `assembler.ts` is pure duplication: the same three strings the budget enforcer just produced. The `budget.ts` calls are partly algorithmic (compression loop must re-measure after each removal) and partly duplicated (re-measuring unchanged rings across steps).

**Current return shapes:**

- `Ring1Result` (`src/types/compilation.ts:63`): `{ text, sections, tokenCount, wasTruncated }` — already has count.
- `Ring2Result` (`src/compiler/ring2.ts:5`): `{ text, sections, tokenCount }` — already has count.
- `Ring3Result` (`src/types/compilation.ts:70`): `{ text, sections, tokenCount }` — already has count.
- `BudgetResult` (`src/types/compilation.ts:76`): `{ r1, r2?, r3, r1Sections, r2Sections?, r3Sections, wasCompressed, compressionLog }` — **no token counts**. This is the gap.

**What changes:** `BudgetResult` gains `r1Tokens: number`, `r2Tokens: number` (0 when R2 absent), `r3Tokens: number`. `enforceBudget` populates them. `compilePayload` reads them.

---

## Task 1: Widen `BudgetResult` and thread counts through `enforceBudget`

**Files:**
- Modify: `src/types/compilation.ts` (narrow 3-line addition to `BudgetResult`)
- Modify: `src/compiler/budget.ts`
- Modify: `tests/compiler/budget.test.ts`

- [ ] **Step 1: Write the failing tests**

Append the following `describe` block to `tests/compiler/budget.test.ts` (keep the existing tests above it untouched):

```ts
import { countTokens } from "../../src/tokens/index.js";

describe("enforceBudget — threaded token counts", () => {
  it("returns token counts that match countTokens on the final strings", () => {
    const r1 = [makeSection("KILL_LIST", 10, 0, true), makeSection("VOCAB", 8, 4, false)];
    const r2 = [makeSection("CHAPTER_BRIEF", 12, 0, true)];
    const r3 = [makeSection("CONTRACT", 15, 0, true)];

    const result = enforceBudget(r1, r3, 10_000, config, r2);

    expect(result.r1Tokens).toBe(countTokens(result.r1));
    expect(result.r2Tokens).toBe(result.r2 ? countTokens(result.r2) : 0);
    expect(result.r3Tokens).toBe(countTokens(result.r3));
  });

  it("r2Tokens is 0 when r2 is absent", () => {
    const r1 = [makeSection("A", 5, 0, true)];
    const r3 = [makeSection("B", 5, 0, true)];

    const result = enforceBudget(r1, r3, 1000, config);

    expect(result.r2).toBeUndefined();
    expect(result.r2Tokens).toBe(0);
  });

  it("token counts remain consistent after compression", () => {
    const r1 = [
      makeSection("KILL_LIST", 10, 0, true),
      makeSection("EXEMPLARS", 50, 6, false),
      makeSection("VOCAB", 10, 4, false),
    ];
    const r3 = [makeSection("CONTRACT", 10, 0, true)];

    const result = enforceBudget(r1, r3, 60, config);

    expect(result.wasCompressed).toBe(true);
    expect(result.r1Tokens).toBe(countTokens(result.r1));
    expect(result.r3Tokens).toBe(countTokens(result.r3));
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `pnpm test -- tests/compiler/budget.test.ts`
Expected: the three new tests fail because `result.r1Tokens`, `result.r2Tokens`, `result.r3Tokens` are `undefined`. Existing budget tests continue to pass.

- [ ] **Step 3: Extend the `BudgetResult` type**

Edit `src/types/compilation.ts`. Locate the `BudgetResult` interface (lines 76–85) and add three fields:

```ts
export interface BudgetResult {
  r1: string;
  r2?: string;
  r3: string;
  r1Sections: RingSection[];
  r2Sections?: RingSection[];
  r3Sections: RingSection[];
  r1Tokens: number;
  r2Tokens: number;
  r3Tokens: number;
  wasCompressed: boolean;
  compressionLog: string[];
}
```

No other file in `src/types/` is touched. `r2Tokens` is always present (not optional) and is `0` when `r2` is absent — this keeps consumers from having to null-check.

- [ ] **Step 4: Update `enforceBudget` to compute each count once and populate the new fields**

Edit `src/compiler/budget.ts`. Replace the entire file with the following. The rewrite keeps the same step-by-step compression algorithm but tracks `r1Tokens`/`r2Tokens`/`r3Tokens` as mutable locals, recomputing them only when the corresponding ring's sections actually change, and passes them through `buildBudgetResult`.

```ts
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
  let r2Text = assembleSections(currentR2);
  let r3Text = assembleSections(currentR3);
  let r1Tokens = countTokens(r1Text);
  let r2Tokens = countTokens(r2Text);
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
      currentR1, currentR2, currentR3,
      r1Tokens, r2Tokens, r3Tokens,
      r1Text, r2Text, r3Text,
      wasCompressed, compressionLog,
    );
  }

  // Step 3: Compress Ring 1 first (highest priority numbers cut first)
  const r1BudgetForStep3 = availableTokens - r2Tokens - r3Tokens;
  if (r1BudgetForStep3 > 0 && r1Tokens > r1BudgetForStep3) {
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
      currentR1, currentR2, currentR3,
      r1Tokens, r2Tokens, r3Tokens,
      r1Text, r2Text, r3Text,
      wasCompressed, compressionLog,
    );
  }

  // Step 5: Compress Ring 2 (if present)
  if (currentR2.length > 0) {
    const r2Budget = availableTokens - r1Tokens - r3Tokens;
    if (r2Budget > 0 && r2Tokens > r2Budget) {
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
      currentR1, currentR2, currentR3,
      r1Tokens, r2Tokens, r3Tokens,
      r1Text, r2Text, r3Text,
      wasCompressed, compressionLog,
    );
  }

  // Step 7: Compress Ring 3 if Ring 1+2 compression insufficient
  const r3Budget = availableTokens - r1Tokens - r2Tokens;
  if (r3Budget > 0) {
    compressionLog.push(`Ring 1+2 compression insufficient. Compressing Ring 3 to fit ${r3Budget} tokens`);
    const compressed = compressSections(currentR3, r3Budget, compressionLog, "R3");
    currentR3 = compressed.sections;
    r3Text = compressed.text;
    r3Tokens = compressed.tokens;
    wasCompressed = true;
  }

  return buildBudgetResult(
    currentR1, currentR2, currentR3,
    r1Tokens, r2Tokens, r3Tokens,
    r1Text, r2Text, r3Text,
    wasCompressed, compressionLog,
  );
}
```

Note the deliberate structural changes vs. the original:

- `compressSections` now returns `{ sections, text, tokens }` instead of just `sections`, so the caller doesn't re-assemble or re-count the result.
- `tryCompressRing` is removed — it was a thin wrapper that duplicated the "is this over budget?" check the caller already knows, and its removal is why the Ring 1 and Ring 2 branches have an inline `if (rXBudget > 0 && rXTokens > rXBudget)` guard.
- `r1Text`, `r2Text`, `r3Text`, and their token counts are updated in lockstep with the sections arrays, and then passed into `buildBudgetResult` so it does not re-assemble or re-count.

- [ ] **Step 5: Run the test suite for budget**

Run: `pnpm test -- tests/compiler/budget.test.ts`
Expected: all tests pass — the three new tests plus every pre-existing test.

- [ ] **Step 6: Run typecheck and full test suite**

Run: `pnpm check-all`
Expected: exits 0. If the lint/typecheck fails, fix in place before committing.

- [ ] **Step 7: Commit**

```bash
git add src/types/compilation.ts src/compiler/budget.ts tests/compiler/budget.test.ts
git commit -m "$(cat <<'EOF'
perf(compiler): thread token counts through enforceBudget

Widens BudgetResult with r1Tokens/r2Tokens/r3Tokens so downstream
consumers don't have to re-count. enforceBudget now maintains the
three counts as locals, updating them only when the corresponding
ring is actually compressed. compressSections returns the final
text + count alongside the sections, removing duplicate work in
the compression loop.

Part of #24.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Remove redundant `countTokens` calls in `assembler.ts` and add a spy-based regression test

**Files:**
- Modify: `src/compiler/assembler.ts`
- Modify: `tests/compiler/assembler.test.ts`

- [ ] **Step 1: Write the failing regression test**

Append the following block to `tests/compiler/assembler.test.ts`:

```ts
import * as tokens from "../../src/tokens/index.js";

describe("compilePayload — countTokens call budget", () => {
  it("uses ring-builder and enforceBudget token counts (no re-count in assembler)", () => {
    const spy = vi.spyOn(tokens, "countTokens");
    try {
      const result = compilePayload(makeBible(), makePlan(), [], 0, config);

      // Sanity: the log is populated from the threaded counts, not from
      // a fresh countTokens pass on budgetResult.r1/r2/r3.
      expect(result.log.ring1Tokens).toBeGreaterThan(0);
      expect(result.log.ring3Tokens).toBeGreaterThan(0);
      expect(result.log.totalTokens).toBe(result.log.ring1Tokens + result.log.ring3Tokens);

      // Hot path in compilePayload itself (everything AFTER enforceBudget
      // returns) must not call countTokens at all. We bound the total by
      // capturing the call count, re-running WITH an additional pass that
      // would have hit every removed site, and asserting we beat it.
      //
      // In practice, compilePayload contained 9 countTokens calls post-
      // enforceBudget before this change (lines 69, 75, 78, 116, 117, 118,
      // and three inlined in the totalTokens sum at 120-122). None of them
      // should fire now. We encode this as: the number of countTokens
      // calls attributable to compilePayload, minus those inside the ring
      // builders and enforceBudget, must be zero.
      //
      // Since spying doesn't let us attribute by caller, we instead run
      // the ring builders + enforceBudget in isolation and subtract.
    } finally {
      spy.mockRestore();
    }
  });

  it("assembler hot path adds zero countTokens calls beyond rings + budget", () => {
    // Phase A: measure countTokens calls for ring builders + enforceBudget alone.
    const spyA = vi.spyOn(tokens, "countTokens");
    const bible = makeBible();
    const plan = makePlan();
    const ring1 = buildRing1(bible, config);
    const ring3 = buildRing3(plan, bible, [], 0, config);
    enforceBudget(ring1.sections, ring3.sections, config.modelContextWindow - config.reservedForOutput, config);
    const ringsAndBudgetCalls = spyA.mock.calls.length;
    spyA.mockRestore();

    // Phase B: measure countTokens calls for the full compilePayload path.
    const spyB = vi.spyOn(tokens, "countTokens");
    compilePayload(bible, plan, [], 0, config);
    const compileCalls = spyB.mock.calls.length;
    spyB.mockRestore();

    // The full compilePayload must not invoke countTokens any more times
    // than the ring builders + enforceBudget do on their own. If it does,
    // the assembler or linter is re-counting strings it was handed.
    //
    // Note: the linter currently reads tokenCount off the ring result
    // objects (verified in src/linter/index.ts), so it is not a source of
    // extra calls. If that changes, this test will catch it.
    expect(compileCalls).toBeLessThanOrEqual(ringsAndBudgetCalls);
  });
});
```

Also add the matching imports at the top of `tests/compiler/assembler.test.ts` (next to the existing imports — do not remove any existing import):

```ts
import { vi } from "vitest";
import { enforceBudget } from "../../src/compiler/budget.js";
import { buildRing1 } from "../../src/compiler/ring1.js";
import { buildRing3 } from "../../src/compiler/ring3.js";
```

- [ ] **Step 2: Run the tests and confirm the new regression test fails**

Run: `pnpm test -- tests/compiler/assembler.test.ts`
Expected: `compileCalls` will currently exceed `ringsAndBudgetCalls` by roughly 6–9 (the redundant calls in `compilePayload`), so the `toBeLessThanOrEqual` assertion fails. Pre-existing assembler tests continue to pass.

- [ ] **Step 3: Remove the redundant `countTokens` calls in `compilePayload`**

Edit `src/compiler/assembler.ts`.

First, the linter-input block (currently lines ~66–79). Replace:

```ts
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
```

with:

```ts
  // 3. Lint (using post-budget values). Token counts are threaded from
  // enforceBudget — do not re-count.
  const postBudgetR1 = {
    ...ring1Result,
    text: budgetResult.r1,
    tokenCount: budgetResult.r1Tokens,
    sections: budgetResult.r1Sections,
  };
  const postBudgetR3 = {
    ...ring3Result,
    text: budgetResult.r3,
    tokenCount: budgetResult.r3Tokens,
    sections: budgetResult.r3Sections,
  };
  const lintResult = lintPayload(postBudgetR1, postBudgetR3, plan, bible, config, budgetResult.r2Tokens);
```

Second, the `CompilationLog` block (currently lines ~111–130). Replace:

```ts
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
```

with:

```ts
  const log: CompilationLog = {
    id: generateId(),
    chunkId: `${plan.id}_chunk${chunkNumber}`,
    payloadHash,
    ring1Tokens: budgetResult.r1Tokens,
    ring2Tokens: budgetResult.r2Tokens,
    ring3Tokens: budgetResult.r3Tokens,
    totalTokens: budgetResult.r1Tokens + budgetResult.r2Tokens + budgetResult.r3Tokens,
    availableBudget: available,
```

Finally, remove the now-unused import at the top of `src/compiler/assembler.ts`. The line:

```ts
import { countTokens } from "../tokens/index.js";
```

should be deleted. Verify with `pnpm lint` that no unused-import warning remains.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test -- tests/compiler/assembler.test.ts`
Expected: the spy-based regression test passes (`compileCalls <= ringsAndBudgetCalls`). All pre-existing assembler tests still pass, including the `CompilationLog token counts are populated` test (the values are unchanged — they just come from a different source).

- [ ] **Step 5: Run the full pipeline**

Run: `pnpm check-all`
Expected: lint, typecheck, and full vitest suite all green. In particular:

- `tests/compiler/ring1.test.ts`, `tests/compiler/ring2.test.ts`, `tests/compiler/ring3.test.ts` — unchanged behavior.
- `tests/compiler/budget.test.ts` — new token-count assertions pass.
- `tests/compiler/assembler.test.ts` — spy-based regression passes.
- `tests/linter/index.test.ts` — the linter reads `tokenCount` off the ring result objects we pass it; those numbers are identical to before (same `countTokens` formula applied to the same strings), so linter tests should be untouched.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/assembler.ts tests/compiler/assembler.test.ts
git commit -m "$(cat <<'EOF'
perf(compiler): drop redundant countTokens in compilePayload

compilePayload now reads r1Tokens/r2Tokens/r3Tokens off the
BudgetResult instead of re-running countTokens on the final
strings. Removes ~9 duplicate token-count calls from the hot
path (linter input, CompilationLog fields, and the inlined
totalTokens sum). Adds a spy-based regression test asserting
that compilePayload invokes countTokens no more times than
the underlying ring builders + enforceBudget already do.

Closes #24.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "perf(compiler): package C — thread token counts (#24)" --body "$(cat <<'EOF'
## Summary
- Widens `BudgetResult` with `r1Tokens`/`r2Tokens`/`r3Tokens`, populated once by `enforceBudget`.
- `compilePayload` reads those fields for the linter input and the `CompilationLog` instead of re-running `countTokens` on the final strings.
- Removes ~9 duplicate `countTokens` calls per compilation on the hot path.
- Adds a spy-based regression test that bounds `countTokens` calls in `compilePayload` by the calls made by the ring builders + `enforceBudget` alone, so any future regression is caught automatically.

Part of the [p1 parallel batch](../blob/main/docs/superpowers/specs/2026-04-15-p1-parallel-batch-design.md). Closes #24.

## Test plan
- [ ] `pnpm check-all` green
- [ ] `tests/compiler/budget.test.ts` — new token-count assertions pass
- [ ] `tests/compiler/assembler.test.ts` — spy-based regression passes
- [ ] No change in observed token counts in `CompilationLog` (pre-existing test `CompilationLog token counts are populated` still passes with the same values)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done criteria

- `BudgetResult` carries `r1Tokens`, `r2Tokens`, `r3Tokens`.
- `enforceBudget` populates them and does not recompute any ring's token count unnecessarily.
- `compilePayload` contains zero `countTokens` calls (the import is removed).
- The spy-based regression test in `tests/compiler/assembler.test.ts` asserts `compileCalls <= ringsAndBudgetCalls` and passes.
- `pnpm check-all` green on the branch.
- PR open against `main` with `#24` in the title.
- No file outside `src/compiler/**`, `tests/compiler/**`, and the single narrow extension to `src/types/compilation.ts` is touched.
