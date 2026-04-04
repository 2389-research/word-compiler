# Context Expansion Implementation Plan

> **Historical document.** This implementation plan was written during active development and references AI model consultations used during the design review process.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire existing character/location data through the context compiler (Phase A) and add scene cast support (Phase B), closing 7 of 8 context gaps identified in the design doc.

**Architecture:** Phase A adds 3 helpers and extends 2 existing ones — pure compiler wiring, no type or DB changes. Phase B adds `presentCharacterIds` to `ScenePlan`, threads it through types → compiler → server → bootstrap → UI. TDD throughout, frequent commits.

**Tech Stack:** TypeScript strict, Vitest, Svelte 5 runes, Express, better-sqlite3

**Design Doc:** `docs/plans/2026-02-25-context-expansion-design.md`

**Reviewed by:** GPT-5-Codex (against), GPT-5 (for), o3 (neutral) — consensus applied

---

## Phase A: Compiler-Only Changes

### Task 1: Extend `formatBehavior()` with 3 missing fields

**Files:**
- Modify: `src/compiler/helpers.ts` (the `formatBehavior` function, lines 79-87)
- Test: `tests/compiler/helpers.test.ts`

**Context:** `formatBehavior(char: CharacterDossier): string[]` currently sends only `emotionPhysicality` and `stressResponse`. Three fields exist on `CharacterBehavior` but are never compiled: `socialPosture`, `noticesFirst`, `lyingStyle`. The function is NOT exported and takes a full `CharacterDossier`, not `CharacterBehavior`. It returns `string[]` (not `string`), which gets spread into `formatCharacterVoice()` via `lines.push(...formatBehavior(char))`.

**Step 1: Write the failing test**

In `tests/compiler/helpers.test.ts`, add inside the existing describe block. Since `formatBehavior` is not exported, test through `formatCharacterVoice`:

```typescript
import { createEmptyCharacterDossier } from "../../src/types/bible.js";

describe("formatCharacterVoice — behavior fields", () => {
  it("includes all 5 behavior fields when populated", () => {
    const char = createEmptyCharacterDossier("Elena");
    char.behavior = {
      emotionPhysicality: "Jaw tension, hand-to-collarbone",
      stressResponse: "Goes still, voice drops",
      socialPosture: "Deflects with humor",
      noticesFirst: "Exits and sharp objects",
      lyingStyle: "Partial truths wrapped in real emotion",
    };
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("Body shows emotion: Jaw tension");
    expect(result).toContain("Under stress: Goes still");
    expect(result).toContain("Social posture: Deflects with humor");
    expect(result).toContain("Notices first: Exits and sharp objects");
    expect(result).toContain("Lying style: Partial truths");
  });

  it("omits null behavior fields gracefully", () => {
    const char = createEmptyCharacterDossier("Bob");
    char.behavior = {
      emotionPhysicality: "Clenches fists",
      stressResponse: null,
      socialPosture: null,
      noticesFirst: "Windows",
      lyingStyle: null,
    };
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("Body shows emotion: Clenches fists");
    expect(result).toContain("Notices first: Windows");
    expect(result).not.toContain("Under stress");
    expect(result).not.toContain("Social posture");
    expect(result).not.toContain("Lying style");
  });

  it("still works when behavior is null", () => {
    const char = createEmptyCharacterDossier("Ghost");
    char.behavior = null;
    const result = formatCharacterVoice(char, []);
    expect(result).toContain("GHOST — VOICE");
    expect(result).not.toContain("Body shows emotion");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: FAIL — new behavior fields not in output.

**Step 3: Write minimal implementation**

In `src/compiler/helpers.ts`, find `formatBehavior()` (lines 79-87) and add after the existing `stressResponse` line:

```typescript
if (b.socialPosture) behaviorParts.push(`Social posture: ${b.socialPosture}`);
if (b.noticesFirst) behaviorParts.push(`Notices first: ${b.noticesFirst}`);
if (b.lyingStyle) behaviorParts.push(`Lying style: ${b.lyingStyle}`);
```

Do NOT change the function signature — it stays as `function formatBehavior(char: CharacterDossier): string[]`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/compiler/helpers.ts tests/compiler/helpers.test.ts
git commit -m "feat: send all 5 CharacterBehavior fields through compiler"
```

---

### Task 2: Add `location.description` to `formatSensoryPalette()`

**Files:**
- Modify: `src/compiler/helpers.ts` (the `formatSensoryPalette` function, lines 106-120)
- Test: `tests/compiler/helpers.test.ts`

**Context:** `formatSensoryPalette(location: Location): string` reads `sounds`, `smells`, `textures`, `lightQuality`, `atmosphere`, `prohibitedDefaults` but ignores `Location.description`. Per design doc, description should be capped at 70 tokens to prevent bloat.

**Step 1: Write the failing test**

```typescript
import { createEmptyLocation } from "../../src/types/bible.js";

describe("formatSensoryPalette", () => {
  it("includes location description when present", () => {
    const location = createEmptyLocation("Diner");
    location.description = "A cramped diner with cracked vinyl booths and a counter sticky with decades of spilled coffee.";
    const result = formatSensoryPalette(location);
    expect(result).toContain("cramped diner");
    // Description should appear after the header
    const headerIndex = result.indexOf("=== LOCATION:");
    const descIndex = result.indexOf("cramped diner");
    expect(descIndex).toBeGreaterThan(headerIndex);
  });

  it("omits description line when null", () => {
    const location = createEmptyLocation("Park");
    location.description = null;
    const result = formatSensoryPalette(location);
    expect(result).toContain("=== LOCATION:");
    expect(result).not.toContain("null");
  });

  it("truncates very long descriptions", () => {
    const location = createEmptyLocation("Castle");
    location.description = "Word ".repeat(200); // Way over 70 tokens
    const result = formatSensoryPalette(location);
    // Should still be present but not excessively long
    expect(result).toContain("Word");
    // Rough check: truncated text should be much shorter than the full 200-word string
    const descLine = result.split("\n").find((l) => l.includes("Word"));
    expect(descLine!.length).toBeLessThan(location.description.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: FAIL — description not in output.

**Step 3: Write minimal implementation**

In `formatSensoryPalette()`, add after the header line (`=== LOCATION: ${location.name} ===`):

```typescript
import { truncateToTokens } from "../tokens/index.js";

// Inside formatSensoryPalette, after the header line:
if (location.description) {
  lines.push(truncateToTokens(location.description, 70));
}
```

Check what `truncateToTokens` is called in the codebase — if it doesn't exist by that name, check `src/tokens/` for the actual API and adapt.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/compiler/helpers.ts tests/compiler/helpers.test.ts
git commit -m "feat: include location description in sensory palette (70-token cap)"
```

---

### Task 3: Create `formatPovInteriority()` helper

**Files:**
- Modify: `src/compiler/helpers.ts` (add new exported function)
- Test: `tests/compiler/helpers.test.ts`

**Context:** New helper that formats the POV character's internal world. Content scales by `povDistance`: intimate/close gets everything, moderate drops backstory/self-narrative, distant gets behavior only.

**CRITICAL:** `CharacterDossier.contradictions` is `string[] | null` (NOT a single string). Do NOT call `.split()` on it — iterate the array directly. The full section is capped at 220 tokens via `truncateToTokens`.

**Step 1: Write the failing tests**

```typescript
describe("formatPovInteriority", () => {
  function makeFullChar(): CharacterDossier {
    return {
      ...createEmptyCharacterDossier("Elena"),
      backstory: "Grew up in coastal Oregon logging town\nLeft for college at 17",
      selfNarrative: "Believes she is someone who makes hard choices cleanly",
      contradictions: [
        "Sees herself as decisive, but avoids confrontation",
        "Claims independence, but checks her mother's approval",
      ],
      behavior: {
        emotionPhysicality: "Jaw tension, hand-to-collarbone gesture",
        stressResponse: "Goes still, voice drops",
        socialPosture: "Deflects with humor, controls seating position",
        noticesFirst: "Exits and sharp objects",
        lyingStyle: "Partial truths wrapped in real emotion",
      },
    };
  }

  it("intimate distance includes all fields", () => {
    const result = formatPovInteriority(makeFullChar(), "intimate");
    expect(result).toContain("=== POV INTERIORITY: ELENA ===");
    expect(result).toContain("Backstory:");
    expect(result).toContain("coastal Oregon");
    expect(result).toContain("Self-narrative:");
    expect(result).toContain("hard choices cleanly");
    expect(result).toContain("Contradictions");
    expect(result).toContain("avoids confrontation");
    expect(result).toContain("Behavior:");
    expect(result).toContain("Notices first:");
    expect(result).toContain("Social posture:");
    expect(result).toContain("Lying style:");
    expect(result).toContain("Under stress:");
    expect(result).toContain("Body shows emotion:");
  });

  it("close distance includes all fields (same as intimate)", () => {
    const result = formatPovInteriority(makeFullChar(), "close");
    expect(result).toContain("Backstory:");
    expect(result).toContain("Self-narrative:");
    expect(result).toContain("Contradictions");
  });

  it("moderate distance excludes backstory and self-narrative", () => {
    const result = formatPovInteriority(makeFullChar(), "moderate");
    expect(result).not.toContain("Backstory:");
    expect(result).not.toContain("Self-narrative:");
    expect(result).toContain("Contradictions");
    expect(result).toContain("Behavior:");
  });

  it("distant distance includes only behavior", () => {
    const result = formatPovInteriority(makeFullChar(), "distant");
    expect(result).not.toContain("Backstory:");
    expect(result).not.toContain("Self-narrative:");
    expect(result).not.toContain("Contradictions");
    expect(result).toContain("Behavior:");
  });

  it("handles null fields gracefully", () => {
    const char = createEmptyCharacterDossier("Test");
    const result = formatPovInteriority(char, "intimate");
    expect(result).toContain("=== POV INTERIORITY: TEST ===");
    // Should not crash, should not contain "null"
    expect(result).not.toContain("null");
  });

  it("appends guardrail text", () => {
    const result = formatPovInteriority(makeFullChar(), "intimate");
    expect(result).toContain("Show contradictions through action");
    expect(result).toContain("Do not invent backstory");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: FAIL — `formatPovInteriority` is not defined.

**Step 3: Write minimal implementation**

Add to `src/compiler/helpers.ts`:

```typescript
export function formatPovInteriority(char: CharacterDossier, povDistance: string): string {
  const lines: string[] = [`=== POV INTERIORITY: ${char.name.toUpperCase()} ===`];
  const includeDeep = povDistance === "intimate" || povDistance === "close";
  const includeContradictions = includeDeep || povDistance === "moderate";

  if (includeDeep && char.backstory) {
    lines.push("Backstory:");
    for (const line of char.backstory.split("\n").filter(Boolean)) {
      lines.push(`- ${line.trim()}`);
    }
    lines.push("");
  }

  if (includeDeep && char.selfNarrative) {
    lines.push(`Self-narrative: ${char.selfNarrative}`);
    lines.push("");
  }

  // IMPORTANT: contradictions is string[] | null — iterate the array directly
  if (includeContradictions && Array.isArray(char.contradictions) && char.contradictions.length > 0) {
    lines.push("Contradictions (show through action, never state directly):");
    for (const c of char.contradictions) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  if (char.behavior) {
    const b = char.behavior;
    lines.push("Behavior:");
    if (b.noticesFirst) lines.push(`- Notices first: ${b.noticesFirst}`);
    if (b.socialPosture) lines.push(`- Social posture: ${b.socialPosture}`);
    if (b.lyingStyle) lines.push(`- Lying style: ${b.lyingStyle}`);
    if (b.stressResponse) lines.push(`- Under stress: ${b.stressResponse}`);
    if (b.emotionPhysicality) lines.push(`- Body shows emotion: ${b.emotionPhysicality}`);
    lines.push("");
  }

  lines.push("Show contradictions through action, choice, and voice slippage — never state them directly. Do not invent backstory or appearance beyond what is provided in context.");

  const raw = lines.join("\n");
  return truncateToTokens(raw, 220);
}
```

Import `truncateToTokens` from `../tokens/index.js` if not already imported. Check the actual export name in `src/tokens/`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/compiler/helpers.ts tests/compiler/helpers.test.ts
git commit -m "feat: add formatPovInteriority helper with POV-distance scaling"
```

---

### Task 4: Add non-invention guardrail to `NARRATIVE_RULES`

> **Note:** This was originally Task 5 but moved before the Ring 3 POV_INTERIORITY task to stabilize R1 output first.

**Files:**
- Modify: `src/compiler/ring1.ts` (the `buildNarrativeRulesSection` function, lines 124-142)
- Test: `tests/compiler/ring1.test.ts`

**Context:** Per design doc review feedback, the non-invention guardrail must go in NARRATIVE_RULES (always emitted, immune) rather than STRUCTURAL_RULES (conditional).

**CRITICAL:** `buildNarrativeRulesSection()` currently returns `null` when the rules array is empty (line 135: `if (rules.length === 0) return null;`). The guardrail must be added to the rules array BEFORE the empty check, so NARRATIVE_RULES always emits even if no other narrative rules exist.

**Step 1: Write the failing test**

```typescript
it("NARRATIVE_RULES includes non-invention guardrail", () => {
  const bible = makeBible({
    narrativeRules: {
      ...createEmptyBible("test").narrativeRules,
    },
  });
  const result = buildRing1(bible, makeConfig());
  const narrativeRules = result.sections.find((s) => s.name === "NARRATIVE_RULES");
  expect(narrativeRules).toBeDefined();
  expect(narrativeRules!.text).toContain("Do not invent physical appearance, backstory, or biographical facts");
});

it("NARRATIVE_RULES emits even when no other narrative rules exist", () => {
  // createEmptyBible has all narrative policies null
  const bible = makeBible({
    narrativeRules: createEmptyBible("test").narrativeRules,
  });
  const result = buildRing1(bible, makeConfig());
  const narrativeRules = result.sections.find((s) => s.name === "NARRATIVE_RULES");
  // Must NOT be null — guardrail forces emission
  expect(narrativeRules).toBeDefined();
  expect(narrativeRules!.immune).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/ring1.test.ts`
Expected: FAIL — text not found (and section is null when all policies are null).

**Step 3: Write minimal implementation**

In `src/compiler/ring1.ts`, find `buildNarrativeRulesSection()` and add the guardrail BEFORE the empty check:

```typescript
function buildNarrativeRulesSection(bible: Bible): RingSection | null {
  const rules: string[] = [];
  if (bible.narrativeRules.subtextPolicy) {
    rules.push(bible.narrativeRules.subtextPolicy);
  }
  if (bible.narrativeRules.expositionPolicy) {
    rules.push(bible.narrativeRules.expositionPolicy);
  }
  if (bible.narrativeRules.sceneEndingPolicy) {
    rules.push(bible.narrativeRules.sceneEndingPolicy);
  }
  // Non-invention guardrail: always present, ensures NARRATIVE_RULES always emits
  rules.push("Do not invent physical appearance, backstory, or biographical facts beyond what is provided in context.");
  // Empty check removed — guardrail guarantees at least 1 rule
  return {
    name: "NARRATIVE_RULES",
    text: `NARRATIVE RULES: ${rules.join(". ")}`,
    priority: 0,
    immune: true,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/ring1.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `pnpm test`
Expected: All pass. Existing tests may need updating if they assert NARRATIVE_RULES is null — they should now always find the section.

**Step 6: Commit**

```bash
git add src/compiler/ring1.ts tests/compiler/ring1.test.ts
git commit -m "feat: add non-invention guardrail to NARRATIVE_RULES (always emitted)"
```

---

### Task 5: Emit `POV_INTERIORITY` section from Ring 3

> **Note:** This was originally Task 4 but moved after NARRATIVE_RULES to stabilize R1 output first.

**Files:**
- Modify: `src/compiler/ring3.ts`
- Test: `tests/compiler/ring3.test.ts`

**Context:** Ring 3 currently builds SCENE_CONTRACT, VOICE_*, SENSORY_PALETTE, ANCHOR_LINES, ANTI_ABLATION, and optionally CONTINUITY_BRIDGE. Add POV_INTERIORITY after VOICE sections. Priority: 0 (immune) at intimate/close, 2 at moderate/distant.

**Step 1: Write the failing tests**

Add to `tests/compiler/ring3.test.ts`:

```typescript
describe("POV_INTERIORITY section", () => {
  it("emits POV_INTERIORITY section for POV character with backstory", () => {
    const char = makeChar("elena", "Elena");
    char.backstory = "Grew up in coastal Oregon";
    char.selfNarrative = "Makes hard choices cleanly";
    const bible = makeBible([char]);
    const plan = makePlan({ povCharacterId: "elena", povDistance: "intimate" });
    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const section = result.sections.find((s) => s.name === "POV_INTERIORITY");
    expect(section).toBeDefined();
    expect(section!.text).toContain("POV INTERIORITY: ELENA");
    expect(section!.text).toContain("coastal Oregon");
  });

  it("POV_INTERIORITY is immune at intimate distance", () => {
    const char = makeChar("elena", "Elena");
    char.backstory = "Backstory here";
    const bible = makeBible([char]);
    const plan = makePlan({ povCharacterId: "elena", povDistance: "intimate" });
    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const section = result.sections.find((s) => s.name === "POV_INTERIORITY");
    expect(section!.immune).toBe(true);
    expect(section!.priority).toBe(0);
  });

  it("POV_INTERIORITY is compressible at moderate distance", () => {
    const char = makeChar("elena", "Elena");
    char.contradictions = ["Sees herself as decisive but avoids confrontation"];
    const bible = makeBible([char]);
    const plan = makePlan({ povCharacterId: "elena", povDistance: "moderate" });
    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const section = result.sections.find((s) => s.name === "POV_INTERIORITY");
    expect(section!.immune).toBe(false);
    expect(section!.priority).toBe(2);
  });

  it("skips POV_INTERIORITY when character has no interiority data", () => {
    const char = makeChar("elena", "Elena");
    // No backstory, selfNarrative, contradictions, or behavior
    const bible = makeBible([char]);
    const plan = makePlan({ povCharacterId: "elena", povDistance: "intimate" });
    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const section = result.sections.find((s) => s.name === "POV_INTERIORITY");
    expect(section).toBeUndefined();
  });

  it("skips when POV character not found in bible", () => {
    const char = makeChar("bob", "Bob");
    const bible = makeBible([char]);
    const plan = makePlan({ povCharacterId: "nonexistent", povDistance: "intimate" });
    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const section = result.sections.find((s) => s.name === "POV_INTERIORITY");
    expect(section).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/ring3.test.ts`
Expected: FAIL — no POV_INTERIORITY section emitted.

**Step 3: Write minimal implementation**

In `src/compiler/ring3.ts`, in the `buildRing3` function, after the voice fingerprint sections and before SENSORY_PALETTE:

```typescript
// POV Interiority
const povChar = bible.characters.find((c) => c.id === plan.povCharacterId);
if (povChar) {
  const hasContent = povChar.backstory || povChar.selfNarrative ||
    (Array.isArray(povChar.contradictions) && povChar.contradictions.length > 0) ||
    (povChar.behavior && Object.values(povChar.behavior).some(Boolean));
  if (hasContent) {
    const interiorityText = formatPovInteriority(povChar, plan.povDistance);
    const isDeep = plan.povDistance === "intimate" || plan.povDistance === "close";
    sections.push({
      name: "POV_INTERIORITY",
      text: interiorityText,
      priority: isDeep ? 0 : 2,
      immune: isDeep,
    });
  }
}
```

Add import for `formatPovInteriority` from `./helpers.js`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/ring3.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (no regressions).

**Step 6: Commit**

```bash
git add src/compiler/ring3.ts tests/compiler/ring3.test.ts
git commit -m "feat: emit POV_INTERIORITY section in Ring 3 with distance-based immunity"
```

---

## Phase B: Scene Cast

### Task 6: Add `presentCharacterIds` to `ScenePlan` type

**Files:**
- Modify: `src/types/scene.ts` (ScenePlan interface + createEmptyScenePlan factory)
- Create: `tests/types/scene.test.ts`

**Context:** New field `presentCharacterIds: string[]` lists all characters physically present in a scene (superset of POV + dialogue characters). Default `[]` for backward compat.

**Step 1: Write the failing test**

Create `tests/types/scene.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createEmptyScenePlan } from "../../src/types/scene.js";

describe("createEmptyScenePlan", () => {
  it("includes presentCharacterIds defaulting to empty array", () => {
    const plan = createEmptyScenePlan("proj-1");
    expect(plan.presentCharacterIds).toEqual([]);
  });

  it("presentCharacterIds is a string array", () => {
    const plan = createEmptyScenePlan("proj-1");
    expect(Array.isArray(plan.presentCharacterIds)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/types/scene.test.ts`
Expected: FAIL — `presentCharacterIds` does not exist on `ScenePlan`.

**Step 3: Write minimal implementation**

In `src/types/scene.ts`:
1. Add to `ScenePlan` interface: `presentCharacterIds: string[];`
2. Add to `createEmptyScenePlan()` return: `presentCharacterIds: [],`

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/types/scene.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for type errors**

Run: `pnpm check-all`
Expected: All pass — existing code doesn't read `presentCharacterIds` yet, and the factory provides a default.

**Step 6: Commit**

```bash
git add src/types/scene.ts tests/types/scene.test.ts
git commit -m "feat: add presentCharacterIds field to ScenePlan"
```

---

### Task 7: Create character formatting helpers for scene cast

**Files:**
- Modify: `src/compiler/helpers.ts` (add `formatForegroundCharacter`, `formatBackgroundCharacter`)
- Test: `tests/compiler/helpers.test.ts`

**Context:** Foreground characters (POV + speakers) get: name, role, and physical description. They do NOT include voice/behavior — that data is already in the VOICE_* sections. Background characters (present but not speaking) get: name + role + 1-line defining cue.

**CRITICAL:** Do NOT duplicate voice or behavior data. VOICE_* sections already cover voice fingerprints and behavior for all speaking characters. SCENE_CAST foreground focuses on physical description + role only. Use plain text formatting (no markdown bold) for consistency with other compiler sections.

**Step 1: Write the failing tests**

```typescript
describe("formatForegroundCharacter", () => {
  it("includes physical description and role but NOT behavior", () => {
    const char = createEmptyCharacterDossier("Elena");
    char.role = "protagonist";
    char.physicalDescription = "Tall, dark hair cut short, perpetual coffee stain on left sleeve";
    char.behavior = {
      emotionPhysicality: "Jaw tension",
      stressResponse: "Goes still",
      socialPosture: "Deflects with humor",
      noticesFirst: "Exits",
      lyingStyle: null,
    };
    const result = formatForegroundCharacter(char);
    expect(result).toContain("Elena");
    expect(result).toContain("protagonist");
    expect(result).toContain("dark hair cut short");
    // Should NOT include behavior — that's in VOICE_* sections
    expect(result).not.toContain("Jaw tension");
    expect(result).not.toContain("Goes still");
  });

  it("gracefully handles null physicalDescription", () => {
    const char = createEmptyCharacterDossier("Bob");
    const result = formatForegroundCharacter(char);
    expect(result).toContain("Bob");
    expect(result).not.toContain("null");
  });
});

describe("formatBackgroundCharacter", () => {
  it("includes only name and role with defining cue", () => {
    const char = createEmptyCharacterDossier("Marcus");
    char.role = "supporting";
    char.physicalDescription = "Broad shoulders, always wearing a leather jacket";
    const result = formatBackgroundCharacter(char);
    expect(result).toContain("Marcus");
    expect(result).toContain("supporting");
    expect(result.length).toBeLessThan(200); // Background should be concise
  });

  it("works with minimal character data", () => {
    const char = createEmptyCharacterDossier("Extra");
    const result = formatBackgroundCharacter(char);
    expect(result).toContain("Extra");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: FAIL — functions not defined.

**Step 3: Write minimal implementation**

```typescript
export function formatForegroundCharacter(char: CharacterDossier): string {
  const lines: string[] = [`${char.name} (${char.role})`];
  if (char.physicalDescription) lines.push(`Physical: ${char.physicalDescription}`);
  return lines.join("\n");
}

export function formatBackgroundCharacter(char: CharacterDossier): string {
  const parts: string[] = [`- ${char.name} (${char.role})`];
  if (char.physicalDescription) {
    // Take first clause/sentence as defining cue
    const cue = char.physicalDescription.split(/[.,;]/)[0]?.trim();
    if (cue) parts.push(`— ${cue}`);
  }
  return parts.join(" ");
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/compiler/helpers.ts tests/compiler/helpers.test.ts
git commit -m "feat: add foreground/background character formatters for scene cast"
```

---

### Task 8: Build `SCENE_CAST` section in Ring 3

**Files:**
- Modify: `src/compiler/ring3.ts` (add `buildSceneCast`)
- Test: `tests/compiler/ring3.test.ts`

**Context:** SCENE_CAST merges `presentCharacterIds`, `dialogueConstraints` keys, and `povCharacterId` into a deduplicated cast list. Classifies each as foreground (POV + speakers, max 6) or background (present but silent, max 8). Guardrail text is immune (priority 0), character blurbs are compressible (priority 2).

**CRITICAL:** Use `plan.presentCharacterIds ?? []` everywhere to handle legacy plans without the field. Do not emit empty "BACKGROUND:" blocks.

**Step 1: Write the failing tests**

```typescript
describe("SCENE_CAST section", () => {
  it("classifies speaking characters as foreground and non-speaking as background", () => {
    const alice = makeChar("alice", "Alice");
    alice.physicalDescription = "Red hair, freckles";
    const bob = makeChar("bob", "Bob");
    bob.physicalDescription = "Tall, glasses";
    const carol = makeChar("carol", "Carol");
    carol.physicalDescription = "Short, curly hair";

    const bible = makeBible([alice, bob, carol]);
    const plan = makePlan({
      povCharacterId: "alice",
      dialogueConstraints: { bob: ["Keep it brief"] },
      presentCharacterIds: ["alice", "bob", "carol"],
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection).toBeDefined();
    expect(castSection!.text).toContain("Alice");
    expect(castSection!.text).toContain("Bob");
    expect(castSection!.text).toContain("Carol");
  });

  it("caps foreground characters at 6", () => {
    const chars = Array.from({ length: 8 }, (_, i) => {
      const c = makeChar(`char-${i}`, `Char${i}`);
      c.physicalDescription = `Description ${i}`;
      return c;
    });
    const bible = makeBible(chars);
    const constraints: Record<string, string[]> = {};
    for (let i = 1; i < 8; i++) constraints[`char-${i}`] = ["constraint"];

    const plan = makePlan({
      povCharacterId: "char-0",
      dialogueConstraints: constraints,
      presentCharacterIds: chars.map((c) => c.id),
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection).toBeDefined();
    // Foreground section should exist but be capped
    expect(castSection!.text).toContain("FOREGROUND:");
  });

  it("caps background characters at 8", () => {
    const chars = Array.from({ length: 12 }, (_, i) => {
      const c = makeChar(`char-${i}`, `Char${i}`);
      c.physicalDescription = `Description ${i}`;
      return c;
    });
    const bible = makeBible(chars);

    const plan = makePlan({
      povCharacterId: "char-0",
      dialogueConstraints: {},
      presentCharacterIds: chars.map((c) => c.id),
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection).toBeDefined();
  });

  it("falls back to speaking-only when presentCharacterIds is empty", () => {
    const alice = makeChar("alice", "Alice");
    const bob = makeChar("bob", "Bob");
    const bible = makeBible([alice, bob]);
    const plan = makePlan({
      povCharacterId: "alice",
      dialogueConstraints: { bob: ["Keep it brief"] },
      presentCharacterIds: [],
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection).toBeDefined();
    expect(castSection!.text).toContain("Alice");
    expect(castSection!.text).toContain("Bob");
  });

  it("handles undefined presentCharacterIds (legacy plans)", () => {
    const alice = makeChar("alice", "Alice");
    const bible = makeBible([alice]);
    const plan = makePlan({ povCharacterId: "alice" });
    // Simulate legacy plan without presentCharacterIds
    delete (plan as any).presentCharacterIds;

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection).toBeDefined();
  });

  it("does not emit empty BACKGROUND block", () => {
    const alice = makeChar("alice", "Alice");
    const bible = makeBible([alice]);
    const plan = makePlan({
      povCharacterId: "alice",
      presentCharacterIds: ["alice"],
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection!.text).not.toContain("BACKGROUND:");
  });

  it("emits immune guardrail sub-section at priority 0", () => {
    const alice = makeChar("alice", "Alice");
    const bible = makeBible([alice]);
    const plan = makePlan({
      povCharacterId: "alice",
      presentCharacterIds: ["alice"],
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const guardrail = result.sections.find((s) => s.name === "SCENE_CAST_GUARDRAIL");
    expect(guardrail).toBeDefined();
    expect(guardrail!.immune).toBe(true);
    expect(guardrail!.priority).toBe(0);
    expect(guardrail!.text).toContain("Only characters listed in SCENE_CAST");
  });

  it("SCENE_CAST character blurbs are compressible at priority 2", () => {
    const alice = makeChar("alice", "Alice");
    const bible = makeBible([alice]);
    const plan = makePlan({
      povCharacterId: "alice",
      presentCharacterIds: ["alice"],
    });

    const result = buildRing3(plan, bible, [], 0, makeConfig());
    const castSection = result.sections.find((s) => s.name === "SCENE_CAST");
    expect(castSection!.immune).toBe(false);
    expect(castSection!.priority).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/compiler/ring3.test.ts`
Expected: FAIL — no SCENE_CAST section emitted.

**Step 3: Write minimal implementation**

In `src/compiler/ring3.ts`, add:

```typescript
function buildSceneCast(plan: ScenePlan, bible: Bible): RingSection[] {
  const sections: RingSection[] = [];

  // Merge all character IDs (POV + speakers + present)
  const speakerIds = new Set(Object.keys(plan.dialogueConstraints ?? {}));
  speakerIds.add(plan.povCharacterId);
  const presentIds = new Set(plan.presentCharacterIds ?? []);
  for (const id of speakerIds) presentIds.add(id);

  const allIds = [...presentIds];
  const foregroundIds = allIds.filter((id) => speakerIds.has(id)).slice(0, 6);
  const backgroundIds = allIds.filter((id) => !speakerIds.has(id)).slice(0, 8);

  const castLines: string[] = ["=== SCENE CAST ===", ""];

  // Foreground characters (physical description + role only; voice/behavior in VOICE_*)
  if (foregroundIds.length > 0) {
    castLines.push("FOREGROUND:");
    for (const id of foregroundIds) {
      const char = bible.characters.find((c) => c.id === id);
      if (char) castLines.push(formatForegroundCharacter(char));
    }
    castLines.push("");
  }

  // Background characters (name + role + defining cue)
  if (backgroundIds.length > 0) {
    castLines.push("BACKGROUND:");
    for (const id of backgroundIds) {
      const char = bible.characters.find((c) => c.id === id);
      if (char) castLines.push(formatBackgroundCharacter(char));
    }
    castLines.push("");
  }

  // Character blurbs (compressible)
  sections.push({
    name: "SCENE_CAST",
    text: castLines.join("\n"),
    priority: 2,
    immune: false,
  });

  // Guardrail (immune) — survives budget compression
  const guardrailText = [
    "Only characters listed in SCENE_CAST should appear, speak, or act.",
    "Unnamed background characters (waiters, crowds) may exist as scenery without tagging, provided they do not speak.",
    'If scene logic absolutely requires a new named character, tag them on first mention as <new_entity name="X" role="Y" /> and do not give them dialogue in this chunk.',
    "Introduce at most 1-2 new physical details per character per chunk. Do not front-load descriptions.",
  ].join(" ");

  sections.push({
    name: "SCENE_CAST_GUARDRAIL",
    text: guardrailText,
    priority: 0,
    immune: true,
  });

  return sections;
}
```

Call `buildSceneCast()` from the main `buildRing3()` function and spread results into the sections array. Import `formatForegroundCharacter` and `formatBackgroundCharacter` from `./helpers.js`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/compiler/ring3.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm check-all`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/compiler/ring3.ts tests/compiler/ring3.test.ts
git commit -m "feat: add SCENE_CAST section with foreground/background strategy and immune guardrail"
```

---

### Task 9: Persist `presentCharacterIds` in server

**Files:**
- Verify: `server/db/repositories/scene-plans.ts` (JSON round-trip already handles new fields)
- Verify: `server/api/routes.ts` (PUT /scenes/:id already replaces full plan JSON)
- Test: `tests/server/routes/scene-plans.test.ts`

**Context:** Scene plans are stored as opaque JSON in a `data` TEXT column. Adding `presentCharacterIds` to the TypeScript type is sufficient — no DB schema change needed. Verify the round-trip works.

**Step 1: Write an integration test**

Add to `tests/server/routes/scene-plans.test.ts` (or create if needed — follow existing test patterns in `tests/server/`):

```typescript
it("round-trips presentCharacterIds through create and get", async () => {
  const plan = createEmptyScenePlan("proj-1");
  plan.presentCharacterIds = ["char-1", "char-2", "char-3"];

  // Adapt to match actual test setup (supertest, fastify inject, etc.)
  const createRes = await request(app).post("/api/data/scenes").send({ plan, sceneOrder: 0 });
  expect(createRes.status).toBe(201);

  const getRes = await request(app).get(`/api/data/scenes/${plan.id}`);
  expect(getRes.status).toBe(200);
  expect(getRes.body.presentCharacterIds).toEqual(["char-1", "char-2", "char-3"]);
});
```

Note: Adapt the test to match the actual test framework patterns used in existing server tests. Check `tests/server/` for setup patterns.

**Step 2: Run test**

Run: `pnpm test -- --run tests/server/routes/scene-plans.test.ts`
Expected: PASS (JSON serialization handles the new field transparently).

**Step 3: Commit**

```bash
git add tests/server/routes/scene-plans.test.ts
git commit -m "test: verify presentCharacterIds round-trips through server"
```

---

### Task 10: Update bootstrap prompt with `presentCharacterIds`

**Files:**
- Modify: `src/bootstrap/sceneBootstrap.ts`
- Test: `tests/bootstrap/sceneBootstrap.test.ts`

**Context:** The scene bootstrap prompt includes a JSON template showing what fields the LLM should populate. Add `presentCharacterIds` to this template so auto-generated scenes include present characters.

**Step 1: Write the failing test**

Add to `tests/bootstrap/sceneBootstrap.test.ts`:

```typescript
it("bootstrap prompt includes presentCharacterIds in JSON template", () => {
  // Use existing test setup pattern from this file
  const prompt = buildSceneBootstrapPrompt(/* existing params from other tests */);
  expect(prompt).toContain("presentCharacterIds");
});
```

(Adapt to match the existing test patterns in this file — check how `buildSceneBootstrapPrompt` is called in existing tests.)

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/bootstrap/sceneBootstrap.test.ts`
Expected: FAIL — prompt doesn't contain `presentCharacterIds`.

**Step 3: Write minimal implementation**

In `src/bootstrap/sceneBootstrap.ts`, find the JSON template string (around line 460) and add:

```
"presentCharacterIds": ["<IDs of ALL characters physically present, including POV and speakers>"],
```

Also add a brief instruction near the character listing:

```
For each scene, list ALL characters who are physically present in presentCharacterIds — not just speakers.
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/bootstrap/sceneBootstrap.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/bootstrap/sceneBootstrap.ts tests/bootstrap/sceneBootstrap.test.ts
git commit -m "feat: include presentCharacterIds in scene bootstrap prompt template"
```

---

### Task 11: UI — Character multi-select in SceneAuthoringModal

**Files:**
- Modify: `src/app/components/SceneGuidedFormTab.svelte` (add multi-select for presentCharacterIds)

**Context:** Add a character checklist to the "core" tab of the scene guided form. Pre-populate from `dialogueConstraints` keys + `povCharacterId`. Users can add non-speaking characters from the bible's character list.

**CRITICAL:** The `$effect` must use sorted shallow equality comparison (not just size) and call `updatePlan()` (the same updater used elsewhere in the component) instead of direct `formPlan` assignment to avoid reactive churn or double-firing.

**Step 1: Implementation**

In `SceneGuidedFormTab.svelte`, in the "core" tab section (after POV character select, around line 124), add:

```svelte
<FormField label="Characters Present" hint="All characters physically in this scene (speakers are auto-included)">
  {#if characters.length > 0}
    <div class="character-checklist">
      {#each characters as char (char.id)}
        {@const isImplicit = char.id === formPlan.povCharacterId ||
          Object.keys(formPlan.dialogueConstraints ?? {}).includes(char.id)}
        <label class="character-check" class:implicit={isImplicit}>
          <input
            type="checkbox"
            checked={isImplicit || (formPlan.presentCharacterIds ?? []).includes(char.id)}
            disabled={isImplicit}
            onchange={(e) => {
              const current = new Set(formPlan.presentCharacterIds ?? []);
              if (e.currentTarget.checked) {
                current.add(char.id);
              } else {
                current.delete(char.id);
              }
              updatePlan({ presentCharacterIds: [...current] });
            }}
          />
          {char.name} ({char.role})
          {#if isImplicit}<span class="implicit-badge">auto</span>{/if}
        </label>
      {/each}
    </div>
  {:else}
    <p class="muted">No characters in bible yet.</p>
  {/if}
</FormField>
```

Add minimal styling for the checklist:

```css
.character-checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.character-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}
.character-check.implicit {
  opacity: 0.7;
}
.implicit-badge {
  font-size: 0.75rem;
  color: var(--color-muted);
}
```

**Step 2: Ensure `presentCharacterIds` syncs with implicit characters**

Add a `$effect` to auto-include POV and speaker characters, using sorted shallow equality:

```typescript
$effect(() => {
  const implicit = new Set<string>();
  if (formPlan.povCharacterId) implicit.add(formPlan.povCharacterId);
  for (const id of Object.keys(formPlan.dialogueConstraints ?? {})) implicit.add(id);

  const current = new Set(formPlan.presentCharacterIds ?? []);
  for (const id of implicit) current.add(id);

  const next = [...current].sort();
  const prev = [...(formPlan.presentCharacterIds ?? [])].sort();

  // Only update if the sorted arrays differ (prevents reactive churn)
  const changed = next.length !== prev.length || next.some((id, i) => id !== prev[i]);
  if (changed) {
    updatePlan({ presentCharacterIds: next });
  }
});
```

**Step 3: Run full check**

Run: `pnpm check-all`
Expected: All pass (typecheck + lint + tests).

**Step 4: Commit**

```bash
git add src/app/components/SceneGuidedFormTab.svelte
git commit -m "feat: add character presence checklist to scene authoring form"
```

---

## Post-Implementation Verification

### Final Checks

After all tasks complete:

1. Run `pnpm check-all` — lint + typecheck + all tests
2. Run `pnpm dev:all` — manually verify:
   - Scene authoring modal shows character checklist
   - Compiler output includes POV_INTERIORITY section
   - Compiler output includes SCENE_CAST section
   - Budget enforcer correctly compresses new sections
3. Check no regressions in existing compilation log output

### Expected Test Count Increase

Phase A: ~12 new tests (behavior via formatCharacterVoice×3, formatSensoryPalette×3, formatPovInteriority×6, ring3 POV_INTERIORITY×5, ring1 guardrail×2)
Phase B: ~14 new tests (scene type×2, foreground/background×4, SCENE_CAST×8, server round-trip×1, bootstrap×1)

Total: ~26 new test cases.

### Consensus Fixes Applied

| Issue | Source | Fix Applied |
|---|---|---|
| `formatBehavior` takes `CharacterDossier` not `CharacterBehavior`, returns `string[]` | All 3 models | Task 1: test through `formatCharacterVoice`, keep existing signature |
| `contradictions` is `string[]` not `string` | All 3 models | Task 3: iterate array directly, no `.split()` |
| No token caps | All 3 models | Task 2: 70-token cap; Task 3: 220-token cap |
| SCENE_CAST duplicates VOICE_* data | All 3 models | Task 7: foreground = physicalDescription + role only |
| `buildNarrativeRulesSection` returns null when empty | GPT-5, GPT-5-Codex | Task 4: guardrail added before empty check |
| `$effect` size-only guard causes churn | All 3 models | Task 11: sorted shallow equality + `updatePlan()` |
| Markdown bold formatting inconsistent | GPT-5 | Task 7: plain text formatting |
| Task ordering suboptimal | GPT-5, o3 | Tasks 4/5 reordered (NARRATIVE_RULES before POV_INTERIORITY) |
| Missing test: POV char not in bible | o3 | Task 5: added "skips when POV character not found" test |
| Missing test: undefined presentCharacterIds | GPT-5-Codex, GPT-5 | Task 8: added legacy plan test |
| Missing test: empty BACKGROUND block | GPT-5-Codex | Task 8: added "does not emit empty BACKGROUND" test |
