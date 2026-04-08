---
title: "Domain Adaptation: Fiction Writing Tool to Essay Writer"
category: domain-adaptation
date: 2026-04-08
tags:
  - domain-adaptation
  - prompt-engineering
  - reuse-over-rewrite
  - voice-matching
  - context-compilation
  - anti-ai-slop
components:
  - bootstrap-system
  - context-compiler
  - ring-1-builder
  - model-defaults
  - voice-pipeline-config
effort: "~90 lines logic + ~20 lines tests across 19 files"
approach: prompt-rewrite-only
schema_changes: none
pipeline_changes: none
---

# Domain Adaptation: Fiction Writing Tool to Essay Writer

## Problem

Word-compiler is a context compiler for long-form fiction with a sophisticated voice-matching pipeline (5-stage + CIPHER), kill list system, three-ring context compiler, and revision learner. All of these systems are domain-agnostic in implementation but fiction-specific in their prompts, UI labels, and bootstrap flow.

The goal was to repurpose it as a high-quality essay writer for opinionated/editorial essays (1500-4000 words), prioritizing voice accuracy and anti-AI-slop output, with minimal code changes.

## Key Insight

Almost all fiction-specific behavior lives in **prompt strings**, not in the compilation pipeline or data model. The system's nullable field design means fiction features (characters, scenes, sensory palettes, tension arcs) gracefully degrade when their data simply isn't provided -- empty fields produce no compiled sections. The pipeline compiles structured intent into context payloads regardless of whether that intent describes a novel chapter or an essay section.

## Investigation Steps

1. **Security audit** -- Cloned the repo and ran a full CSO audit. Clean codebase, one finding (unpinned CI action).

2. **Architecture review** -- Read all 14 architecture docs, the full spec, every ring builder, the assembler, budget enforcer, voice pipeline, CIPHER, learner, and auditor. Mapped exactly where fiction assumptions live.

3. **Data model analysis** -- Every fiction-specific field (`characters`, `locations`, `scenes`, `chapters`) is nullable. The compilation pipeline conditionally builds prompt sections: no data = no section emitted. Zero code paths break when fiction fields are empty.

4. **Prompt tracing** -- Identified 5 prompt-level changes needed: bootstrap prompt, generation instruction, anti-ablation guardrails, sensory guardrail, and model defaults.

5. **Research** -- Launched 4 parallel research agents covering voice matching, anti-AI-slop, continuity, and writing quality best practices (2025-2026 literature). Key findings informed the implementation.

6. **Implementation** -- 6 phases, 19 files changed, ~90 lines of logic.

7. **Review** -- 4 parallel review agents (correctness, maintainability, testing, simplicity) caught a high-severity bug in the budget enforcer interaction and identified missing test coverage.

## Root Cause (of the Main Bug Found)

The budget enforcer (`budget.ts:53`) uses raw `config.ring1HardCap` (originally 2000 tokens) to compress Ring 1 sections. But `buildRing1()` internally bumps the effective cap to accommodate voice injection and reference prose tokens. This meant the new `REFERENCE_PROSE` section would always be stripped by the budget enforcer before reaching the model -- the bump was dead code in practice.

**Fix:** Increased `ring1HardCap` from 2000 to 4000 in the default compilation config. With a 200K context window, a 4000-token Ring 1 is well within budget.

**Note:** This was a pre-existing issue that affected `AUTHOR_VOICE` as well. The essay adaptation made it critical because `REFERENCE_PROSE` added ~1500 more tokens.

## Working Solution

### Changes Made (8 source files + 9 test files + 2 doc files)

**1. Model Defaults** (`metadata.ts`, `types.ts`, `cipher.ts`)
- `DEFAULT_MODEL` changed from Sonnet 4.6 to Opus 4.6 for better voice matching
- All pipeline stages use `DEFAULT_MODEL` (single constant, no hardcoded strings)
- `targetDomain` changed from `"literary_fiction"` to `"essay"`
- `ring1HardCap` bumped from 2000 to 4000

**2. Anti-Ablation Guardrails** (`helpers.ts`)
Replaced 7 fiction guardrails with 9 essay-appropriate ones encoding the "surprise" principle from anti-slop research:
- "Do not hedge unless warranted by genuine uncertainty"
- "Vary paragraph length deliberately. Three consecutive similar-length paragraphs is failure."
- "Break the rule of three. Use two points or four, not three."
- "Avoid elegant variation -- repeat a word naturally rather than cycling through synonyms"
- "Allow grammatical imperfection: fragments, sentences starting with 'And' or 'But', contractions"

**3. Generation Instruction** (`assembler.ts`)
Completion-style framing (research: 99.9% style agreement):
```
"Continue this essay (~N words). This is section M of K: [description].
 Support claims with reasoning. Maintain argumentative coherence with prior sections.
 Match the author's voice."
```

**4. Sensory Guardrail** (`helpers.ts`)
Changed from fiction ("reveal character", "build tension") to essay ("support a claim", "make an abstraction tangible"). This section is immune (never compressed) and appears in every prompt.

**5. Bootstrap Prompt** (`bootstrap/index.ts`, ~40 lines)
Complete rewrite of schema, prompt, parser interface, and Bible converter:
- Accepts essay brief instead of fiction synopsis
- Produces: thesis, sections with headings/purposes/keyPoints, tone/register/audience, kill list, structural bans
- Creates single "Author" persona character instead of fiction cast
- Ships with 48-entry default kill list + 7 structural bans, merged with bootstrap-generated additions

**6. Reference Prose in Ring 1** (`ring1.ts`, `pipeline.ts`, `types.ts`)
New `REFERENCE_PROSE` section for few-shot voice matching (research: 23.5x improvement):
- Selects first paragraphs from top 3 writing samples by word count
- ~1500 token budget for excerpts
- Priority 2 (compressible), drops before `AUTHOR_VOICE` under budget pressure
- Optional field on `VoiceGuide` interface, backward-compatible

### What Stayed Unchanged (by design)
- TypeScript interfaces for Bible, ScenePlan, Chunk, ChapterArc
- SQLite schema and all repository modules
- Ring 1/2/3 builder logic (except adding REFERENCE_PROSE)
- Voice pipeline (5 stages, CIPHER, distillVoice)
- Auditor (kill list, sentence variance, paragraph length)
- Revision learner (diff classification, Wilson score accumulation)
- All 55+ API routes

## Research That Informed the Design

| Technique | Evidence | Applied To |
|-----------|----------|------------|
| Completion prompting | 99.9% style agreement (Jemama 2025) | Generation instruction |
| Few-shot examples | 23.5x improvement over descriptions | REFERENCE_PROSE section |
| Kill lists | Address ~30% of AI signal (ICLR 2026 Antislop) | 48-entry default kill list |
| Structural bans | Address ~70% of AI signal (ICLR 2026 Antislop) | 7 default structural bans |
| CIPHER preference learning | 31-73% edit cost reduction (NeurIPS 2024) | Retained from fiction pipeline |
| Positive instructions | Beat negative for voice description (InstructGPT) | Guardrail phrasing strategy |
| "Surprise" principle | NousResearch ANTI-SLOP: "Human writing surprises. AI never does." | Anti-ablation guardrails |

## Prevention Strategies

### 1. Domain Terminology Lint Pass
Maintain a `domain-terms.txt` blocklist per mode. Grep all prompt templates and ring builder outputs for fiction-specific terms before committing. Catches leaks like the sensory guardrail incident.

### 2. Budget Contract Tests
After Ring 1 builds its payload, assert that every section survives the budget enforcer with content intact. This catches the "silent strip" bug where the enforcer re-applies a hard cap the builder intentionally bumped.

### 3. Model Constants as Single Import
Ban hardcoded model strings outside `metadata.ts`. CI grep: `grep -rn '"claude-' --include='*.ts' | grep -v 'metadata.ts'` must return empty.

### 4. Prompt Snapshot Testing
Use semantic assertion tests that grep compiled prompts for required phrases and forbidden phrases. Catches both missing essay content and leaked fiction content without brittle exact-string matching.

### 5. Immune Section Audit on Mode Switch
Maintain a registry of immune ring sections. When switching domains, review each immune section for domain-inappropriate content. Immune sections bypass compilation and appear in every prompt -- they are the most dangerous vector for domain leaks.

## Related Documentation

- `docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md` -- Full requirements
- `docs/architecture/14-personalization.md` -- Voice pipeline architecture
- `docs/architecture/02-context-compiler.md` -- Ring structure and budget enforcement
- `docs/architecture/13-protocols.md` -- CompilerConfig interface and budget protocol
- `docs/architecture/09-bootstrap-genres.md` -- Genre templates (may need essay-mode update)
- `docs/architecture/01-theory-of-operation.md` -- Pipeline philosophy

## Verification

- 1427 tests passing (0 failures)
- Lint clean (0 errors)
- Typecheck clean (only pre-existing unrelated error)
- Code review by 4 parallel agents: correctness, maintainability, testing, simplicity
