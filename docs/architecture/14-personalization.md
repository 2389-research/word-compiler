# Personalization Layer

The personalization layer extracts an author's writing style from their existing corpus, learns from their edits, and uses both to condition prose generation. It provides cross-project voice continuity through a single evolving author profile.

## Architecture

Three independent evidence sources are stored separately and combined at distillation time into a single `ring1Injection` for Ring 1.

```
┌─────────────────────────────────────────────────────────┐
│                  THREE EVIDENCE SOURCES                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. AUTHOR VOICE (out-of-domain baseline)               │
│     Writing Samples (paste on home screen)              │
│          │                                              │
│          ▼                                              │
│     [5-Stage Pipeline] ── Haiku + Sonnet                │
│          │                                              │
│          ▼                                              │
│     voice_guide table (singleton)                       │
│     ├── narrativeSummary (full voice guide prose)       │
│     ├── coreFeatures, avoidancePatterns, etc.           │
│     ├── editingInstructions → editorial review prompts  │
│     └── narrativeSummary → "Your Voice" panel           │
│                                                         │
│  2. CIPHER PREFERENCES (explicit author corrections)    │
│     Author edits chunk                                  │
│          │                                              │
│          ▼                                              │
│     [Significance Filter] ── skip typos, whitespace     │
│          │                                              │
│          ▼ (fire-and-forget)                            │
│     significant_edits table                             │
│          │                                              │
│          ▼ (every 10 edits)                             │
│     [Batch CIPHER] ── Haiku extracts 5 preferences      │
│          │              with dimension labels            │
│          ▼                                              │
│     preference_statements table                         │
│                                                         │
│  3. PROJECT VOICE (in-domain scene analyses)            │
│     Author completes scene                              │
│          │                                              │
│          ▼                                              │
│     [Stages 1-2 on scene text]                          │
│          │                                              │
│          ▼                                              │
│     [LLM synthesis] ── anneal new scene into existing   │
│          │              project voice summary            │
│          ▼                                              │
│     project_voice_guide table (per-project)             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                 UNIFIED DISTILLATION                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  On scene completion (and on app startup):              │
│                                                         │
│  Author Voice + CIPHER Preferences + Project Voice      │
│       │                                                 │
│       ▼                                                 │
│  [distillVoice()] ── single Sonnet call                 │
│       │   Priority: CIPHER > Project > Author           │
│       ▼                                                 │
│  ring1Injection (~200-300 tokens)                       │
│       │                                                 │
│       ▼                                                 │
│  Saved on voice_guide → Ring 1 AUTHOR_VOICE section     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Three Evidence Sources

### 1. Author Voice (`voice_guide` table)

The out-of-domain baseline. Built from writing samples (blog posts, prior work) via a 5-stage LLM pipeline. Changes rarely — only when the user adds more samples and re-runs the pipeline.

```
Stage 1: Chunk + Per-Chunk Analysis     (Haiku, high-volume, parallel)
Stage 2: Per-Document Synthesis          (Haiku)
Stage 3: Cross-Document Clustering       (Sonnet, transferability assessed here)
Stage 4: Domain-Transfer Filtering       (Sonnet)
Stage 5: Voice Guide Generation          (Sonnet, + register-calibrated ring1Injection)
```

Key design decisions:
- **Content drift detection** — chunks where the LLM engaged with subject matter rather than writing mechanics are scored 0.0-1.0 and downweighted
- **Transferability deferred to Stage 3** — single-document evidence is insufficient for transfer judgments
- **Avoidance patterns as first-class features** — what an author doesn't do is often more stable than what they do
- **Position weighting** — first/last chunks get 1.5× weight
- **Evidence paraphrase only** — never directly quote source text

### 2. CIPHER Preferences (`preference_statements` table)

The highest-signal source. Explicit author corrections to LLM-generated prose, batch-analyzed for patterns. Per-project, grows continuously during editing.

**Edit tracking flow:**
1. Author edits a chunk → significance filter (`shouldTriggerCipher`) checks: >10% edit distance, not whitespace/punctuation/capitalization only
2. Significant edits stored in `significant_edits` table (fire-and-forget)
3. Every 10 significant edits → batch CIPHER call (Haiku) extracts exactly 5 preference statements with dimension labels

**CIPHER prompt** (simmered from 5.3→8.8):
- Each preference is a direct command for system prompt injection ("Write with...", "Avoid...")
- Max 30 words per preference
- Must cover 5 unique dimensions from: REGISTER, STRUCTURE, EMOTION, DIALOGUE, HUMOR, DETAIL, PACING
- 3+ edit threshold prevents one-off content decisions from becoming preferences
- Dimension selection adapts to the actual edit distribution

### 3. Project Voice (`project_voice_guide` table)

In-domain scene analyses. Per-project, grows as scenes are completed. Updated via LLM synthesis, not delta classification.

**Scene completion flow:**
1. Author completes a scene (existing gated action)
2. Stages 1-2 run on the scene's accepted text (same pipeline as Profile Generator)
3. LLM synthesizes existing project voice + new scene analysis into updated project voice summary
4. Existing guide weighted proportionally to number of scenes (N scenes of evidence > 1 new scene)
5. First scene is appropriately tentative; variations noted rather than existing patterns deleted

## Unified Distillation

A single LLM call (`distillVoice()`) combines all three evidence sources into one `ring1Injection`. This runs:
- **On scene completion** — after project voice is updated
- **On app startup** — background re-distill to pick up CIPHER preferences accumulated since last scene completion

**Priority ordering for conflicts:**
1. CIPHER Preferences — explicit corrections, highest signal
2. Project Voice — in-domain evidence from the author's fiction
3. Author Voice — out-of-domain baseline, valuable but may not fully transfer

The distilled `ring1Injection` is saved on the author-level voice guide and used as the single AUTHOR_VOICE section in Ring 1.

## Ring 1 Integration

The `ring1Injection` (~200-300 tokens) is injected into Ring 1 as an `AUTHOR_VOICE` section:
- **Priority 1** (cut last among compressible sections — only immune sections survive longer)
- **Not immune** — can be dropped under extreme budget pressure
- **Ring 1 hard cap is bumped** by the injection size so existing project style rules aren't compressed
- Cost: ~200-300 extra tokens per generation call

The VoiceGuide is loaded from the DB as a singleton, cached in the ProjectStore, and passed through the compilation pipeline: `store → compilePayload() → buildRing1(bible, config, voiceGuide)`.

The `editingInstructions` are separately injected into the editorial review system prompt, so LLM-powered reviews also know what the author's voice sounds like.

## Data Model

### VoiceGuide

The central author-level artifact. Contains:

- `coreFeatures` — transferable style features with high/medium confidence
- `probableFeatures` — features with low confidence or uncertain transferability
- `avoidancePatterns` — what the author conspicuously does NOT do
- `formatVariantFeatures` — features that appear only in certain formats
- `domainSpecificFeatures` — features filtered out as domain conventions
- `narrativeSummary` — full prose voice guide from Stage 5
- `generationInstructions` — prompt fragment for generation
- `editingInstructions` — prompt fragment for editing/review
- `ring1Injection` — compact distillation from all 3 sources, re-distilled on scene completion and startup
- `confidenceNotes` — what we know well vs. what we're inferring
- `versionHistory` — update trail

### WritingSample

Raw text provided by the author for analysis:
- `filename` — original file name (nullable for pasted text)
- `domain` — author-specified genre/domain label
- `wordCount` — computed on ingestion
- `text` — the actual writing

### PreferenceStatement

Batch-inferred style preferences from CIPHER:
- `projectId` — which project the edits came from
- `statement` — the full CIPHER output (5 labeled preferences)
- `editCount` — how many edits were in the batch

### SignificantEdit

Raw edit pairs awaiting batch CIPHER:
- `projectId`, `chunkId` — where the edit happened
- `originalText`, `editedText` — the before/after
- `processed` — whether this edit has been included in a CIPHER batch

## Database

Tables (no author_id — single-tenant):

| Table | Scope | Purpose |
|-------|-------|---------|
| `voice_guide` | Singleton | Author-level voice guide (JSON), ring1Injection re-distilled from all sources |
| `voice_guide_versions` | Singleton | Version history snapshots |
| `writing_samples` | Singleton | Raw text samples for profile generation |
| `significant_edits` | Per-project | Raw edit pairs awaiting batch CIPHER |
| `preference_statements` | Per-project | Batch-inferred style preferences (CIPHER output) |
| `project_voice_guide` | Per-project | Project-level voice summary from completed scenes |

## File Map

### Browser-safe (`src/profile/`) — pure logic, no SDK imports

| File | Responsibility |
|------|---------------|
| `types.ts` | All interfaces: VoiceGuide, WritingSample, FilteredFeature, PreferenceStatement, SignificantEdit, PipelineConfig |
| `chunker.ts` | Document chunking with token counting and overlap |
| `prompts.ts` | Prompt templates for stages 1-5 |
| `renderer.ts` | Render generation/editing prompt fragments from VoiceGuide |
| `editFilter.ts` | Significance filter for CIPHER edit tracking |

### Server-only (`server/profile/`) — imports Anthropic SDK

| File | Responsibility |
|------|---------------|
| `llm.ts` | Anthropic SDK wrapper: structuredCall, textCall, parallelStructuredCalls |
| `stage1.ts` | Per-chunk style analysis (parallel LLM calls) |
| `stage2.ts` | Per-document synthesis |
| `stage3.ts` | Cross-document clustering + transferability |
| `stage4.ts` | Domain-transfer filtering |
| `stage5.ts` | Voice guide generation + initial ring1Injection distillation |
| `pipeline.ts` | Full 5-stage pipeline orchestrator |
| `cipher.ts` | Batch CIPHER preference inference from accumulated edits |
| `projectGuide.ts` | Project voice updater (stages 1-2 synthesis) + unified distillation (distillVoice) |

### Repositories (`server/db/repositories/`)

| File | Responsibility |
|------|---------------|
| `voice-guide.ts` | Author-level VoiceGuide + version persistence |
| `writing-samples.ts` | Writing sample CRUD |
| `significant-edits.ts` | Significant edit pairs (CIPHER input) |
| `preference-statements.ts` | Batch-inferred preference statements |
| `project-voice-guide.ts` | Project-scoped voice summary persistence |

### UI

| File | Responsibility |
|------|---------------|
| `src/app/components/VoiceProfilePanel.svelte` | Home screen "Your Voice" panel |

### Eval Scripts

| File | Responsibility |
|------|---------------|
| `scripts/simmer-ring1-eval.ts` | Ring 1 injection quality evaluator |
| `scripts/simmer-cipher-eval.ts` | CIPHER batch prompt evaluator |
| `scripts/eval-tier-cascade.ts` | Tier cascade eval (no context → author → +project → +CIPHER) |
