# Evaluation System

The evaluation system provides automated quality assessment for generated prose. It uses a three-layer hybrid architecture: a programmatic driver generates prose, deterministic checks validate hard constraints, and an LLM judge evaluates subjective quality.

## Architecture

```
Driver (workflow)     Deterministic Checks      LLM Judge
┌─────────────┐      ┌────────────────────┐    ┌────────────────┐
│ Bible        │      │ Kill list          │    │ Voice          │
│ Scene Plans  │─────▶│ Budget compliance  │    │ Subtext        │
│ Chapter Arc  │      │ Lint compliance    │    │ Tone whiplash  │
│ Config       │      │ Sentence dist.     │    │ Metaphor       │
│              │      │ Word count         │    │ Scene goal     │
│ GenerateFn() │      │ Structural bans    │    │ Continuity     │
└──────┬───────┘      │ IR completeness    │    └───────┬────────┘
       │              │ Setup/payoff       │            │
       ▼              └────────┬───────────┘            │
  DriverResult                 │                        │
       │              ┌────────▼────────────────────────▼──┐
       └─────────────▶│        EvalRunArtifact             │
                      │   deterministicChecks + judgeScores │
                      │   → overallPass                     │
                      └────────────────────────────────────┘
```

## Driver (`eval/driver.ts`)

`runChapterWorkflow(bible, chapterArc, scenePlans, options)` orchestrates a full chapter generation:

1. For each scene plan, generates all chunks sequentially
2. Each chunk: compile → generate (via `GenerateFn` callback) → create `Chunk`
3. Runs audit and metrics on each generated chunk
4. Passes the last chunk of scene N as the cross-scene bridge for scene N+1
5. Returns `DriverResult`: all scenes with compilation logs, lint results, and chunk details

The `GenerateFn` type (`(payload: CompiledPayload) => Promise<string>`) allows the driver to work with both mock (canned prose) and real LLM backends.

## Deterministic Checks (`eval/checks/deterministic.ts`)

9 per-scene checks + 2 chapter-level checks. Each returns `CheckResult { name, passed, detail }`.

### Per-Scene Checks

| Check | What It Validates |
|-------|--------------------|
| `checkKillListCompliance` | No Bible avoid-list violations in prose |
| `checkBudgetCompliance` | Total tokens within available budget |
| `checkRing1Cap` | Ring 1 tokens within hard cap |
| `checkLintCompliance` | No lint errors (delegates to compile gate) |
| `checkSentenceDistribution` | Variance ≥ 3.0 for 5+ sentences; within character voice range |
| `checkProhibitedLanguage` | No character-specific prohibited words |
| `checkStructuralBans` | No structural ban pattern matches (regex or literal) |
| `checkWordCount` | Word count within plan estimate ±20% |
| `checkDialoguePresence` | Informational — counts dialogue segments (always passes) |

### Chapter-Level Checks

| Check | What It Validates |
|-------|--------------------|
| `checkIRCompleteness` | All completed scenes have verified Narrative IRs |
| `checkSetupPayoffClosure` | No dangling setups at manuscript completion |

`runAllDeterministicChecks(inputs)` runs all 9 per-scene checks in one call.

## LLM Judge (`eval/checks/judge.ts`)

6 judge dimensions, each with a structured rubric. The judge sends prose + criteria to the LLM and parses a JSON response with `{ reasoning, score, passed, violations }`.

### Judge Dimensions

| Dimension | Scale | Pass Threshold | What It Evaluates |
|-----------|-------|---------------|-------------------|
| `voice_consistency` | 1-10 | ≥ 7 | Prose matches character's voice fingerprint |
| `subtext_adherence` | 1-3 | ≥ 2 | Gap maintained between surface dialogue and actual meaning |
| `tone_whiplash` | 1-10 | ≥ 7 | Tonal continuity across scene transitions |
| `metaphoric_register` | 1-3 | ≥ 2 | Metaphors from approved domains, none from prohibited |
| `scene_goal` | 1-10 | ≥ 7 | Narrative goal achieved, emotional beat lands |
| `continuity` | 1-10 | ≥ 7 | Opening of new scene follows naturally from previous |

### Rubric Structure (`eval/checks/rubrics.ts`)

```typescript
interface Rubric {
  dimension: JudgeDimension;
  systemPrompt: string;           // Shared base: "You are a literary quality evaluator..."
  buildUserPrompt: (context) => string;  // Dimension-specific with scoring instructions
  passThreshold: number;
  maxScore: number;
  outputSchema: JudgeOutputSchema;
}
```

Cross-scene dimensions (`tone_whiplash`, `continuity`) compare the end of scene N with the start of scene N+1.

## Runner (`eval/runner.ts`)

CLI orchestrator that ties everything together:

1. **Fixtures**: Default Bible (Marcus character, Northfield School), 4 scene plans, chapter arc
2. **Mock prose**: 4 pre-written passages matching the fixtures (used in mock mode)
3. **Per-rollout loop**: driver → deterministic checks → IR checks → judge evaluations → artifact → report
4. **Exit code**: Non-zero if any rollout fails

### CLI Options

| Flag | Default | Purpose |
|------|---------|---------|
| `--mock` | false | Use canned prose instead of LLM |
| `--rollouts=N` | 1 | Number of independent evaluation runs |
| `--generator=MODEL` | claude-sonnet-4-6 | Generator model |
| `--judge=MODEL` | claude-sonnet-4-6 | Judge model |
| `--artifact-dir=PATH` | eval/runs/ | Artifact output directory |

### NPM Scripts

| Script | Configuration |
|--------|--------------|
| `pnpm eval:mock` | `--mock --rollouts=1` |
| `pnpm eval:quick` | `--rollouts=1` (live LLM) |
| `pnpm eval:nightly` | `--rollouts=5` (live LLM) |

## Artifacts (`eval/artifacts.ts`)

Each eval run produces a JSON artifact saved to `eval/runs/` (gitignored):

```typescript
interface EvalRunArtifact {
  runId: string;
  timestamp: string;
  bibleVersion: number;
  generatorModel: string;
  judgeModel: string;
  config: CompilationConfig;
  scenes: EvalSceneResult[];
  deterministicChecks: CheckResult[];
  judgeScores: JudgeScore[];
  overallPass: boolean;
  voiceConsistencyScore: number;
  continuityScore: number;
  cost: EvalCost;
}
```

## Reports (`eval/report.ts`)

`generateReport(artifact)` produces:
- Summary line (PASS/FAIL with counts)
- Deterministic pass rate
- Judge pass rate
- Failure details with check names and messages
- Full markdown report

## CI Integration (`.github/workflows/eval.yml`)

| Trigger | What Runs | LLM |
|---------|-----------|-----|
| Pull Request | `pnpm test` + `pnpm eval:mock` | Mock |
| Nightly (3am UTC) | `pnpm test` + `pnpm eval:nightly` (5 rollouts) | Live |
| Manual Dispatch | `pnpm test` + configurable rollouts/mode | Configurable |

Nightly and manual runs upload artifacts to GitHub Actions for 30-day retention.

## Key Files

| File | Purpose |
|------|---------|
| `eval/driver.ts` | `runChapterWorkflow` — programmatic chapter generation |
| `eval/checks/deterministic.ts` | 9 per-scene + 2 chapter-level checks |
| `eval/checks/judge.ts` | 6 LLM judge dimensions |
| `eval/checks/rubrics.ts` | Structured rubric definitions |
| `eval/runner.ts` | CLI orchestrator with fixtures and mock prose |
| `eval/artifacts.ts` | JSON artifact save/load |
| `eval/report.ts` | Markdown report generation |
| `eval/types.ts` | CheckResult, JudgeScore, EvalRunArtifact, RunnerOptions |
| `.github/workflows/eval.yml` | PR gate, nightly, manual dispatch |
