# Gates & Workflow

Gates are pure validation functions that enforce workflow discipline. They answer the question: "Is this step ready to proceed?" Each gate returns `{ passed: boolean, messages: string[] }`.

## 13 Gates (`src/gates/index.ts`)

### 1. ScenePlan Gate — `checkScenePlanGate(plan)`
**When**: Before generation can begin.
**Checks**:
- Scene plan has a title
- Scene plan has a narrative goal
- Scene plan has a failure mode to avoid
- POV character is set

### 2. Compile Gate — `checkCompileGate(lintResult)`
**When**: After compilation, before generation.
**Checks**:
- Lint result has no errors (warnings are allowed)

### 3. ChunkReview Gate — `checkChunkReviewGate(chunk)`
**When**: Before accepting a chunk into the scene.
**Checks**:
- Chunk status is "accepted" or "edited"

### 4. SceneCompletion Gate — `checkSceneCompletionGate(chunks, plan)`
**When**: Before marking a scene as complete.
**Checks**:
- At least one chunk exists
- All chunks are accepted or edited (none pending/rejected)
- Chunk count matches plan's expected chunk count (or is within tolerance)

### 5. AuditResolution Gate — `checkAuditResolutionGate(flags)`
**When**: Before marking a scene as complete.
**Checks**:
- All critical audit flags are resolved (warnings are ignored)

### 6. BibleVersioning Gate — `checkBibleVersioningGate(bible, latestVersion)`
**When**: Before generation, to ensure the compiled payload uses the current Bible.
**Checks**:
- Bible version is greater than or equal to the latest available version

## Scene Status Transitions

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ planned  │────────▶│ drafting │────────▶│ complete │
└──────────┘  first  └──────────┘  manual  └──────────┘
              chunk                 gate
              generated             check
```

- **planned → drafting**: Automatic when the first chunk is generated for a scene
- **drafting → complete**: Manual — requires all gates to pass (SceneCompletion + AuditResolution)
- Backward transitions are not permitted

### 7. BootstrapToPlan Gate — `checkBootstrapToPlanGate(bible)`
**When**: Before transitioning from bootstrap to planning stage.
**Checks**:
- Bible exists
- Bible has at least 1 character

### 8. PlanToDraft Gate — `checkPlanToDraftGate(scenePlans)`
**When**: Before transitioning from planning to drafting stage.
**Checks**:
- At least 1 scene plan with a title and narrative goal

### 9. DraftToAudit Gate — `checkDraftToAuditGate(sceneChunks)`
**When**: Before transitioning from drafting to audit stage.
**Checks**:
- At least 1 chunk generated in any scene

### 10. AuditToEdit Gate — `checkAuditToEditGate(flags)`
**When**: Before transitioning from audit to edit stage.
**Checks**:
- No unresolved critical audit flags

### 11. EditToComplete Gate — `checkEditToCompleteGate()`
**When**: Before transitioning from edit to complete stage.
**Checks**:
- Soft gate — always passes (editing is subjective)

### 12. AuditToComplete Gate — `checkAuditToCompleteGate(flags)`
**When**: Before transitioning from audit to complete stage.
**Checks**:
- No unresolved critical audit flags

### 13. CompleteToExport Gate — `checkCompleteToExportGate(scenes)`
**When**: Before transitioning from complete to export stage.
**Checks**:
- At least 1 scene marked "complete"

## Scene Workflow

The scene workflow coordinates the full per-scene lifecycle:

1. **Plan** — Author defines the scene plan (ScenePlan gate must pass)
2. **Compile** — System builds the prompt (Compile gate must pass)
3. **Generate** — Chunks are generated one at a time (SSE streaming)
4. **Review** — Author reviews each chunk (ChunkReview gate)
5. **Audit** — System scans for violations (audit flags created)
6. **Edit** — Author revises prose (learner observes)
7. **Resolve** — Author addresses audit flags (AuditResolution gate)
8. **Extract IR** — System extracts narrative IR (author verifies)
9. **Complete** — Author marks scene complete (SceneCompletion gate)

## Design Decisions

**Why pure functions?** Gates have no side effects, no network calls, no state mutations. This means they can be:
- Unit tested with simple input/output assertions
- Run in CI as part of the eval pipeline
- Composed into custom workflows
- Called multiple times without cost

**Why not enforce in the UI?** The UI renders gate results (red/green indicators, message lists) but doesn't prevent actions. This keeps the gate logic testable and allows the author to override in development workflows.
