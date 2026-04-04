# Context Compiler

The context compiler transforms a Bible, chapter arc, scene plan, and prior prose into a structured LLM prompt. It operates in three concentric rings, each adding progressively more scene-specific context.

## Three-Ring Architecture

### Ring 1 — System Message (`src/compiler/ring1.ts`)

The identity and rules layer. Built entirely from the Bible and compilation config.

**Sections** (in priority order):
| Section | Content | Immune |
|---------|---------|--------|
| `HEADER` | Project voice preamble | Yes |
| `METAPHORS` | Metaphoric register (approved/prohibited domains) | No |
| `VOCABULARY` | Vocabulary preferences (preferred vs. avoided words) | No |
| `SENTENCES` | Sentence architecture (variance, fragment policy) | No |
| `PARAGRAPHS` | Paragraph policy (max sentences, single-sentence frequency) | No |
| `NEVER_WRITE` | Kill list — exact word bans | Yes |
| `STRUCTURAL_RULES` | Structural bans | Yes |
| `NEGATIVE_EXEMPLARS` | Anti-voice examples ("do not sound like this") | No |
| `POSITIVE_EXEMPLARS` | Voice examples ("the voice sounds like this") | No |
| `POV` | POV rules (default, distance, interiority, reliability) | Yes |
| `NARRATIVE_RULES` | Narrative rules (subtext, exposition, scene endings) | Yes |
| `AUTHOR_VOICE` | Voice guide injection (when available) | No |

`buildRing1(bible, config)` returns `{ sections: RingSection[], totalTokens }`.

### Ring 2 — Chapter Context (`src/compiler/ring2.ts`)

The chapter-level continuity layer. Carries context between scenes.

**Sections**:
| Section | Content | Source |
|---------|---------|--------|
| `CHAPTER_BRIEF` | Working title, narrative function, register, pacing, ending posture | `ChapterArc` |
| `READER_STATE_ENTRY` | What the reader knows, suspects, is wrong about, active tensions | `ChapterArc.readerStateEntering` |
| `ACTIVE_SETUPS` | Planned/planted setups from the Bible | `Bible.narrativeRules.setups` |
| `CHAR_STATE_{id}` | Per-character cumulative state from IR deltas (one section per character) | Verified `NarrativeIR` |
| `UNRESOLVED_TENSIONS` | Unresolved tensions from last verified scene IR | Verified `NarrativeIR` |

`buildRing2(chapterArc, completedScenes, sceneIRs, config)` returns `{ sections, totalTokens }`.

### Ring 3 — Scene Context (`src/compiler/ring3.ts`)

The scene-specific layer. Contains the immediate writing context.

**Sections**:
| Section | Content |
|---------|---------|
| `SCENE_CONTRACT` | Scene contract (goal, beats, POV, constraints) |
| `VOICE_{name}` | Per-character voice fingerprints for speaking characters (immune) |
| `POV_INTERIORITY` | POV character interiority guidance (immune for intimate/close) |
| `SENSORY_PALETTE` | Location-specific sensory details (if location set) |
| `SENSORY_GUARDRAIL` | Sensory invention guardrail (immune) |
| `SCENE_CAST_GUARDRAIL` | Only listed characters may appear (immune) |
| `SCENE_CAST` | Non-speaking present characters |
| `ANCHOR_LINES` | Human-authored anchor lines with placement (immune) |
| `CONTINUITY_BRIDGE` | Last chunk verbatim text (within-scene or cross-scene) |
| `CONTINUITY_BRIDGE_STATE` | IR state bullets at scene entry (cross-scene only) |
| `ANTI_ABLATION` | Failure modes and anchor lines (immune) |
| `MICRO_DIRECTIVE` | Human notes from previous chunk (immune) |

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
