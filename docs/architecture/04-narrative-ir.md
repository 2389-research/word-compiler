# Narrative Intermediate Representation (IR)

The narrative IR captures the *meaning* of a scene — events that happened, facts introduced, character knowledge changes, and narrative setups/payoffs — in a structured format that enables cross-scene continuity tracking.

## Purpose

Raw prose is opaque to the system. The IR makes narrative content machine-readable so that:
- Ring 2 can include relevant facts from prior scenes
- Setup/payoff tracking can detect dangling threads
- The forward simulator can project reader state
- Style drift can be measured across scenes

## Schema (`NarrativeIR` in `src/types/index.ts`)

```typescript
interface NarrativeIR {
  sceneId: string;
  events: string[];                    // What happened (chronological)
  factsIntroduced: string[];           // New information entered the story
  factsRevealedToReader: string[];     // What the reader now knows
  factsWithheld: string[];             // What the reader doesn't know yet
  characterDeltas: CharacterDelta[];   // How characters changed
  unresolvedTensions: string[];        // Open questions / hooks
  setupsPlanted: string[];             // Narrative setups for future payoff
  payoffsExecuted: string[];           // Payoffs of earlier setups
  verified: boolean;                   // Author has confirmed accuracy
}

interface CharacterDelta {
  characterId: string;
  learned: string | null;
  suspicionGained: string | null;
  emotionalShift: string | null;
  relationshipChange: string | null;
}
```

## Extraction (`src/ir/extractor.ts`)

The extractor sends the scene's canonical prose to the LLM with a structured extraction prompt. The prompt asks the model to produce JSON matching the `NarrativeIR` schema.

`extractNarrativeIR(prose, scenePlan, sceneId)` → `Promise<NarrativeIR>`

The extraction prompt includes:
- The full scene prose
- The scene plan (for context)
- A JSON schema example
- Instructions to be exhaustive about events, facts, and deltas

## Parsing (`src/ir/parser.ts`)

The parser uses a 3-tier fallback strategy to handle LLM output:

1. **Direct JSON parse** — try `JSON.parse()` on the raw response
2. **Code fence extraction** — find JSON inside ````json ... ``` `` blocks
3. **Regex extraction** — find the largest `{...}` block in the response

`parseIRResponse(raw, sceneId)` → `NarrativeIR | { error: string }`

## Verification Workflow

1. IR is extracted from scene prose (status: `verified: false`)
2. The IR Inspector UI shows events, facts, deltas, setups
3. The author reviews and confirms or edits
4. Author marks as verified (status: `verified: true`)
5. Only verified IR is used in Ring 2 context and cross-scene bridging

## Cross-Scene Bridge

The continuity bridge (`CONTINUITY_BRIDGE` section in Ring 3) passes the last chunk of the previous scene into Ring 3 of the current scene. This ensures prose continuity across scene boundaries.

Additionally, Ring 2 accumulates verified IR from all completed scenes, building a growing picture of:
- All facts introduced so far
- All character knowledge changes
- Unresolved tensions from prior scenes
- Setups that haven't been paid off yet

## Key Files

| File | Purpose |
|------|---------|
| `src/ir/extractor.ts` | LLM extraction prompt + streaming call |
| `src/ir/parser.ts` | 3-tier JSON fallback parser |
| `src/types/index.ts` | `NarrativeIR`, `CharacterDelta` types |
| `src/auditor/setup-payoff.ts` | Cross-scene setup/payoff analysis |
