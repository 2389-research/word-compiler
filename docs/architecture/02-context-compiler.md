# Context Compiler

The context compiler transforms a Bible, chapter arc, scene plan, and prior prose into a structured LLM prompt. It operates in three concentric rings, each adding progressively more scene-specific context.

## Three-Ring Architecture

### Ring 1 — System Message (`src/compiler/ring1.ts`)

The identity and rules layer. Built entirely from the Bible and compilation config.

**Sections** (in priority order):
| Section | Content | Immune |
|---------|---------|--------|
| `HEADER` | Model identity + preamble | Yes |
| `BIBLE_VOICE` | Voice profile, sentence architecture, paragraph policy | No |
| `BIBLE_CHARACTERS` | Character dossiers with voice notes | No |
| `BIBLE_LOCATIONS` | Location palettes with sensory details | No |
| `BIBLE_RULES` | Narrative rules (POV, subtext, exposition) | No |
| `BIBLE_KILLLIST` | Avoid list (exact + structural bans) | No |

`buildRing1(bible, config)` returns `{ sections: RingSection[], totalTokens }`.

### Ring 2 — Chapter Context (`src/compiler/ring2.ts`)

The chapter-level continuity layer. Carries context between scenes.

**Sections**:
| Section | Content | Source |
|---------|---------|--------|
| `CHAPTER_ARC` | Working title, narrative function, pacing target | `ChapterArc` |
| `PREVIOUS_SCENE_SUMMARY` | Events and deltas from completed scenes | Verified `NarrativeIR` |
| `READER_STATE` | What the reader knows, suspects, is wrong about | `ChapterArc.readerStateEntering` |
| `NARRATIVE_IR_CONTEXT` | Cross-scene facts and unresolved tensions | Accumulated IR |

`buildRing2(chapterArc, completedScenes, sceneIRs, config)` returns `{ sections, totalTokens }`.

### Ring 3 — Scene Context (`src/compiler/ring3.ts`)

The scene-specific layer. Contains the immediate writing context.

**Sections**:
| Section | Content |
|---------|---------|
| `SCENE_PLAN` | Scene contract (goal, beats, POV, constraints) |
| `ANTI_ABLATION` | Failure modes and anchor lines |
| `PROSE_SO_FAR` | Canonical text from all prior chunks in this scene |
| `CONTINUITY_BRIDGE` | Last chunk from previous scene (cross-scene continuity) |
| `SENSORY_PALETTE` | Location-specific sensory details (if location set) |

`buildRing3(scenePlan, chunks, previousSceneLastChunk, bible, config)` returns `{ sections, totalTokens }`.

## Budget Enforcement (`src/compiler/budget.ts`)

The budget enforcer ensures the total prompt fits within the model's context window minus the output reservation.

**Algorithm**:
1. Sum all section tokens across all three rings
2. If total <= available budget, return unchanged
3. Otherwise, compress by removing non-immune sections in priority order:
   - Ring 1 sections (lowest priority first)
   - Ring 2 sections
   - Ring 3 sections (compressed last — most critical)

`enforceBudget(ring1, ring2, ring3, availableBudget)` returns `{ ring1, ring2, ring3, totalTokens, sectionsRemoved }`.

## Assembly (`src/compiler/assembler.ts`)

The assembler orchestrates the full compilation pipeline.

`compilePayload(bible, chapterArc, scenePlan, chunks, previousSceneLastChunk, completedScenes, sceneIRs, config)`:
1. Build Ring 1, 2, 3
2. Enforce budget
3. Assemble sections into system message + user message strings
4. Lint the assembled payload
5. Return `CompiledPayload` with both messages + model parameters

## Helper Functions (`src/compiler/helpers.ts`)

| Function | Purpose |
|----------|---------|
| `formatSceneContract` | Scene plan → structured text block |
| `formatCharacterVoice` | Character dossier → voice notes text |
| `formatSensoryPalette` | Location → sensory detail text |
| `formatAntiAblation` | Scene plan → failure modes + anchor lines |
| `assembleSections` | `RingSection[]` → joined text string |

## Key Type: `RingSection`

```typescript
interface RingSection {
  name: string;       // e.g. "BIBLE_VOICE"
  content: string;    // The actual text
  tokens: number;     // Token count (words * 1.3)
  priority: number;   // Lower = compressed first
  immune: boolean;    // If true, never compressed
}
```
