# Gates & Workflow

Gates are pure validation functions that enforce workflow discipline. They answer the question: "Is this step ready to proceed?" Each gate returns `{ passed: boolean, messages: string[] }`.

## Six Gates (`src/gates/index.ts`)

### 1. ScenePlan Gate — `checkScenePlanGate(plan)`
**When**: Before generation can begin.
**Checks**:
- Scene plan has a title
- Scene plan has a narrative goal
- Scene plan has at least one chunk description
- POV character is set

### 2. Compile Gate — `checkCompileGate(lintResult)`
**When**: After compilation, before generation.
**Checks**:
- Lint result has no errors (warnings are allowed)

### 3. ChunkReview Gate — `checkChunkReviewGate(chunk)`
**When**: Before accepting a chunk into the scene.
**Checks**:
- Chunk has a non-empty generated text
- Chunk status is not "rejected"

### 4. SceneCompletion Gate — `checkSceneCompletionGate(chunks, plan)`
**When**: Before marking a scene as complete.
**Checks**:
- At least one chunk exists
- All chunks are accepted or edited (none pending/rejected)
- Chunk count matches plan's expected chunk count (or is within tolerance)

### 5. AuditResolution Gate — `checkAuditResolutionGate(flags)`
**When**: Before marking a scene as complete.
**Checks**:
- All critical audit flags are resolved
- All warning flags are either resolved or dismissed

### 6. BibleVersioning Gate — `checkBibleVersioningGate(bible, latestVersion)`
**When**: Before saving a Bible update.
**Checks**:
- Bible has at least one character
- Bible has a non-empty voice profile section

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

## Scene Workflow (`src/gates/scene-workflow.ts`)

The scene workflow module coordinates the full per-scene lifecycle:

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
