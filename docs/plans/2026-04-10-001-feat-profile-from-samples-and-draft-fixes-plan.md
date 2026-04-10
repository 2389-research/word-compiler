---
title: "feat: Auto-fill author profile from writing samples + fix draft stage gate errors"
type: feat
status: active
date: 2026-04-10
origin: docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md
---

# Auto-Fill Author Profile from Writing Samples + Fix Draft Stage Gate Errors

## Overview

Two issues:

1. **Profile from Samples** — User pastes 3-5 passages of their writing, hits a button, and the LLM auto-fills the entire author voice profile (vocabulary notes, writing tics, metaphoric register, sentence length, argumentative style, etc.). Currently these fields must be filled manually.

2. **Draft stage gate errors** — The bootstrap creates section plans with `failureModeToAvoid: ""`, which triggers a hard gate ("Failure mode to avoid is required") that blocks generation. The linter also warns about R3_STARVED, NO_FAILURE_MODE, and NO_ANCHOR_LINES. The first two are fixable; the third is informational and expected.

## Problem Frame

After bootstrapping an essay, the user reaches the Draft stage and can't generate because the section plans created by `bootstrapToScenePlans()` don't populate `failureModeToAvoid`. The gate at `src/gates/index.ts:23` requires this field to be non-empty. This is a direct bug from the bootstrap flow we shipped yesterday.

Separately, filling out the author profile manually is tedious and error-prone. Users don't know what "metaphoric register" means or what their "writing tics" are. But we can extract all of this automatically from their actual writing samples using an LLM.

## Requirements Trace

- R1: Voice pipeline must produce a baseline voice profile from 3-5 writing samples (origin)
- R5: Anti-ablation guardrails must be present (failure mode is part of this)
- R9: Author persona representable as a single character (profile auto-fill enhances this)

## Scope Boundaries

- **No changes to the voice pipeline (stages 1-5)** — The profile extraction is a one-shot LLM call, not the full 5-stage pipeline. The full pipeline runs later during drafting.
- **No changes to TypeScript interfaces** — CharacterDossier, VoiceFingerprint, CharacterBehavior stay as-is
- **No database changes**
- **No changes to the compilation pipeline** — Ring builders, budget enforcer, assembler untouched

## Key Technical Decisions

- **Profile extraction is a single LLM call with structured output:** One prompt analyzes the writing samples and returns JSON matching the CharacterDossier fields. This is simpler and faster than the full 5-stage pipeline, which runs later to produce the VoiceGuide for Ring 1 injection. The profile extraction fills the form; the pipeline produces the compilation context.
- **`failureModeToAvoid` gets a smart default from section purpose:** Instead of leaving it empty (which blocks the gate), `bootstrapToScenePlans` derives a default from the section's purpose. "Generic summary of [purpose] without a clear argument" is better than nothing and can be overridden.
- **Gate stays strict:** Don't soften the `failureModeToAvoid` gate. It exists for good reason — the compiler uses it to prevent bad output. Fix the data, not the gate.
- **Gate message relabeled:** "Scene title is required" and "Narrative goal is required" should use essay terminology.

## Implementation Units

- [ ] **Unit 1: Fix bootstrapToScenePlans to set failureModeToAvoid**

**Goal:** Eliminate the "Failure mode to avoid is required" gate error by setting a sensible default.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/bootstrap/index.ts` — set `failureModeToAvoid` in `bootstrapToScenePlans`
- Modify: `tests/bootstrap/index.test.ts` — verify the default is set

**Approach:**

In `bootstrapToScenePlans`, after setting `plan.narrativeGoal`:
```
plan.failureModeToAvoid = `Generic summary without a clear argument. This section must ${section.purpose.toLowerCase()}, not just describe it.`;
```

Note: Gate message relabeling is handled in Unit 4 to avoid file-ownership conflict.

**Patterns to follow:**
- Same approach as prior bootstrap fixes — fill meaningful defaults

**Test scenarios:**
- Happy path: `bootstrapToScenePlans` creates plans with non-empty `failureModeToAvoid`
- Happy path: The default contains the section's purpose text
- Happy path: Gate passes for auto-created plans (title + narrativeGoal + povCharacterId + failureModeToAvoid all set)
- Edge case: Section with very long purpose — failureModeToAvoid truncates gracefully

**Verification:**
- After bootstrap, navigating to Draft stage shows no "Failure mode to avoid is required" error
- Gate passes for each auto-created section plan

- [ ] **Unit 2: Build "Profile from Samples" extraction prompt and function**

**Goal:** Create the backend function that takes writing samples and returns a structured author profile via LLM.

**Requirements:** R1, R9

**Dependencies:** None (can parallel with Unit 1)

**Files:**
- Create: `src/bootstrap/profileExtractor.ts` — the extraction function
- Create: `tests/bootstrap/profileExtractor.test.ts` — unit tests
- Modify: `src/bootstrap/index.ts` — re-export the new function

**Approach:**

New file `profileExtractor.ts` exports:

```typescript
function buildProfileExtractionPrompt(samples: string[]): CompiledPayload
function parseProfileResponse(response: string): ExtractedProfile | { error: string }
function applyProfileToCharacter(char: CharacterDossier, profile: ExtractedProfile): CharacterDossier
```

The extraction prompt asks the LLM to analyze the writing samples and return JSON with:
- `vocabularyNotes`: Description of vocabulary patterns, diction level, register → maps to `voice.vocabularyNotes`
- `writingTics`: Array of recurring patterns (sentence fragments, parentheticals, etc.) → maps to `voice.verbalTics`
- `metaphoricRegister`: Where comparisons are drawn from → maps to `voice.metaphoricRegister`
- `prohibitedLanguage`: Words/phrases that would sound wrong for this author → maps to `voice.prohibitedLanguage`
- `sentenceLengthRange`: [min, max] based on actual observed range → maps to `voice.sentenceLengthRange`
- `argumentativeStyle`: How the author makes arguments → maps to `behavior.stressResponse`
- `rhetoricalApproach`: How the author persuades → maps to `behavior.socialPosture`
- `observationalFocus`: What the author notices and highlights → maps to `behavior.noticesFirst`
- `persuasionStyle`: How the author builds to conclusions → maps to `behavior.lyingStyle`
- `emotionalRegister`: The emotional tone of the writing → maps to `behavior.emotionPhysicality`
- `writingSamples`: The best 2-3 representative passages (selected from input) → maps to `voice.dialogueSamples`

Use the `callLLM` function from `src/llm/client.ts` with an output schema for reliable structured JSON parsing (same pattern as bootstrap's `outputSchema` parameter). The prompt should be specific: "Analyze these writing samples and extract the author's distinctive voice characteristics. Be precise and evidence-based — cite specific patterns from the samples."

`applyProfileToCharacter` merges the extracted data into a CharacterDossier, filling only fields that are currently empty/null (same fill-blank strategy as genre templates).

**Patterns to follow:**
- `buildBootstrapPrompt` / `parseBootstrapResponse` / `bootstrapToBible` in `src/bootstrap/index.ts` — same pattern of prompt builder + parser + applier
- `bootstrapSchema` for the JSON schema approach

**Test scenarios:**
- Happy path: `buildProfileExtractionPrompt` with 3 samples produces a CompiledPayload with all samples in the user message
- Happy path: `parseProfileResponse` with valid JSON returns an ExtractedProfile
- Happy path: `applyProfileToCharacter` fills empty fields from profile
- Happy path: `applyProfileToCharacter` does NOT overwrite existing non-empty fields
- Edge case: Empty samples array — returns error
- Edge case: Single sample — works but with lower confidence
- Error path: Malformed JSON response — returns error object

**Verification:**
- Unit tests pass for all three functions
- The extraction prompt includes all CharacterDossier voice and behavior fields

- [ ] **Unit 3: Add "Profile from Samples" UI to the author voice form**

**Goal:** Add a button/modal in the author voice form where the user pastes writing samples and auto-fills their profile.

**Requirements:** R1, R9

**Dependencies:** Unit 2 (needs the extraction function)

**Files:**
- Modify: `src/app/components/CharacterFormFields.svelte` — add "Extract from Samples" button
- Modify: `src/app/components/AtlasBibleTab.svelte` — add same capability to the atlas view
- Modify: `src/app/store/commands.ts` — add `extractAuthorProfile` command (if needed)

**Approach:**

Add a prominent button at the top of the CharacterFormFields component: "Extract Voice from Writing Samples". When clicked:
1. Opens a textarea modal where the user pastes their writing (or multiple passages separated by `---`)
2. Shows a streaming/loading indicator (same pattern as BootstrapModal)
3. Calls the LLM via `callLLM` from `src/llm/client.ts` with the profile extraction prompt and output schema
4. Parses the response and calls `applyProfileToCharacter`
5. Updates the form fields with the extracted data
6. Shows a summary of what was filled in

The button should be visually prominent — this is the recommended way to set up a profile. Manual field-by-field editing is the fallback.

For the AtlasBibleTab (read-only view), add an "Extract Voice" button next to the "edit" button on the Author character card. It uses the same flow.

**Patterns to follow:**
- `BootstrapModal.svelte` for the streaming LLM call pattern (buildPrompt → generateStream → parse → apply)
- The existing `handleBootstrap()` function in BootstrapModal

**Test scenarios:**
- Happy path: Button renders in the CharacterFormFields component
- Happy path: Clicking the button opens the samples input
- Integration: Submitting samples calls the extraction function and updates the character

**Verification:**
- Open the author voice form — "Extract Voice from Writing Samples" button is visible
- Pasting samples and submitting fills in the voice fields

- [ ] **Unit 4: Update remaining fiction-specific gate and linter messages**

**Goal:** Clean up the remaining fiction-specific message strings in gates and linter that we missed in prior relabeling passes.

**Requirements:** Consistency with essay domain

**Dependencies:** None (can parallel)

**Files:**
- Modify: `src/gates/index.ts` — relabel `checkScenePlanGate` messages
- Modify: `src/linter/index.ts` — relabel fiction-specific linter messages
- Modify: `tests/gates/index.test.ts` — update test assertions if they match on specific strings

**Approach:**

`gates/index.ts` `checkScenePlanGate`:
- "Scene title is required." → "Section title is required."
- "POV character must be selected." → "Author voice must be selected."
- "Narrative goal is required." → "Section goal is required."

`linter/index.ts`:
- "Character {id} speaks in this scene but has no dialogue samples" → "Author voice {id} has no writing samples. Voice will drift toward generic."
- "Multi-character dialogue scene has no subtext contract" → "Multi-voice section has no implicit meaning contract"
- "Sensory palette will be absent" → stays (domain-agnostic)
- "POV character not found in bible" → "Author voice not found in brief"

**Patterns to follow:**
- Same string-replacement approach as all prior relabeling

**Test scenarios:**
- Happy path: Gate message says "Section title is required" not "Scene title"
- Happy path: Linter message says "writing samples" not "dialogue samples"

**Verification:**
- Grep all gate and linter messages for remaining fiction terms (scene, character, dialogue, bible)

## System-Wide Impact

- **Interaction graph:** The profile extraction is a new LLM call path through the existing `/api/generate` proxy endpoint. It uses the same Anthropic SDK client. No new API routes needed.
- **Error propagation:** If profile extraction fails (LLM error, parse failure), the form stays unchanged. User can retry or fill in manually. Graceful degradation.
- **State lifecycle risks:** Profile extraction updates the Bible via `commands.saveBible()`, the same mutation path used by bootstrap and manual editing. No new state paths.
- **Unchanged invariants:** All TypeScript interfaces, compilation pipeline, voice pipeline, SQLite schema remain identical.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Profile extraction prompt produces generic/vague results | Make the prompt extremely specific: cite exact patterns, give sentence-level evidence, don't generalize |
| LLM overrides user-set fields | `applyProfileToCharacter` uses fill-blank strategy — never overwrites non-empty fields |
| R3_STARVED warning persists | Expected for short sections with large style guides — warning, not error. The budget enforcer handles it. Follow-up: consider reducing Ring 1 weight for short sections (essay sections are 300-600 words but Ring 1 has 65+ kill list entries). |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md](docs/brainstorms/2026-04-08-essay-writer-adaptation-requirements.md)
- Voice pipeline types: `src/profile/types.ts`
- Character data model: `src/types/bible.ts`
- Bootstrap pattern: `src/bootstrap/index.ts`
- Linter: `src/linter/index.ts`
- Gates: `src/gates/index.ts`
