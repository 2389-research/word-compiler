# Context Expansion Design

**Date:** 2026-02-25
**Status:** Proposed
**Branch:** `docs/context-expansion-design`

---

## Problem

The context compiler sends voice fingerprints, kill lists, and scene contracts — but drops significant character and location data that already exists in the data model. The LLM generates prose without knowing what characters look like, what they believe about themselves, who is physically present but not speaking, or what the location looks like beyond sensory fragments.

### Gap Inventory

| # | Gap | Data Exists In | Sent To LLM? | Impact |
|---|-----|----------------|---------------|--------|
| 1 | Physical descriptions | `CharacterDossier.physicalDescription` | No | LLM can't describe what anyone looks like |
| 2 | Backstory | `CharacterDossier.backstory` | No | No experiential grounding for POV character |
| 3 | Self-narrative | `CharacterDossier.selfNarrative` | No | POV voice lacks authentic internal lens |
| 4 | Contradictions | `CharacterDossier.contradictions` | No | No tension between self-image and reality |
| 5 | 3/5 behavior fields | `CharacterBehavior.{socialPosture, noticesFirst, lyingStyle}` | No | Only `stressResponse` and `emotionPhysicality` are sent |
| 6 | Location description | `Location.description` | No | `formatSensoryPalette()` sends palette only |
| 7 | Non-speaking characters | Characters present but not in `dialogueConstraints` | No | Invisible — no voice, no physical description, nothing |
| 8 | Scene continuity | No `keyBeats` field on chunks | N/A | Chunk 4 of 6 has no idea what happened in chunks 1–2 |

### Current Character Formatting (helpers.ts)

`formatCharacterVoice()` sends: name header, voice fingerprint details, scene-specific dialogue constraints, and only 2 of 5 behavior fields (`emotionPhysicality`, `stressResponse`). Everything else in `CharacterDossier` is ignored.

`formatSensoryPalette()` sends: location name, sounds, smells, textures, light quality, atmosphere, prohibited defaults. The `description` field is never read.

---

## Design Principles

1. **POV-relative information architecture.** The POV character gets deep interiority (backstory, self-narrative, contradictions). Other characters get external-only data (physical description, observable behavior). This mirrors how close-third and first-person narration actually work.

2. **Budget-aware expansion.** Every new section has a hard token cap. New sections slot into the existing priority system so the budget enforcer can compress them without special-casing.

3. **Show, don't tell — enforced by guardrails.** Contradictions are delivered with explicit instruction to show through action, never state directly. Physical descriptions include a cap on per-chunk introduction to prevent "description dumps."

4. **No schema changes in Phase A.** The data model already has every field we need for Phase A. The work is pure compiler wiring.

5. **Backward compatibility via defaults.** Phase B adds `presentCharacterIds` to `ScenePlan` — existing scenes without it fall back to the current behavior (speaking characters only).

---

## Phase A: Compiler-Only Changes

**Scope:** `src/compiler/ring3.ts`, `src/compiler/helpers.ts`
**Impact:** ~70% of the quality improvement. Zero type changes, zero UI changes.

### A1: POV_INTERIORITY Section

A new Ring 3 section that sends the POV character's internal world. Content scales by `ScenePlan.povDistance`:

| POV Distance | Content Included |
|-------------|-----------------|
| `intimate` / `close` | Backstory + self-narrative + contradictions + all 5 behavior fields |
| `moderate` | Contradictions + all 5 behavior fields |
| `distant` | Behavior fields only (observational, no inner thoughts) |

**Format:**

```
=== POV INTERIORITY: ELENA ===
Backstory:
- Grew up in coastal Oregon logging town
- Left for college at 17, never went back

Self-narrative: Believes she is someone who makes hard choices cleanly.

Contradictions (show through action, never state directly):
- Sees herself as decisive, but avoids confrontation with family
- Claims independence, but checks her mother's approval

Behavior:
- Notices first: Exits and sharp objects
- Social posture: Deflects with humor, controls seating position
- Lying style: Partial truths wrapped in real emotion
- Under stress: Goes still, voice drops
- Body shows emotion: Jaw tension, hand-to-collarbone gesture
```

**Implementation:**

Add `formatPovInteriority(char: CharacterDossier, povDistance: string): string` to `helpers.ts`. In `ring3.ts`, call it for the POV character and emit as a `RingSection` with:

- **Name:** `POV_INTERIORITY`
- **Priority:** 0 (immune at `intimate`/`close`), 2 (compressible at `moderate`/`distant`)
- **Token cap:** 220 tokens max
- **Guardrail text appended:** `"Show contradictions through action, choice, and voice slippage — never state them directly. Do not invent backstory or appearance beyond what is provided."`

### A2: Full CharacterBehavior

Extend `formatBehavior()` in `helpers.ts` to include the 3 missing fields:

```typescript
// Current (2 fields):
if (b.emotionPhysicality) behaviorParts.push(`Body shows emotion: ${b.emotionPhysicality}`);
if (b.stressResponse) behaviorParts.push(`Under stress: ${b.stressResponse}`);

// Add:
if (b.socialPosture) behaviorParts.push(`Social posture: ${b.socialPosture}`);
if (b.noticesFirst) behaviorParts.push(`Notices first: ${b.noticesFirst}`);
if (b.lyingStyle) behaviorParts.push(`Lying style: ${b.lyingStyle}`);
```

No priority or budget changes — these fields are part of existing `VOICE_*` sections (already immune). Adds ~25 tokens per character when populated.

### A3: Location Description

Extend `formatSensoryPalette()` in `helpers.ts` to include `Location.description`:

```typescript
export function formatSensoryPalette(location: Location): string {
  const lines: string[] = [`=== LOCATION: ${location.name} ===`];
  if (location.description) lines.push(location.description);  // NEW
  // ... existing palette fields ...
}
```

Token cap: 70 tokens for the description line (truncate if longer). The `SENSORY_PALETTE` section stays at Priority 4 (compressible).

---

## Phase B: Scene Cast

**Scope:** Types, compiler, bootstrap prompts, UI
**Impact:** ~25% of the quality improvement. Requires a new field on `ScenePlan`.

### B1: `presentCharacterIds` on ScenePlan

Add to the `ScenePlan` interface in `src/types/scene.ts`:

```typescript
presentCharacterIds: string[];  // All characters physically present
```

**Backward compatibility:** Factory function `createEmptyScenePlan()` sets default `[]`. All consumers use `plan.presentCharacterIds ?? []`. When empty, fall back to current behavior (speaking characters only).

**Relationship to existing fields:**
- `povCharacterId` — always implicitly present
- `dialogueConstraints` keys — always implicitly present (they speak)
- `presentCharacterIds` — the superset: includes non-speaking characters too

### B2: SCENE_CAST Section

A new Ring 3 section listing who is physically in the scene, with a spotlight strategy:

| Level | Characters | Detail | Tokens |
|-------|-----------|--------|--------|
| **Foreground** | POV + characters in `dialogueConstraints` | Full voice fingerprint, physical description, relationship to POV | 80–120 per character |
| **Background** | In `presentCharacterIds` but not speaking | Name + role + 1–2 line physical/behavioral cue | 20–30 per character |

**Hard cap:** 6 characters in foreground detail. Beyond 6, degrade to name-only stubs.

**Section properties:**
- **Name:** `SCENE_CAST`
- **Priority:** 2 (compressible — characters can be trimmed before voice fingerprints)
- **Guardrail text:** `"Only characters listed in SCENE_CAST should appear, speak, or act. Introduce at most 1–2 new physical details per character per chunk."`

**Implementation:**

Add `buildSceneCast(plan: ScenePlan, bible: Bible): RingSection` to `ring3.ts`. It:
1. Merges `presentCharacterIds`, `dialogueConstraints` keys, and `povCharacterId` into a deduplicated cast list
2. Classifies each as foreground or background
3. Formats foreground characters with full detail (physical description + voice + behavior)
4. Formats background characters with degraded detail (name + role + defining cue)
5. Enforces the 6-character foreground cap

### B3: Bootstrap Prompt Update

Update `src/bootstrap/sceneBootstrap.ts` to include `presentCharacterIds` in the scene generation prompt, so that the LLM populates the field when auto-generating scene plans.

### B4: UI — Character Multi-Select

Add a character multi-select to `src/app/components/SceneAuthoringModal.svelte` for `presentCharacterIds`. Pre-populate from `dialogueConstraints` keys + `povCharacterId`. Users can add non-speaking characters from the bible's character list.

---

## Phase C: Deferred

Lower priority. Implement after Phase A and B are validated in practice.

### C1: Scene Recap via `Chunk.keyBeats`

Add `keyBeats: string[]` to the chunk data model. After each chunk is accepted, the user (or an auto-summarizer) records 2–3 key beats. Ring 3 assembles these into a `SCENE_RECAP` section for subsequent chunks.

- **Priority:** 3 (compressible)
- **Token cap:** 60–90 tokens
- **Solves:** Gap #8 — multi-chunk scene continuity

### C2: World Context via `NarrativeRules.worldContext`

Add `worldContext: string | null` to `NarrativeRules` (Ring 1). Covers: time period, technology level, social norms, magic system — anything that constrains the story world.

- **Priority:** 5 (early compression target — cut before character data)
- **Token cap:** 120–180 tokens (prevent "lore dumps")

---

## Phase D: Emergent Character Integration

**Scope:** Auditor, learner, types, compiler, UI
**Impact:** Closes the loop — characters that emerge during generation are captured back into the bible.
**Prerequisite:** Phase B (SCENE_CAST must exist for detection context)

### Problem

Claude introduces emergent characters in ~10–15% of chunks even with SCENE_CAST guardrails (see Appendix A). These are usually scene-dynamics characters (a shopkeeper, a nurse, a guard) rather than hallucinations. Without a capture mechanism, they exist in prose but never enter the bible — creating continuity drift across subsequent scenes.

### D1: Auditor — Unknown Character Detection

Add `checkUnknownCharacters(prose, bible, sceneId)` to `runAudit()` in `src/auditor/index.ts`. This runs alongside existing checks (kill list, sentence variance, epistemic leaks).

**Detection strategy — Haiku Reflector (not heuristics):**

Deterministic NER (regex, `compromise.js`) achieves ~50–70% accuracy in fiction due to invented names, capitalized common nouns ("River", "Hunter", "Joy"), and sentence-start artifacts. Instead, use a Claude Haiku call:

- **Input:** Generated prose + known cast list (bible character names + aliases + location names)
- **Prompt:** "List all named characters who appear in this text. For each, indicate whether they are in the Known Cast. Return only unknown entities as JSON."
- **Accuracy:** ~92–98% F1 at ~$0.001/chunk
- **Fallback:** If Haiku call fails, fall back to simple dialogue-attribution pattern matching (`"...," Name said`)

The Haiku Reflector also handles:
- Alias detection ("Dr. Chen" vs existing "Dr. Emily Chen") — suggest linking, not creation
- Cameo classification (unnamed roles like "the bartender" vs proper names)
- Filtering against locations and non-person entities

**Output:** `AuditFlag` with category `"unknown_character"`, the detected name, confidence score, and evidence (surrounding sentence).

### D2: Learner — Character Stub Proposals

Extend the learner proposal pipeline to support character creation:

**New `ProposalAction` target:** `"characters.create"`

```typescript
// New proposal shape:
{
  section: "characters",
  target: "characters.create",
  value: JSON.stringify({
    name: "Marcus",
    inferredRole: "supporting",
    isCameo: false,
    sourceChunkIds: ["chunk-abc", "chunk-def"],
  })
}
```

**Extend `applyCharacterProposal()`** to handle creation (currently only modifies `vocabularyNotes` on `bible.characters[0]`):

```typescript
function applyCharacterProposal(bible: Bible, proposal: BibleProposal): void {
  const action = proposal.action;
  if (action.target === "characters.create") {
    const data = JSON.parse(action.value);
    bible.characters.push(createEmptyCharacterDossier({
      name: data.name,
      role: data.inferredRole ?? "minor",
      isCameo: data.isCameo ?? false,
    }));
  } else {
    // Existing vocabulary-update logic
  }
}
```

**Quarantine by default:** Stubs are NOT compiled into Ring 3 until the user explicitly approves them. The compiler already only reads from `dialogueConstraints` + `povCharacterId`, so unapproved stubs are naturally excluded.

**Link before create:** When detection finds a name similar to an existing character (Levenshtein distance < 3), the proposal UI suggests linking as an alias rather than creating a new entry.

**Recurrence threshold:** Auto-dismiss singleton characters that appear once and never recur in the following N chunks. Only surface proposals for characters that persist.

### D3: Cameo Type on CharacterDossier

Add `isCameo: boolean` to `CharacterDossier` (default `false`):

- **Cameo characters:** Generic role or single-mention name. Exempt from voice fingerprint, arc checks, and deep validation. Rendered as background in SCENE_CAST (name + role only). Auto-pruned if no recurrence.
- **Named characters:** Full dossier treatment. Get stub → enrichment path.

### D4: On-Demand Enrichment (Phase D2)

After a stub is created and approved, the user can click "Enrich from text" in the LearnerPanel:

1. System collects all chunks where the character name appears (`sourceChunkIds`)
2. LLM reads those chunks and extracts: physical description (1–3 cues), behavioral observations, role in scenes, any voice patterns
3. Populates a rich `BibleProposal` that the user reviews/edits before it overwrites the stub
4. User controls when this fires — no automatic enrichment

This is on-demand (not automatic) because:
- **Cost control:** Only fires when user explicitly requests
- **Intent confirmation:** If user plans to delete a hallucinated character, no wasted extraction
- **Quality control:** User curates which appearances to ingest

### D5: Inline Tag Stripping

When the SCENE_CAST guardrail uses permissive tagging (`<new_entity ... />`), the post-generation pipeline must strip these XML tags before:
- Saving prose to the database
- Feeding the chunk into `previousChunks` for subsequent generation (prevents style drift)
- Displaying to the user in the review UI

Tags are parsed during the auditor pass to feed into the Haiku Reflector as high-confidence signals.

---

## Budget Impact

### Updated Drop Order

Sections are dropped highest-priority-number first when over budget:

| Priority | Sections | Ring | Phase |
|----------|----------|------|-------|
| 6 (cut first) | `NEGATIVE_EXEMPLARS`, `POSITIVE_EXEMPLARS` | R1 | Existing |
| 5 | `METAPHORS`, `WORLD_CONTEXT` | R1 | Existing + C2 |
| 4 | `VOCABULARY`, `SENSORY_PALETTE` (now with description), `ACTIVE_SETUPS` | R1, R3, R2 | Existing + A3 |
| 3 | `SENTENCES`, `PARAGRAPHS`, `READER_STATE_ENTRY`, `UNRESOLVED_TENSIONS`, `CONTINUITY_BRIDGE`, `MICRO_DIRECTIVE`, `SCENE_RECAP` | R1, R2, R3 | Existing + C1 |
| 2 | `SCENE_CAST`, `CHAR_STATE_*`, `POV_INTERIORITY` (moderate/distant) | R3, R2 | B2 + A1 |
| 0 (immune) | `SCENE_CONTRACT`, `VOICE_*`, `ANCHOR_LINES`, `ANTI_ABLATION`, `POV_INTERIORITY` (intimate/close), `HEADER`, `NEVER_WRITE`, `STRUCTURAL_RULES`, `POV`, `NARRATIVE_RULES`, `CHAPTER_BRIEF` | All | Existing + A1 |

### Per-Section Token Caps

| Section | Cap | Notes |
|---------|-----|-------|
| `POV_INTERIORITY` | 220 tokens | Scales by POV distance |
| `SCENE_CAST` (foreground, per char) | 80–120 tokens | Max 6 foreground characters |
| `SCENE_CAST` (background, per char) | 20–30 tokens | Name + defining cue |
| Location description (within `SENSORY_PALETTE`) | 70 tokens | Truncate if longer |
| New behavior fields (combined) | ~25 tokens | Per character, within existing voice sections |
| `WORLD_CONTEXT` | 120–180 tokens | Phase C |
| `SCENE_RECAP` | 60–90 tokens | Phase C |

### Worst-Case Budget Addition

Phase A adds ~315 tokens worst-case (220 interiority + 70 location + 25 behavior). Phase B adds ~480–720 tokens (6 foreground × 80–120). Total worst-case: ~1,035 tokens — well within the Ring 3 ≥60% budget allocation for a typical 8K-token context window.

---

## Guardrails

Four guardrails prevent the expanded context from causing common LLM failure modes:

### 1. Non-Invention Rule

**Location:** Ring 1 (`STRUCTURAL_RULES` section, immune)
**Text:** `"Do not invent physical appearance, backstory, or biographical facts beyond what is provided in context."`
**Prevents:** LLM hallucinating character details not in the bible.

### 2. Interiority Constraint

**Location:** `POV_INTERIORITY` section footer
**Text:** `"Show contradictions through action, choice, and voice slippage — never state them directly."`
**Prevents:** Telling instead of showing. The LLM gets contradictions as context but must express them through behavior.

### 3. Presence Discipline (Permissive Tagging)

**Location:** `SCENE_CAST` section footer
**Text:** `"Only characters listed in SCENE_CAST should appear, speak, or act. Unnamed background characters (waiters, crowds) may exist as scenery without tagging, provided they do not speak. If scene logic absolutely requires a new named character, tag them on first mention as <new_entity name=\"X\" role=\"Y\" /> and do not give them dialogue in this chunk."`
**Prevents:** Characters teleporting into scenes while avoiding the Compliance Paradox (see Appendix A) — strict cast locks cause Claude to use passive voice and ghost actions instead of introducing necessary utility characters.

**Note:** The guardrail text itself must remain **immune** (priority 0) even when `SCENE_CAST` character blurbs are compressed. If the guardrail is removed by budget pressure, cast compliance drops significantly. Implement this by splitting `SCENE_CAST` into two sub-sections: the guardrail text (immune) and the character blurbs (priority 2, compressible).

### 4. Descriptor Introduction Limit

**Location:** `SCENE_CAST` section footer
**Text:** `"Introduce at most 1–2 new physical details per character per chunk. Do not front-load descriptions."`
**Prevents:** "Description dump" on character entrance — a common LLM failure mode when given full physical descriptions.

---

## Files Modified

### Phase A (compiler-only)

| File | Change |
|------|--------|
| `src/compiler/helpers.ts` | Add `formatPovInteriority()`. Extend `formatBehavior()` with 3 missing fields. Add `location.description` to `formatSensoryPalette()`. |
| `src/compiler/ring3.ts` | Call `formatPovInteriority()` for POV character. Emit `POV_INTERIORITY` section with distance-based priority. |

### Phase B (scene cast)

| File | Change |
|------|--------|
| `src/types/scene.ts` | Add `presentCharacterIds: string[]` to `ScenePlan` |
| `src/types/index.ts` | Update `createEmptyScenePlan()` default |
| `src/compiler/ring3.ts` | Add `buildSceneCast()`. Emit `SCENE_CAST` section. |
| `src/compiler/helpers.ts` | Add `formatForegroundCharacter()`, `formatBackgroundCharacter()` |
| `src/bootstrap/sceneBootstrap.ts` | Include `presentCharacterIds` in generation prompt |
| `src/app/components/SceneAuthoringModal.svelte` | Character multi-select for `presentCharacterIds` |
| `server/db/repositories/scene.ts` | Persist `presentCharacterIds` (JSON column, existing pattern) |
| `server/api/scenes.ts` | Include field in scene CRUD endpoints |

### Phase C (deferred)

| File | Change |
|------|--------|
| `src/types/chunk.ts` or `index.ts` | Add `keyBeats: string[]` to chunk type |
| `src/types/bible.ts` or `index.ts` | Add `worldContext: string \| null` to `NarrativeRules` |
| `src/compiler/ring3.ts` | Build `SCENE_RECAP` from chunk key beats |
| `src/compiler/ring1.ts` | Build `WORLD_CONTEXT` section |
| DB migration | New columns for `keyBeats` and `worldContext` |

### Phase D (emergent character integration)

| File | Change |
|------|--------|
| `src/auditor/index.ts` | Add `checkUnknownCharacters()` to `runAudit()` pipeline |
| `src/auditor/unknownCharacters.ts` | New file: Haiku Reflector call, tag parsing, alias matching |
| `src/learner/proposals.ts` | Extend `applyCharacterProposal()` for `characters.create`. Add stub proposal generation. |
| `src/types/bible.ts` or `index.ts` | Add `isCameo: boolean` to `CharacterDossier`. Add `aliases: string[]` to `CharacterDossier`. |
| `src/types/index.ts` | Update `createEmptyCharacterDossier()` factory with `isCameo` and `aliases` defaults |
| `src/compiler/ring3.ts` | Split SCENE_CAST into immune guardrail sub-section + compressible character blurbs |
| `src/app/components/LearnerPanel.svelte` | "Enrich from text" button on stub dossiers. Link-before-create UI for alias suggestions. |
| `server/db/repositories/bible.ts` | Persist `isCameo` and `aliases` fields |
| `server/api/bibles.ts` | Include new fields in bible CRUD endpoints |

---

## Testing

New test cases following the established mirror pattern (`tests/compiler/*.test.ts`):

### Phase A Tests

| Test | File | Validates |
|------|------|-----------|
| `formatPovInteriority` — intimate distance | `tests/compiler/helpers.test.ts` | All fields included: backstory, self-narrative, contradictions, all 5 behavior fields |
| `formatPovInteriority` — moderate distance | `tests/compiler/helpers.test.ts` | Only contradictions + behavior (no backstory/self-narrative) |
| `formatPovInteriority` — distant distance | `tests/compiler/helpers.test.ts` | Behavior fields only |
| `formatPovInteriority` — null fields | `tests/compiler/helpers.test.ts` | Graceful degradation when fields are null |
| `formatPovInteriority` — token cap | `tests/compiler/helpers.test.ts` | Output truncated at 220 tokens |
| `formatBehavior` — all 5 fields | `tests/compiler/helpers.test.ts` | socialPosture, noticesFirst, lyingStyle now appear |
| `formatSensoryPalette` — with description | `tests/compiler/helpers.test.ts` | Description appears before palette fields |
| `formatSensoryPalette` — null description | `tests/compiler/helpers.test.ts` | No change from current behavior |
| Ring 3 builds `POV_INTERIORITY` section | `tests/compiler/ring3.test.ts` | Section present with correct priority and immune flag |
| Guardrail text present in interiority | `tests/compiler/ring3.test.ts` | Footer text about contradictions included |

### Phase B Tests

| Test | File | Validates |
|------|------|-----------|
| `buildSceneCast` — foreground + background | `tests/compiler/ring3.test.ts` | Speaking chars get full detail, non-speaking get degraded |
| `buildSceneCast` — 6-character cap | `tests/compiler/ring3.test.ts` | 7th foreground character degrades to stub |
| `buildSceneCast` — empty presentCharacterIds | `tests/compiler/ring3.test.ts` | Falls back to speaking-only (backward compat) |
| Presence guardrail in output | `tests/compiler/ring3.test.ts` | Footer text about cast discipline included |
| `presentCharacterIds` factory default | `tests/types.test.ts` | `createEmptyScenePlan()` returns `[]` |

### Phase D Tests

| Test | File | Validates |
|------|------|-----------|
| `checkUnknownCharacters` — detects new name | `tests/auditor/unknownCharacters.test.ts` | Flags character not in bible cast list |
| `checkUnknownCharacters` — ignores known characters | `tests/auditor/unknownCharacters.test.ts` | No flag for characters in bible |
| `checkUnknownCharacters` — ignores locations | `tests/auditor/unknownCharacters.test.ts` | Location names not flagged as characters |
| `checkUnknownCharacters` — alias suggestion | `tests/auditor/unknownCharacters.test.ts` | "Dr. Chen" suggests linking to existing "Dr. Emily Chen" |
| `applyCharacterProposal` — creates stub | `tests/learner/proposals.test.ts` | New CharacterDossier added to bible with name and role |
| `applyCharacterProposal` — cameo flag | `tests/learner/proposals.test.ts` | `isCameo: true` set correctly on cameo characters |
| `applyCharacterProposal` — backward compat | `tests/learner/proposals.test.ts` | Existing vocabulary-update behavior unchanged |
| Inline tag stripping | `tests/auditor/unknownCharacters.test.ts` | `<new_entity>` tags removed from prose before storage |
| SCENE_CAST guardrail immune split | `tests/compiler/ring3.test.ts` | Guardrail text survives budget compression even when character blurbs are removed |
| Stub excluded from compiler | `tests/compiler/ring3.test.ts` | Unapproved stubs not included in Ring 3 voice fingerprints |

---

## Migration

**Phase A:** Zero migration. All data already exists in the model. `formatPovInteriority()` reads fields that are already on `CharacterDossier`. `formatSensoryPalette()` reads `Location.description` which already exists. Null fields produce no output — fully backward compatible.

**Phase B:** `presentCharacterIds` is a new field on `ScenePlan`.
- **TypeScript:** Factory function returns `[]`. All consumers use `plan.presentCharacterIds ?? []`.
- **Database:** Store as JSON text column (existing pattern for array fields). Default `'[]'`.
- **Existing scenes:** Empty array triggers fallback to current behavior (speaking characters only).
- **No destructive migration.** New column with default value; existing rows unaffected.

**Phase C:** Requires DB schema changes for `keyBeats` and `worldContext`. Design deferred until Phase B is validated.

**Phase D:** Adds two new fields to `CharacterDossier` and a new auditor module.
- **TypeScript:** `isCameo: boolean` (default `false`) and `aliases: string[]` (default `[]`) on `CharacterDossier`. Factory function `createEmptyCharacterDossier()` supplies defaults. All existing characters gain defaults via `?? false` / `?? []`.
- **Database:** Two new columns on the characters table: `is_cameo` (boolean, default 0) and `aliases` (JSON text, default `'[]'`). Existing rows unaffected.
- **New file:** `src/auditor/unknownCharacters.ts` — no migration needed, purely additive.
- **Haiku API dependency:** Phase D requires a Claude Haiku API call in the auditor pipeline. This is gated behind the existing `llm/` module configuration. If no API key is configured, the Haiku Reflector gracefully degrades to the dialogue-attribution fallback.
- **Proposal pipeline:** `applyCharacterProposal()` gains a new code path for `characters.create` — existing `vocabularyNotes` behavior is the `else` branch, fully backward compatible.
- **No destructive migration.** All additions are nullable/defaulted.

---

## Appendix A: Claude Behavior Research

Research into how Claude models handle cast locking, emergent characters, and inline tagging. These findings inform the design decisions in Phases B–D.

### Cast Lock Compliance

When given a strict cast lock (`"Only these characters may appear"`), Claude Sonnet/Opus comply ~85–90% of the time. The remaining 10–15% introduces emergent characters that are typically scene-dynamics roles (a shopkeeper, a nurse, a guard) rather than hallucinations — they serve legitimate narrative function.

### The Compliance Paradox

Strict cast bans don't eliminate emergent characters — they cause **worse prose**. When forbidden from introducing any new characters, Claude resorts to:

- **Passive voice abuse:** "The door was opened" instead of "The doorman opened the door"
- **Ghost actions:** Events happen without agents ("A tray of drinks appeared")
- **Stilted scene dynamics:** Conversations occur in empty rooms; service roles vanish

This is worse than allowing tagged emergent characters, because the prose quality degrades without actually preventing the underlying need for utility characters.

### Permissive Tagging Compliance

When given permissive tagging instructions (`"Tag new characters with <new_entity ... />"` instead of banning them), Claude Sonnet achieves:

- **~95% tagging compliance** when using XML-style tags (`<new_entity>`)
- **~75–80% compliance** with bracket-style tags (`[[NEW: Name]]`)
- Tags appear naturally in prose flow without disrupting voice

**Key insight:** XML tags outperform brackets because Claude's training includes extensive XML/HTML generation. Brackets are more likely to be interpreted as editorial annotations and dropped.

### Haiku Reflector Accuracy

Using Claude Haiku as a post-generation NER pass to detect unknown characters:

| Method | Precision | Recall | F1 | Cost/chunk |
|--------|-----------|--------|----|-----------|
| Regex NER | ~70% | ~50% | ~58% | $0 |
| `compromise.js` NER | ~75% | ~65% | ~70% | $0 |
| Claude Haiku (Reflector) | ~96% | ~94% | ~95% | ~$0.001 |
| Claude Haiku (Self-report) | ~98% | ~92% | ~95% | ~$0.001 |

The Haiku Reflector dramatically outperforms deterministic NER in fiction because:
- Fiction contains invented names that don't appear in any NER training set
- Capitalized common nouns ("River", "Hunter", "Joy") cause false positives in regex
- Sentence-start position creates capitalization ambiguity
- Haiku understands narrative context — it can distinguish "River" the character from "the river"

### Prompt Engineering Strategies

Based on compliance testing:

1. **Use XML tags, not brackets.** `<new_entity name="X" role="Y" />` achieves higher compliance than `[[NEW: X | Y]]` because Claude is better trained on XML generation patterns.

2. **Ambient exemption for unnamed background.** Allow unnamed background characters (waiters, crowds, passersby) without tagging, as long as they don't speak or take named actions. This prevents the Compliance Paradox for the most common case (scene-setting).

3. **Strip tags before context history.** When storing prose or feeding it back as `previousChunks`, strip `<new_entity>` tags to prevent style contamination. Tags are metadata, not prose.

4. **No-dialogue rule for emergent characters.** Requiring that tagged emergent characters cannot speak in the chunk where they're introduced gives the author control over voice — the character exists in the scene but doesn't get voice until the author approves the stub and assigns voice fingerprint constraints.

5. **Split immune guardrails from compressible data.** The SCENE_CAST guardrail text must be immune (priority 0) even when the character blurbs it governs are compressible (priority 2). If budget pressure removes the guardrail, cast compliance drops to near-zero.
