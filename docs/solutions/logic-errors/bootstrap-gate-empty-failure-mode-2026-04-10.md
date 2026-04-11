---
title: "Bootstrap creates section plans with empty failureModeToAvoid, blocking generation"
date: 2026-04-10
category: logic-errors
module: bootstrap
problem_type: logic_error
component: tooling
symptoms:
  - "Hard gate error 'Failure mode to avoid is required' blocks generation in Draft stage"
  - "All auto-created section plans have empty failureModeToAvoid after bootstrap"
  - "Linter warns NO_FAILURE_MODE for every section"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: high
tags:
  - bootstrap
  - gates
  - scene-plans
  - failure-mode
  - essay-adaptation
---

# Bootstrap creates section plans with empty failureModeToAvoid, blocking generation

## Problem

After bootstrapping an essay, navigating to the Draft stage and attempting to generate prose fails with a hard gate error: "Failure mode to avoid is required." Every section plan created by `bootstrapToScenePlans()` has an empty `failureModeToAvoid` field, making generation impossible without manually editing each section.

## Symptoms

- Gate error "Failure mode to avoid is required" on every section in Draft stage
- Linter warning `NO_FAILURE_MODE` for all auto-created sections
- Bootstrap flow appears to complete successfully (no errors during bootstrap)
- User must manually fill `failureModeToAvoid` for each section before generating

## What Didn't Work

- **Softening the gate**: Considered making `failureModeToAvoid` optional in `checkScenePlanGate`. Rejected because the gate exists for good reason: the compiler uses failure mode to prevent bad output (anti-ablation). Fix the data, not the gate.
- **Setting a generic default like "Avoid bad writing"**: Too vague to be useful. The failure mode needs to be specific to each section's purpose to guide the compiler effectively.

## Solution

In `src/bootstrap/index.ts`, `bootstrapToScenePlans()` now derives `failureModeToAvoid` from each section's `purpose` field:

```typescript
// Before (broken):
plan.narrativeGoal = section.purpose;
plan.povCharacterId = authorCharacterId;
// failureModeToAvoid left as "" (empty from createEmptyScenePlan)

// After (fixed):
plan.narrativeGoal = section.purpose;
plan.povCharacterId = authorCharacterId;
plan.failureModeToAvoid = `Generic summary without a clear argument. This section must ${section.purpose.toLowerCase()}, not just describe it.`;
```

This produces section-specific failure modes like:
- "Generic summary without a clear argument. This section must establish the core problem, not just describe it."
- "Generic summary without a clear argument. This section must present supporting evidence, not just describe it."

## Why This Works

The gate at `src/gates/index.ts:23` requires `failureModeToAvoid` to be non-empty. `createEmptyScenePlan()` initializes it as `""`. The bootstrap function sets other required fields (`title`, `narrativeGoal`, `povCharacterId`) but missed `failureModeToAvoid`.

Deriving the default from `section.purpose` is better than a static string because:
1. Each section gets a failure mode specific to its role in the essay
2. The compiler can use it to prevent the most common failure: generic summarization
3. Users can override it if they want more specific guidance

## Prevention

- **Gate contract test**: After calling `bootstrapToScenePlans()`, assert that every returned plan passes `checkScenePlanGate()`. This catches any required field that the bootstrap forgets to populate:

```typescript
it("all auto-created plans pass the scene plan gate", () => {
  const plans = bootstrapToScenePlans(parsed, "proj-1", "author-id");
  for (const plan of plans) {
    const gate = checkScenePlanGate(plan);
    expect(gate.passed).toBe(true);
  }
});
```

- **Factory function audit**: When `createEmptyScenePlan()` or similar factory functions add new required fields, grep for all callers that populate those fields. Any caller that doesn't set the new field is a bug.

## Related Issues

- [docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md](../domain-adaptation/fiction-to-essay-prompt-rewrite.md) -- The bootstrap rewrite that introduced `bootstrapToScenePlans`
- `src/gates/index.ts` -- Gate definitions including `checkScenePlanGate`
- `src/bootstrap/index.ts` -- Bootstrap flow including `bootstrapToScenePlans`
