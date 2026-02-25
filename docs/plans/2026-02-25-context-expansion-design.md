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

### 3. Presence Discipline

**Location:** `SCENE_CAST` section footer
**Text:** `"Only characters listed in SCENE_CAST should appear, speak, or act in this chunk."`
**Prevents:** Characters teleporting into scenes. Particularly important for non-speaking characters who should be ambient, not suddenly taking action.

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

---

## Migration

**Phase A:** Zero migration. All data already exists in the model. `formatPovInteriority()` reads fields that are already on `CharacterDossier`. `formatSensoryPalette()` reads `Location.description` which already exists. Null fields produce no output — fully backward compatible.

**Phase B:** `presentCharacterIds` is a new field on `ScenePlan`.
- **TypeScript:** Factory function returns `[]`. All consumers use `plan.presentCharacterIds ?? []`.
- **Database:** Store as JSON text column (existing pattern for array fields). Default `'[]'`.
- **Existing scenes:** Empty array triggers fallback to current behavior (speaking characters only).
- **No destructive migration.** New column with default value; existing rows unaffected.

**Phase C:** Requires DB schema changes for `keyBeats` and `worldContext`. Design deferred until Phase B is validated.
