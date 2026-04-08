---
date: 2026-04-08
topic: essay-writer-adaptation
---

# Essay Writer Adaptation

## Problem Frame

Word Compiler is a context compiler for long-form fiction that solves the hardest problem in AI-assisted writing: maintaining consistent voice across generated prose. Its three-ring compilation architecture, voice profiling pipeline (5-stage + CIPHER), kill list system, and revision learner are domain-agnostic in implementation but fiction-specific in their prompts, UI labels, and bootstrap flow.

The goal is to repurpose this system as a high-quality essay writer for opinionated/editorial and personal narrative essays (1500-4000 words), prioritizing voice accuracy, anti-AI-slop output, and genuine learning-over-time.

The key insight: almost all fiction-specific behavior is in prompt strings and UI labels, not in the compilation pipeline or data model. The system's nullable field design means fiction-specific features (character tracking, sensory palettes, subtext enforcement) are simply skipped when their data isn't provided.

## Requirements

### Voice & Anti-Slop (Priority 1)

- R1. The voice pipeline must produce a baseline voice profile from 3-5 existing essay samples that captures the author's actual writing patterns (sentence structure, vocabulary tendencies, avoidance patterns)
- R2. A curated default kill list must ship with the essay mode containing common AI writing slop ("It's important to note," "In today's fast-paced world," "Let's dive in," "delve," "tapestry," "nuanced," "landscape," etc.)
- R3. The default kill list must be maximum aggressiveness: 40+ exact phrase kills (universal AI slop like "delve," "tapestry," "it's important to note," "landscape," "robust," etc.) plus 7+ structural bans ("Never open a paragraph with However/Moreover/Furthermore," "Never end a section by restating what it just said," "Never use three consecutive same-structure sentences," etc.). Start strict, relax if needed.
- R3a. The kill list must be editable and extensible by the user, and the learner should auto-propose additions based on observed edit patterns
- R4. Generated prose must never read as obviously AI-generated to a knowledgeable reader. The kill list, structural bans, voice injection, and anti-ablation guardrails work together to enforce this.
- R5. The anti-ablation guardrails must be rewritten for essays. Remove fiction-specific rules ("Do not resolve tension," "Subtext must remain sub") and replace with essay-appropriate rules ("Do not hedge unless warranted by genuine uncertainty," "Do not over-explain conclusions the evidence already supports," "Do not use throat-clearing transitions")

### Research-Backed Enhancements (Priority 1.5)

- R5a. The generation instruction must use completion-style framing: "Continue this essay from where the previous text ends" rather than "Write section N." Research shows 99.9% style agreement with completion prompting vs. orders of magnitude lower with instruction prompting (Jemama et al., 2025).
- R5b. Anti-ablation guardrails must encode the "surprise" principle from anti-slop research: vary paragraph length deliberately, break the rule of three (use 2 or 4 points, not 3), avoid elegant variation (repeat a word naturally rather than cycling synonyms), allow grammatical imperfection (fragments, sentences starting with "And"/"But," contractions).
- R5c. The default kill list must include the latest 2025-2026 AI slop taxonomy from the ICLR 2026 Antislop paper, NousResearch ANTI-SLOP, and slop-forensics research. Three tiers: kill-on-sight words (40+), suspicious-in-clusters words (30+), and filler phrases to delete unconditionally (15+). Structural bans address ~70% of AI signal; word kills address ~30% — both required.
- R5d. Positive voice exemplars should be prioritized over negative constraints for style description (writing quality research confirms LLMs process negation poorly). Kill lists remain negative (ban specific phrases), but voice descriptions should be positive instructions. The existing separation of POSITIVE_EXEMPLARS vs. NEVER_WRITE already supports this.
- R5e. A new Ring 1 section "REFERENCE_PROSE" should include 3-5 representative paragraphs (~1000-2000 tokens) from the author's writing samples, placed early in the system message. Research shows 23.5x voice-matching improvement with few-shot examples over zero-shot descriptions. The voice guide already stores writing samples — select the best excerpts during pipeline Stage 5. (~15 lines in ring1.ts)

### Essay Workflow (Priority 2)

- R6. The bootstrap prompt must be rewritten to accept an essay brief/outline and produce: thesis statement, section structure, tone/register notes, target audience description, and a suggested kill list of topic-specific cliches
- R7. The generation instruction (assembler.ts) must be rewritten for essay context. Replace "scene" with "section," drop fiction-specific directives, add essay-appropriate directives ("Support claims with reasoning," "Maintain argumentative coherence with prior sections," "Match the author's editorial voice")
- R8. Section plans (using the existing ScenePlan structure) must work naturally for essays when populated as: title = section heading, narrativeGoal = what this section argues/establishes, emotionalBeat = what the reader should feel, readerEffect = what the reader should understand, failureModeToAvoid = the worst version of this section, anchorLines = specific phrases/quotes that must appear, chunkDescriptions = paragraph-level outline
- R9. The author persona must be representable as a single "character" in the existing data model: name = author name/pen name, voice fingerprint fields = writing voice characteristics, prohibitedLanguage = words the author never uses. No character-specific code changes needed.
- R10. The "reader state" tracking (knows/suspects/wrongAbout) must work for essay argumentation: knows = established premises, suspects = where the argument is heading, wrongAbout = assumptions the essay will challenge. No code changes needed — these are free-text fields already.

### Model Upgrades (Priority 2.5)

- R14a. Voice pipeline default models should be upgraded: Stages 1-2 from Haiku to Sonnet 4.6, Stages 3-5 from Sonnet 4.5 to Opus 4.6. This is a config default change in `createDefaultPipelineConfig()` — the architecture already supports per-stage model selection.
- R14b. CIPHER batch preference extraction should be upgraded from Haiku to at least Sonnet 4.6. CIPHER extracts nuanced style preferences from edit pairs, and model quality directly impacts preference precision.
- R14c. Default generation model should be Opus 4.6 for essay prose. Voice matching is the #1 priority and Opus produces the best voice-conditioned output.
- R14d. These are all one-line constant changes. The per-stage model config and compilation config are already parameterized.

### Learning Over Time (Priority 3)

- R11. The CIPHER system must work as-is for essays. Every significant edit (>10% Levenshtein distance, not just whitespace/punctuation) feeds into the batch preference extraction. After 10 significant edits, CIPHER extracts 5 dimensional preferences that condition future generation.
- R12. The revision learner must work as-is. Edit patterns (deletions, substitutions, restructures, additions) are classified and accumulated with Wilson score confidence intervals. When patterns clear the 60% confidence threshold, they are promoted to Bible (essay brief) change proposals.
- R13. Voice quality should measurably improve across the first 3-5 essays written through the system, as CIPHER preferences accumulate and the project voice guide evolves from completed sections.

### Minimal Code Changes (Priority 4)

- R15. The data model (TypeScript interfaces, SQLite schema, repository layer) must not be modified. The existing nullable field design allows fiction-specific fields to be left empty without code changes.
- R16. Ring 1, Ring 2, and Ring 3 builder logic must not be modified. Section building is already conditional on data presence — empty fields produce no sections.
- R17. The voice pipeline (stages 1-5, CIPHER, distillVoice) must not be modified. It is already domain-agnostic.
- R18. The auditor's kill list checking, sentence variance checking, and paragraph length checking must not be modified. They are already domain-agnostic. Fiction-specific auditor checks (epistemic leaks, setup/payoff) are gated behind optional IR context and will simply not fire.

## Success Criteria

- Generated essay prose passes the "could a human have written this?" test for a knowledgeable reader familiar with AI writing patterns
- After feeding 3-5 writing samples, the voice pipeline produces a ring1Injection that noticeably shifts generation toward the author's actual style
- The kill list catches at least 90% of common AI writing tics in generated output
- After writing 3 essays through the system (with edits), CIPHER preferences visibly improve voice accuracy compared to essay #1
- Total code changes are under 100 lines of logic (not counting UI label changes)

## Scope Boundaries

- **Not changing the data model** — We are repurposing existing structures, not redesigning them. "Characters" still exist in the schema; we just use them differently.
- **Not renaming variables or database columns** — Internal names like `sceneId`, `chapterId`, `bible` stay as-is. The mental mapping (scene = section, chapter = article, bible = essay brief) is documented, not encoded.
- **Not building citation/reference management** — This is for opinionated/editorial essays, not academic papers
- **Not building a custom UI** — We adapt the existing UI with label changes where possible, and document the mental model for fields that keep their fiction names
- **Not modifying the compilation pipeline** — Ring building, budget enforcement, assembly, and linting stay unchanged
- **Not modifying the voice pipeline** — All 5 stages, CIPHER, and distillVoice stay unchanged
- **Fiction-specific features gracefully degrade** — Locations, sensory palettes, character behavior models, subtext enforcement, epistemic leak detection, setup/payoff tracking are all simply unused. They don't need to be removed.

## Key Decisions

- **Reuse over rewrite**: The existing architecture supports essay writing with prompt-level changes. We do not fork or restructure.
- **One author persona as a "character"**: Rather than removing the character system, we use exactly one character entry to represent the author's voice. This gives us voice fingerprint fields, prohibited language, and vocabulary notes for free.
- **Chapter arc is optional but valuable**: For longer essays with multiple sections, a single chapter arc provides article-level coherence (thesis, reader state tracking, pacing). For shorter pieces, skip it — Ring 2 simply isn't built.
- **Default kill list ships pre-loaded**: The biggest immediate quality win is a curated anti-slop kill list. This should be part of the bootstrap, not something the user has to build from scratch.
- **UI label changes are cosmetic, not structural**: Where the UI says "scene," read "section." Where it says "bible," read "essay brief." We document the mapping rather than rename every component.
- **Upgrade models for quality over cost**: For a small corpus (3-5 samples), the cost difference between Haiku and Opus is negligible. Use Opus 4.6 for voice pipeline Stages 3-5, generation, and CIPHER. Use Sonnet 4.6 for Stages 1-2. Prioritize voice accuracy over API spend.

## Dependencies / Assumptions

- The user has 3-5 existing essays they can paste as writing samples for the voice pipeline
- The user has an Anthropic API key (required for all generation and voice profiling)
- The user is comfortable with the existing word-compiler UI with relabeled mental model (we're not building a new frontend)

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions resolved)

### Deferred to Planning

- [Affects R6][Technical] What should the exact bootstrap prompt be for essay briefs? Needs prompt engineering during implementation.
- [Affects R7, R5a][Technical] What should the exact generation instruction text be? Must use completion-style framing per research. Needs prompt engineering during implementation.
- [Affects R5, R5b][Technical] What should the exact anti-ablation guardrail strings be? Must encode the "surprise" principle per research. Needs prompt engineering during implementation.
- [Affects R5e][Technical] How should reference prose excerpts be selected from writing samples during Stage 5? Needs implementation design — could use the highest-confidence chunks from Stage 1 analysis.
- [Affects R8][Technical] Should the bootstrap auto-generate section plans from the essay brief, or should the user create them manually? The fiction bootstrap has scene generation — decide whether to adapt it for essays.

### Deferred to v2

- Auto-generated reader state summaries between sections (LLM call after each section completion to produce structured reader state)
- Self-critique/revision pass after generation (research shows 2-3 pass optimal, but adds latency and API cost)
- Paragraph length uniformity check in auditor (detect AI-signature uniform paragraph lengths)
- Min-p sampling investigation (may produce better surprise/coherence tradeoff than top-p, needs API support check)

## Research Sources

- Jemama et al. (2025): Completion prompting reaches 99.9% style agreement
- ICLR 2026 Antislop paper (Paech et al.): Structural bans address ~70% of AI signal
- NousResearch ANTI-SLOP: Comprehensive 2025-2026 slop word taxonomy
- CIPHER (NeurIPS 2024): 31-73% edit cost reduction from preference learning
- PROSE (2025): 33% improvement over CIPHER
- CogWriter (ACL 2025): 22% improvement via plan/translate/review phases
- Contrastive ICL (AAAI 2024): Negative examples from LLM itself are effective
- "Lost in the Middle" (Stanford): 30%+ accuracy degradation for mid-context information

## Next Steps

`/ce:plan` for structured implementation planning
