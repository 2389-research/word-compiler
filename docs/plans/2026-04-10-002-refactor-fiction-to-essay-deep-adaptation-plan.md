---
title: "refactor: Deep fiction-to-essay adaptation — prompts, UI, and compiler"
type: refactor
status: active
date: 2026-04-10
origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md
---

# Deep Fiction-to-Essay Adaptation

## Overview

The word-compiler was adapted from fiction to essay writing at the prompt and UI label level. The first pass (~40% complete) adapted the bootstrap, assembler, gates, genre templates, and key UI headers. This plan covers the remaining ~60%: LLM system prompts, field glossary/examples, compiler Ring 3, IR extractor, and ~28 remaining UI strings.

All units are designed for parallel swarm execution. No unit depends on another — they touch non-overlapping files.

## Problem Frame

Users see a mix of essay and fiction terminology. LLM prompts still say "literary fiction," "narrative architect," and "character knowledge." Field tooltips explain fiction concepts. Example content shows detectives and thrillers. The tool works but feels half-adapted, undermining trust that the system understands essay writing.

(see origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)

## Requirements Trace

- R4: Generated prose must never read as AI-generated → review/refine prompts must frame as essay editing
- R5: Anti-ablation guardrails rewritten for essays → already done in helpers.ts, but ring3 still has fiction constructs
- R6: Bootstrap prompt rewritten → done, but sceneBootstrap.ts is still fiction-framed
- R7: Generation instruction rewritten → done in assembler.ts
- R8: Section plans work naturally for essays → gate messages done, but UI tooltips still explain fiction concepts
- R9: Author persona as single character → profile extraction done, but field glossary explains fiction characters
- R15: No data model changes → this plan changes only strings and prompt text, never interfaces

## Scope Boundaries

- **No TypeScript interface changes** — all changes are string literals, prompt text, and UI labels
- **No database changes** — SQLite schema and repository modules untouched
- **No compilation pipeline logic changes** — ring builder algorithms, budget enforcer, assembler structure unchanged
- **No voice pipeline changes** — stages 1-5, CIPHER, distillVoice unchanged
- **No new features** — this is purely adapting existing text from fiction to essay domain
- **Internal variable names stay as-is** — `bible`, `scenePlan`, `character` in code are fine; only user-facing text changes

## Key Technical Decisions

- **Ring 3 fiction sections become conditional no-ops**: `SCENE_CAST_GUARDRAIL` and `SCENE_CAST` sections in ring3.ts are fiction-specific. Rather than removing the code, we change the guardrail text to be domain-agnostic ("Only reference entities listed in the section plan") and let the cast section gracefully degrade (it only fires when `presentCharacterIds` is non-empty, which essays don't use). Add a comment above SCENE_CAST explaining it is fiction-only dead code kept for potential future reuse.
- **Subtext helper in helpers.ts stays**: The `formatSubtextContract` function in helpers.ts only fires when `plan.subtext` is non-null. Essays don't set subtext, so it never fires. No change needed to subtext logic. However, the character instruction string at `helpers.ts:164` (which IS always used) contains fiction language ("backstory", "contradictions through action") and is updated in Unit 3.
- **Field glossary gets full rewrite**: The 44-entry glossary is fiction-oriented. Every tooltip that references fiction concepts (scenes, characters, dialogue, antagonists) must be rewritten for essays. This is the largest single unit.
- **Field examples get full rewrite**: All example content uses fiction scenarios. Replace with essay-appropriate examples (personal essays, op-eds, analytical pieces).
- **Test assertions follow source changes**: When a UI string changes, corresponding test assertions must change. Tests are updated in the same unit as their source file.

## Implementation Units

All units are independent and can execute in parallel. No unit depends on another.

```mermaid
graph TB
    U1[Unit 1: Review Prompts]
    U2[Unit 2: Scene Bootstrap Prompts]
    U3[Unit 3: Ring 3 + Ring 1 Fiction Text]
    U4[Unit 4: IR Extractor Prompts]
    U5[Unit 5: Field Glossary Rewrite]
    U6[Unit 6: Field Examples Rewrite]
    U7[Unit 7: UI String Fixes - Components]
    U8[Unit 8: App.svelte + Export Defaults]
    U9[Unit 9: Storybook + Factory Cleanup]
    U10[Unit 10: E2E Test Fixes]
```

All units run in parallel — zero dependencies between them.

---

- [ ] **Unit 1: Fix review and refine LLM system prompts**

**Goal:** Replace "literary fiction" / "long-form fiction" in review system prompts with essay-appropriate framing.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/review/prompt.ts` (lines 155, 205)
- Modify: `src/review/refine.ts` (line 45)
- Modify: `tests/review/prompt.test.ts`
- Modify: `tests/review/refine.test.ts`

**Approach:**
Three string replacements in LLM system prompts:
- `prompt.ts:155`: "editorial review assistant for long-form fiction" → "editorial review assistant for essays and long-form nonfiction"
- `prompt.ts:205`: "prose rewriting assistant for long-form fiction" → "prose rewriting assistant for essays and long-form nonfiction"
- `refine.ts:45`: "surgical prose editor for literary fiction" → "surgical prose editor for essays and nonfiction"
- `refine.ts:47`: "Voice rules > Narrative coherence" → "Voice rules > Argumentative coherence"
- `refine.ts:52`: "CHARACTER VOICES (active in scene)" → "AUTHOR VOICES (active in section)"

**Patterns to follow:**
- Same approach used in `src/compiler/assembler.ts` where generation instruction was already adapted

**Test scenarios:**
- Happy path: `buildReviewSystemPrompt` output contains "essays" not "fiction"
- Happy path: `buildReviewRewritePrompt` output contains "nonfiction" not "fiction"
- Happy path: `buildRefinementSystemPrompt` output contains "essays" not "literary fiction"
- Happy path: Voice section header says "AUTHOR VOICES" not "CHARACTER VOICES"

**Verification:**
- `grep -r "fiction" src/review/` returns zero results
- All review/refine tests pass

---

- [ ] **Unit 2: Fix scene bootstrap LLM prompts**

**Goal:** Replace "narrative architect" fiction-framed prompt with essay section planning framing.

**Requirements:** R6, R8

**Dependencies:** None

**Files:**
- Modify: `src/bootstrap/sceneBootstrap.ts` (lines 417-418 and surrounding prompt text)
- Modify: `tests/bootstrap/sceneBootstrap.test.ts`

**Approach:**
The system prompt at lines 417-418 says "You are a narrative architect...generate scene plans that form a cohesive chapter arc." Replace with essay-appropriate framing:
- "You are a narrative architect" → "You are an essay structure planner"
- "generate scene plans" → "generate section plans"
- "cohesive chapter arc" → "cohesive essay structure"
- "readerStateExiting of the previous scene" → "readerStateExiting of the previous section"
- "scene N" → "section N"

Also review the schema fields in the prompt (subtext, emotionalBeat, presentCharacterIds, sensoryNotes) — these are part of the ScenePlan interface and MUST stay as field names. Only change the descriptive text around them if present.

**Important constraint:** The ScenePlan interface fields (subtext, emotionalBeat, etc.) must keep their exact names in the schema since the LLM response is parsed into these fields. Only change descriptive/instructional text, never field names in the JSON schema.

**Patterns to follow:**
- `src/bootstrap/index.ts` bootstrap prompt — already adapted for essays

**Test scenarios:**
- Happy path: Scene bootstrap prompt contains "section" not "scene" in instructional text
- Happy path: Scene bootstrap prompt contains "essay" not "chapter arc" in instructional text
- Edge case: JSON schema field names (subtext, emotionalBeat, etc.) remain unchanged
- Happy path: Bootstrap still produces valid ScenePlan objects (existing tests pass)

**Verification:**
- `grep "narrative architect" src/bootstrap/sceneBootstrap.ts` returns zero results
- All sceneBootstrap tests pass

---

- [ ] **Unit 3: Fix Ring 3 and Ring 1 fiction text**

**Goal:** Replace fiction-specific text in compiled prompts that the LLM reads during generation.

**Requirements:** R5, R7

**Dependencies:** None

**Files:**
- Modify: `src/compiler/ring3.ts` (lines 100-104)
- Modify: `src/compiler/ring1.ts` (line 127)
- Modify: `src/compiler/helpers.ts` (line 164)
- Modify: `tests/compiler/ring3.test.ts`
- Modify: `tests/compiler/ring1.test.ts`

**Approach:**
Ring 3 changes:
- `ring3.ts:101` SCENE_CAST_GUARDRAIL text: "Only characters listed as present may appear. Do not introduce unnamed crowd, bystanders, or extras unless the scene plan explicitly calls for them." → "Only entities listed in the section plan may be referenced. Do not introduce unattributed sources or claims unless the section plan explicitly calls for them." (domain-agnostic, works for both essay and fiction)
- The SCENE_CAST section (lines 113-123) only fires when `presentIds.length > 0`. Essays don't set `presentCharacterIds`, so this code never runs. Add a comment: `// Essays never populate presentCharacterIds — this section is fiction-only. Kept for potential future fiction support.`

Ring 1 change:
- `ring1.ts:127`: "Do not invent backstory, appearance, or world facts beyond what is provided in context" → "Do not invent facts, credentials, or claims beyond what is provided in context"

Helpers change:
- `helpers.ts:164`: "Show contradictions through action, choice, and voice slippage — never state them directly. Do not invent backstory or appearance beyond what is provided in context." → "Show nuance through evidence, qualification, and tonal shifts — never contradict earlier claims without acknowledgment. Do not invent facts or credentials beyond what is provided in context."

**Patterns to follow:**
- `src/compiler/helpers.ts` `formatAntiAblation` — already adapted for essays

**Test scenarios:**
- Happy path: Ring 3 guardrail text mentions "section plan" not "scene plan"
- Happy path: Ring 1 output mentions "facts, credentials" not "backstory, appearance"
- Happy path: Helpers character instruction mentions "evidence" not "contradictions through action"
- Edge case: SCENE_CAST section still builds correctly when presentIds is provided (fiction backward compat)

**Verification:**
- `grep -r "backstory" src/compiler/` returns zero results (except helpers.ts line 132-134 which is a field name, not user text)
- All compiler tests pass

---

- [ ] **Unit 4: Fix IR extractor fiction framing**

**Goal:** Replace fiction-specific language in the IR extraction prompt.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/ir/extractor.ts`
- Modify: `tests/ir/extractor.test.ts`

**Approach:**
Search `src/ir/extractor.ts` for fiction-framed strings. The audit found "Facts that now exist in the story world after this scene." Replace with essay-appropriate framing:
- "story world" → "essay"
- "scene" → "section" (in prompt text only, not in type field names)
- "characters" → "voices/sources" (in prompt text only)

**Important constraint:** The NarrativeIR interface fields must keep their exact names. Only change descriptive text in prompts.

**Patterns to follow:**
- Same string-replacement approach as all prior adaptations

**Test scenarios:**
- Happy path: Extractor prompt text uses "section" not "scene"
- Happy path: Extractor prompt text uses "essay" not "story world"
- Happy path: Extraction still produces valid NarrativeIR objects

**Verification:**
- `grep "story world" src/ir/extractor.ts` returns zero results
- All IR tests pass

---

- [ ] **Unit 5: Rewrite field glossary for essays**

**Goal:** Replace all 44 fiction-oriented field tooltips with essay-appropriate descriptions.

**Requirements:** R8, R9

**Dependencies:** None

**Files:**
- Modify: `src/app/components/field-glossary.ts`

**Approach:**
This is the largest single unit. Every tooltip entry must be reviewed and rewritten. Key changes:
- "Who Tells the Story" → "Writing Perspective"
- "First person uses 'I', close third stays near one character's thoughts" → "First person uses 'I' for personal essays. Analytical perspective maintains distance. Personal narrative blends reflection with story."
- "Story Role" → "Voice Role"
- "Protagonists get more token budget" → "Primary authors get more token budget"
- "most powerful sense in fiction" → "concrete details ground abstract arguments"
- "A noir novel using nature metaphors" → "A tech essay using construction metaphors"
- All scene glossary entries: replace "scene" with "section", fiction examples with essay examples
- All character glossary entries: replace "character" with "author voice", "dialogue" with "writing"

Read the entire file first. Rewrite each entry preserving the data structure but changing all descriptive text to essay framing.

**Patterns to follow:**
- `src/app/components/CharacterFormFields.svelte` — already has essay labels ("Primary Author", "Writing Samples")

**Test scenarios:**
- Test expectation: none — this file exports data objects with no behavioral logic. Visual verification via Storybook.

**Verification:**
- `grep -iE "fiction|novel|protagonist|antagonist|narrator|detective|thriller|chase scene" src/app/components/field-glossary.ts` returns zero results
- Count entries in the exported glossary object — confirm all entries have been reviewed (not just the 8 examples listed above)
- Check for test files importing field-glossary: `grep -r "field-glossary" tests/` — update any assertions found
- Storybook renders correctly with new tooltips

---

- [ ] **Unit 6: Rewrite field examples for essays**

**Goal:** Replace all fiction-oriented example content with essay-appropriate examples.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/app/components/field-examples.ts`

**Approach:**
All example content currently uses fiction scenarios (detectives, thrillers, romance, noir). Replace with essay-appropriate examples:
- Kill list examples: essay-specific AI slop phrases
- Voice notes examples: essay voice descriptions
- Metaphor register examples: essay domains (technology, economics, nature, architecture)
- Structural bans examples: essay-specific structural problems
- Section goal examples: essay section objectives
- Writing samples examples: essay passages

Read the entire file first. Replace all fiction content while preserving the data structure.

**Patterns to follow:**
- `src/bootstrap/genres.ts` — essay style templates with essay-appropriate content

**Test scenarios:**
- Test expectation: none — this file exports data objects. Visual verification via Storybook/ExamplesDrawer.

**Verification:**
- `grep -i "detective\|thriller\|romance\|noir\|antagonist\|protagonist" src/app/components/field-examples.ts` returns zero results
- ExamplesDrawer renders correctly in Storybook

---

- [ ] **Unit 7: Fix remaining UI fiction strings in components**

**Goal:** Fix ~28 user-visible fiction strings across Svelte components.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/app/components/AtlasPane.svelte` (lines 25, 39 — "Bible" tab label)
- Modify: `src/app/components/AtlasSceneTab.svelte` (lines 86, 100, 223, 224, 229, 231, 238)
- Modify: `src/app/components/AtlasArcTab.svelte` (line 117)
- Modify: `src/app/components/AtlasBibleTab.svelte` (line 403)
- Modify: `src/app/components/SceneBootstrapTab.svelte` (lines 510, 591, 594, 617, 682, 684, 687, 702, 724)
- Modify: `src/app/components/SceneGuidedFormTab.svelte` (line 125)
- Modify: `src/app/components/stages/DraftStage.svelte` (lines 337, 574)
- Modify: `src/app/components/stages/EditStage.svelte` (line 21)
- Modify: `src/app/components/stages/AuditStage.svelte` (line 156)
- Modify: `src/app/components/stages/CompleteStage.svelte` (line 46)
- Modify: `src/app/components/ForwardSimulator.svelte` (line 50)
- Modify: `src/app/components/VoiceSeparabilityView.svelte` (lines 26, 39, 49)
- Modify: `src/app/components/CharacterCard.svelte` (lines 81-83)
- Modify: `src/app/components/LearnerPanel.svelte` (lines 65-70)
- Modify: `tests/ui/AtlasPane.test.ts`
- Modify: `tests/ui/DraftingDesk.test.ts` (if asserting on changed strings)
- Modify: `tests/ui/ForwardSimulator.test.ts`
- Modify: `tests/ui/VoiceSeparabilityView.test.ts`

**Approach:**
String replacements — every instance follows the terminology map from CLAUDE.md:
- "Bible" (tab label) → "Brief"
- "New Bible" → "New Brief"
- "Untitled Scene" → "Untitled Section"
- "Edit scene plan" → "Edit section plan"
- "POV Character" → "Author Voice"
- "POV Distance" → "Perspective Distance"
- "POV: {name}" → "Voice: {name}"
- "not in bible" → "not in brief"
- "Untitled Chapter" → "Untitled Essay"
- "Characters" → "Voice Profiles"
- "No scene plan selected" → "No section plan selected"
- "No scene" → "No section"
- "No scenes added yet" → "No sections added yet"
- "Complete scenes with dialogue" → "Complete sections with writing"
- "Dialogue Lines" → "Writing Passages"
- "dialogueSamples" label → "Writing Samples"
- "Scene bootstrap failed" → "Section planning failed"
- "+ Add Another Scene" → "+ Add Another Section"
- "Update character voice notes" → "Update author voice notes"
- "Update location sensory palette" → "Update reference context"

**Patterns to follow:**
- Previous UI relabeling done in `CharacterFormFields.svelte`, `BibleGuidedFormTab.svelte`, `SceneSequencer.svelte`

**Test scenarios:**
- Happy path: AtlasPane tab shows "Brief" not "Bible"
- Happy path: DraftStage shows "No section plan selected" not "No scene plan selected"
- Happy path: VoiceSeparabilityView shows "Writing Passages" not "Dialogue Lines"
- Happy path: ForwardSimulator shows "No sections added yet"

**Verification:**
- `grep -r '"Bible"' src/app/components/AtlasPane.svelte` returns zero results
- `grep -ri "untitled scene\|untitled chapter\|not in bible\|dialogue lines" src/app/components/` returns zero results
- All UI tests pass

---

- [ ] **Unit 8: Fix App.svelte defaults and export defaults**

**Goal:** Change "Untitled Novel" default and "chapter" export default to essay terminology.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/app/App.svelte` (lines 92, 120)
- Modify: `src/app/components/stages/ExportStage.svelte` (line 34)
- Modify: `src/app/components/ExportModal.svelte` (line 34)
- Modify: `tests/ui/ExportModal.test.ts`

**Approach:**
- `App.svelte:92,120`: "Untitled Novel" → "Untitled Essay"
- `ExportStage.svelte:34`: `store.chapterArc?.workingTitle ?? "chapter"` → `store.chapterArc?.workingTitle ?? "essay"`
- `ExportModal.svelte:34`: same pattern → `"essay"`

**Patterns to follow:**
- Same string-replacement approach

**Test scenarios:**
- Happy path: New project defaults to "Untitled Essay"
- Happy path: Export uses "essay" not "chapter" as fallback title

**Verification:**
- `grep "Untitled Novel" src/app/App.svelte` returns zero results
- Export tests pass

---

- [ ] **Unit 9: Fix Storybook stories and test factories**

**Goal:** Replace fiction references in Storybook descriptions and factory defaults.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/app/stories/factories.ts` (line 135)
- Modify: `src/app/components/BibleAuthoringModal.stories.ts` (line 23)
- Modify: `src/app/components/BibleGuidedFormTab.stories.ts` (line 24)
- Modify: `src/app/primitives/SectionPanel.stories.ts` (line 14)
- Scan ALL `.stories.ts` files: `grep -ri "literary fiction\|fiction author\|story\|scene\|character\|dialogue" src/**/*.stories.ts` — modify every match

**Approach:**
- First, enumerate all story files: `find src -name "*.stories.ts" | wc -l` and grep all of them for fiction references
- `factories.ts:135`: "literary fiction author writing in close-third POV" → "essay writer with a direct, personal voice"
- `BibleAuthoringModal.stories.ts:23`: "Literary Fiction genre template" → "Personal Essay style template"
- `BibleGuidedFormTab.stories.ts:24`: same
- `SectionPanel.stories.ts:14`: "You are a literary fiction author..." → "You are a personal essay writer..."
- Scan all `.stories.ts` files for remaining fiction references

**Patterns to follow:**
- Match the essay terminology used in the main components

**Test scenarios:**
- Test expectation: none — Storybook stories are visual documentation, not behavioral code.

**Verification:**
- `grep -ri "literary fiction\|fiction author" src/app/stories/ src/app/components/*.stories.ts src/app/primitives/*.stories.ts` returns zero results
- Storybook builds without errors

---

- [ ] **Unit 10: Fix E2E tests asserting on old fiction strings**

**Goal:** Update E2E test assertions that check for fiction-era UI strings.

**Requirements:** Test correctness

**Dependencies:** None (tests should be updated simultaneously with source, but E2E tests are a separate file set)

**Files:**
- Modify: `e2e/app.spec.ts`
- Scan and modify if needed: `e2e/bootstrap.spec.ts`, `e2e/scene.spec.ts`, `e2e/bible.spec.ts`, `e2e/export.spec.ts`, `e2e/genre.spec.ts`, `e2e/project.spec.ts`, `e2e/review.spec.ts`, `e2e/edit-stage.spec.ts`, `e2e/errors.spec.ts`

**Approach:**
Grep ALL e2e/*.spec.ts files for fiction string assertions: `grep -ri "Bible\|Untitled Novel\|scene\|character\|dialogue\|fiction\|Story Bible" e2e/ --include="*.spec.ts"`. Update every match:
- "Create Your Story Bible" → "Create Your Essay Brief"
- "Untitled Novel" → "Untitled Essay"
- "scene" → "section" (in UI assertions only, not in URL paths or internal references)
- Any other fiction strings in assertions

**Soft dependency:** Units 7 and 8 change the UI strings these tests assert against. If running in a swarm, execute Unit 10 last or re-scan after Units 7/8 complete.

**Patterns to follow:**
- Match whatever the UI components now show after Units 7 and 8

**Test scenarios:**
- Happy path: E2E tests pass with current UI
- Edge case: No E2E test asserts on strings that were changed in other units

**Verification:**
- `pnpm e2e` passes (or at least doesn't fail on string assertions)

---

## System-Wide Impact

- **Interaction graph:** All changes are string literals in prompts and UI. No callbacks, middleware, or state management affected. The compilation pipeline, voice pipeline, and auditor logic are untouched.
- **Error propagation:** No new error paths introduced. String changes cannot cause runtime errors.
- **State lifecycle risks:** None. No state mutations, database writes, or cache behavior affected.
- **API surface parity:** The REST API returns data unchanged. Only the UI rendering of that data changes.
- **Unchanged invariants:** All TypeScript interfaces, SQLite schema, compilation pipeline, voice pipeline, auditor logic, learner system, and gate logic remain identical. Only user-facing strings and LLM prompt text change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Missing a fiction string in the sweep | Post-merge grep audit: `grep -ri "fiction\|novel\|protagonist\|antagonist\|backstory\|dialogue\|narrator\|story bible" src/` should return zero user-facing results |
| Breaking test assertions | Each unit updates tests alongside source. Run full test suite after all units merge. |
| Storybook stories becoming inconsistent | Unit 9 explicitly covers Storybook. Build verification: `pnpm storybook` |
| E2E tests broken by UI changes from earlier sessions | Unit 10 explicitly covers E2E. These may already be broken. |
| Ring 3 fiction text change breaks fiction backward compat | SCENE_CAST_GUARDRAIL text is now domain-agnostic ("entities listed in the section plan") rather than essay-specific. SCENE_CAST only fires when presentCharacterIds is populated, which essays don't use. Comment explains the dual-use intent. |

## Swarm Execution Notes

All 10 units can execute in parallel. Each unit touches a distinct set of files with zero overlap. Recommended swarm configuration:
- Units 1-4: LLM prompt fixes (4 agents)
- Units 5-6: Glossary/examples rewrite (2 agents)
- Units 7-8: UI string fixes (2 agents)
- Units 9-10: Storybook/E2E cleanup (2 agents)

Each agent should:
1. Read the target files in their entirety before making changes
2. Use the terminology map in CLAUDE.md as the reference
3. Update tests in the same commit as source changes
4. Run `pnpm test` to verify no regressions

## Post-Merge Verification

After all units merge, run a comprehensive fiction-remnant scan:
```
grep -ri "fiction\|novel\|protagonist\|antagonist\|backstory\|dialogue samples\|story bible\|narrative architect\|literary fiction" src/ server/ e2e/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "\.test\." | grep -v "stories\."
```
Any remaining hits are either internal variable names (acceptable) or missed adaptations (fix in a follow-up).

## Future Work (Beyond This Plan)

These are NOT in scope for this plan but represent the next phase of adaptation:

1. **Ring 2 for essays** — Repurpose Ring 2 for thesis tracking, claim/evidence accumulation, and section-to-section argumentative flow
2. **Essay-specific auditors** — Argument coherence, transition quality, repetition detection, evidence density
3. **Research/citation integration** — Sources panel, citation injection into Ring 3
4. **Thesis refinement loop** — Post-draft analysis of whether output argues what the thesis claims
5. **Outline restructuring** — Reorder sections based on argumentative flow
6. **Additional genre templates** — Explainer, Review/Criticism, Technical Essay

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md](docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)
- **Prior adaptation plans:** [docs/plans/2026-04-08-001-feat-essay-ui-relabeling-plan.md](docs/plans/2026-04-08-001-feat-essay-ui-relabeling-plan.md), [docs/plans/2026-04-08-002-feat-essay-style-templates-plan.md](docs/plans/2026-04-08-002-feat-essay-style-templates-plan.md)
- **Solution doc:** [docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md](docs/solutions/domain-adaptation/fiction-to-essay-prompt-rewrite.md)
- **Audit results:** 6-agent audit conducted 2026-04-10 (fiction remnants, architecture, prompts, UI, types, CLAUDE.md best practices)
- **Terminology map:** CLAUDE.md "Internal-to-Essay Terminology Map" section
