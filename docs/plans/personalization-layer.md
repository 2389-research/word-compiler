# Personalization Layer — Design & Status

Status: **Phases 1-3 implemented + refined.** Phases 4-5 superseded by unified distillation.

## Problem

The current learner (`src/learner/`) is project-scoped and heuristic-only. There is no concept of an author that spans projects, no cross-project style transfer, and no LLM in the classification loop. The edit classification uses word counts and regex patterns, producing coarse signals (8 fixed subtypes) that aren't rich enough to build a meaningful author profile.

## Core Insight

This is a standard **cold-start → warm-start → in-domain personalization** cascade, well-established in recommendation systems literature:

| Tier | Signal Source | RecSys Analog | Status |
|------|--------------|---------------|--------|
| **Tier 0** (cold start) | No prior work — genre templates | New-user cold start | Deferred |
| **Tier 1** (warm start) | Author's prior published/completed works | Content-based profiling, cross-domain transfer | **Phase 1 — Done** |
| **Tier 2** (in-project) | Active edits on the current book | Coactive learning from implicit feedback | **Phase 3 — Done** |
| **Feedback loop** | In-domain scenes + CIPHER edits continuously anneal into profile | Continuous learning | **Done (unified distillation)** |

## Key Literature

### Style Profile Representation

The research converges: **natural language descriptions are the best primary representation** for conditioning LLM generation. They are human-readable, editable, transferable across models, and fit in system prompts.

A complete profile is a hybrid:

- **Natural language description** (primary) — "Short declarative sentences. Emotion shown through physical gesture, never named. Heavy em-dash usage for interruption."
- **Exemplar passages** (2-5 retrieved samples matched to scene type) — implicit conditioning
- **Kill list / prohibitions** (already exists) — hard boundaries
- **Quantitative stylometric features** — used for extraction and evaluation, not injected into prompts

### Cross-Domain Stability

Stylometric research shows clear tiers of feature portability across genres:

**Most stable (genre-invariant):** Function word frequencies, character n-grams, punctuation signature, sentence length distribution, syntactic patterns.

**Moderately stable:** Vocabulary richness, metaphor density, dialogue patterns.

**Genre-locked:** Content words, domain-specific vocabulary, metaphor source domains, genre structural conventions.

### Key References

- **PROSE** (Apple, 2025) — iterative style preference inference. +7.8% over single-shot.
- **CIPHER** (NeurIPS 2024) — learning latent preference from user edits. Batch inference from accumulated edits.
- **PTUPCDR** (WSDM 2022) — personalized bridge functions for cross-domain preference transfer.
- **"Catch Me If You Can?"** (EMNLP 2025) — LLMs struggle with implicit style imitation; explicit rules layer is necessary.
- **LiteraryTaste** (2025) — stated preferences have limited utility vs. revealed preferences.

---

## What Was Built

### Phase 1: Profile Generator (Done + Simmered)

A 5-stage LLM pipeline that ingests writing samples and produces a structured VoiceGuide.

```
Writing Samples (paste text on home screen)
     │
     ▼
[Stage 1] Chunking + Per-Chunk Analysis          ← Haiku (high volume)
     │         Content drift scored 0.0-1.0 (not boolean)
     ▼
[Stage 2] Per-Document Synthesis                  ← Haiku
     │
     ▼
[Stage 3] Cross-Document Clustering               ← Sonnet
     │         Transferability assessed here
     ▼
[Stage 4] Domain-Transfer Filtering               ← Sonnet
     │
     ▼
[Stage 5] Voice Guide Generation                  ← Sonnet
     │         + ring1Injection distillation (register-calibrated)
     ▼
Output: VoiceGuide stored in SQLite (singleton)
```

**Simmered:** Drift accuracy 3.0 → 9.3 (3 iterations). Output quality 7.0 → 8.7 (1 iteration).

### Phase 2: Ring 1 Integration (Done + Simmered)

The `ring1Injection` (~200-300 tokens) is injected into Ring 1 as an `AUTHOR_VOICE` section.

- **Priority 1** (cut last among compressible sections)
- **Not immune** — can be dropped under extreme budget pressure
- **Ring 1 hard cap bumped** by injection size — existing project rules not compressed
- **`editingInstructions`** injected into editorial review system prompt
- VoiceGuide loaded from DB → ProjectStore → compilation pipeline

Cost: ~200-300 extra tokens per generation call.

### Phase 3: CIPHER Edit Learning (Done + Simmered)

**Edit tracking:**
1. Author edits a chunk → significance filter checks: >10% edit distance, not whitespace/punctuation/capitalization only
2. Significant edits stored in `significant_edits` table (fire-and-forget)
3. Every 10 significant edits → batch CIPHER call (Haiku) → 5 preference statements with dimension labels

**CIPHER prompt simmered** from 5.3 → 8.8 (3 iterations):
- Directive commands, not descriptive paragraphs
- Dimension labels enforced (REGISTER, STRUCTURE, EMOTION, DIALOGUE, HUMOR, DETAIL, PACING)
- 3+ edit threshold prevents one-off content decisions from becoming preferences
- 30-word max per preference
- Edit truncation: token-aware at 2000 tokens (was 500 chars)

### Unified Distillation (Replaces Phase 4)

Three evidence sources stored separately, combined at distillation time:

| Source | Storage | Update Trigger | Signal Type |
|--------|---------|---------------|-------------|
| Author Voice | `voice_guide` (singleton) | User adds samples + runs pipeline | Out-of-domain baseline |
| CIPHER Preferences | `preference_statements` (per-project) | Every 10 significant edits | Explicit author corrections |
| Project Voice | `project_voice_guide` (per-project) | Scene completion | In-domain scene analysis |

**distillVoice()** combines all three into a single `ring1Injection` with priority ordering:
1. CIPHER Preferences (explicit corrections — highest signal)
2. Project Voice (in-domain evidence from fiction)
3. Author Voice (out-of-domain baseline)

Runs on:
- **Scene completion** — after project voice is updated
- **App startup** — background re-distill to pick up recent CIPHER preferences

**Project voice synthesis** — LLM anneals new scene analysis into existing project voice summary. Existing guide weighted proportionally to evidence (N scenes > 1 new scene). No delta classification — direct re-synthesis is simpler and more robust.

**Tier cascade eval** confirmed progressive improvement across all tiers:
- T0 (no context) → T1 (author only) → T2 (+project) → T3 (full stack)
- Each tier adds genuine signal; the full stack is clearly best
- CIPHER's register correction overrides the author voice's slightly literary tendencies — exactly right for in-domain fiction

---

## UI Integration

### Home Screen: "Your Voice" Section

On the project list / home screen. Not mandatory.

Three states:
- **No samples**: prompt to add writing samples
- **Has samples, no guide**: sample list + "Generate Profile" button
- **Has guide**: core sensibility paragraph, version, corpus size, "View Full Guide" / "Add More Samples"

### Ring 1 Flow

```
distillVoice(authorGuide, cipherPrefs, projectGuide)
  → single ring1Injection (~200-300 tokens)
  → saved on voice_guide
  → Ring 1 AUTHOR_VOICE section
  → hard cap bumped to accommodate
```

---

## Database Schema

```sql
-- Author-level voice guide (singleton)
voice_guide (id, version, data, created_at, updated_at)
voice_guide_versions (id, version, data, change_reason, change_summary, created_at)

-- Writing samples for profile generation
writing_samples (id, filename, domain, word_count, data, created_at)

-- CIPHER edit learning (per-project)
significant_edits (id, project_id, chunk_id, original_text, edited_text, processed, created_at)
preference_statements (id, project_id, statement, edit_count, created_at)

-- Project-level voice summary (per-project)
project_voice_guide (id, project_id, version, data, created_at, updated_at) UNIQUE(project_id)
```

---

## Implementation Status

| Phase | Status | Key Files |
|-------|--------|-----------|
| Phase 1: Profile Generator | **Done + simmered** | `src/profile/`, `server/profile/stage1-5.ts`, `VoiceProfilePanel.svelte` |
| Phase 2: Ring 1 Integration | **Done + simmered** | `src/compiler/ring1.ts`, `compiler.svelte.ts`, `src/review/prompt.ts` |
| Phase 3: CIPHER Edit Learning | **Done + simmered** | `src/profile/editFilter.ts`, `server/profile/cipher.ts` |
| Unified Distillation | **Done + eval'd** | `server/profile/projectGuide.ts` (distillVoice), `server/api/routes.ts` |
| Tier Cascade Eval | **Done** | `scripts/eval-tier-cascade.ts` |

---

## Removed

### Delta Update Protocol

The incremental delta update system (`delta.ts`) was removed. It classified new features as confirmed/contradicted/new against an existing guide — designed for "add more writing samples" but never wired into active flows. The full pipeline re-run on all samples is simpler and produces better results. The project voice path now uses direct LLM synthesis instead of delta classification.

### Two-Guide Merge

The previous architecture concatenated two separate `ring1Injection` strings in `compiler.svelte.ts` (author-level + project-level). This was replaced by a single `distillVoice()` call that produces one injection from all three evidence sources, with explicit priority ordering.

---

## Remaining Work

### Deferred

- **Tier 0 questionnaire** — stated preferences are weak predictors (LiteraryTaste, 2025)
- **URL-based sample ingestion** — scraping infrastructure not worth it for v1
- **File picker upload** — v1 is paste-only
- **Exemplar retrieval for Ring 3** — needs embedding infrastructure
- **Multi-author support** — add author FK when needed
- **Phase 5: New Project Merge** — modify bootstrap to pre-populate from author profile

---

## Known Issues / Improvements

1. **UI should guide users to add multiple samples.** Pipeline needs ≥2 documents for meaningful cross-document clustering. Show hints, possibly disable generate with 1 sample.
2. **No progress reporting during pipeline execution.** User sees spinner for 5-10 minutes. Should add SSE progress events per stage.
3. **Pipeline cost.** Full run on 5 documents costs ~$2-4 in API calls. No caching between runs.
4. **Edit significance filter is a simmer target.** The 10% edit distance threshold was tuned on a small set of examples. Could be improved with real editing data.
5. **Single-document runs.** Should skip Stage 3 clustering and pass Stage 2 features through with lower confidence.

## Open Questions

1. **Existing learner coexistence** — the heuristic learner (`src/learner/`) still runs alongside CIPHER. Should it be replaced, or do both provide value?
2. **CIPHER preference accumulation** — preferences accumulate indefinitely per-project. Should old batches be pruned or down-weighted as new ones arrive?
3. **Cross-project CIPHER** — CIPHER preferences are per-project. Should universally consistent preferences (same correction across multiple projects) be promoted to the author voice?
