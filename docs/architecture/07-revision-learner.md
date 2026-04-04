# Revision Learner

The revision learner observes how the author edits generated prose and converts those edits into actionable Bible proposals. It answers the question: "What does this author consistently change, and how should the Bible adapt?"

## Architecture

```
Edited Chunks ──▶ Diff Engine ──▶ Edit Patterns ──▶ Pattern Accumulator ──▶ Bible Proposals
                                                            │
                                                            ▼
                                                    Tuning Proposals
```

## Diff Engine (`src/learner/diff.ts`)

Compares `generatedText` vs `editedText` for each chunk and classifies the edit.

### Edit Types

| Type | SubTypes | Example |
|------|----------|---------|
| `DELETION` | `CUT_FILLER`, `CUT_HEDGE`, `CUT_REDUNDANT` | "well" → "" |
| `SUBSTITUTION` | `WORD_SWAP`, `PHRASE_REWRITE` | "commenced" → "began" |
| `RESTRUCTURE` | `SENTENCE_SPLIT`, `SENTENCE_MERGE`, `REORDER` | Two sentences → one |
| `ADDITION` | `SENSORY_DETAIL`, `INTERIORITY`, `DIALOGUE` | Added a physical description |

`analyzeEdits(generatedText, editedText, chunkId, sceneId, projectId)` returns `EditPattern[]`.

### EditPattern Type

```typescript
interface EditPattern {
  id: string;
  chunkId: string;
  sceneId: string;
  projectId: string;
  editType: string;
  subType: string;
  originalText: string;
  editedText: string;
  context: string | null;
  createdAt: string;
}
```

## Pattern Accumulation (`src/learner/patterns.ts`)

Groups edit patterns by `(editType, subType)` and scores them using **Wilson score intervals** with a promotion threshold.

### Wilson Score

The Wilson score gives a lower-confidence-bound estimate of the true proportion. For a pattern group with `n` total patterns, `k` consistent patterns:

```
wilsonLower(k, n) = lower bound of 95% confidence interval
```

A pattern is **promoted** when `wilsonLower(k, n) > 0.60` — meaning we're 95% confident that at least 60% of similar edits follow this pattern.

`accumulatePatterns(editPatterns, sceneOrder)` returns `PatternGroup[]` (only promoted groups).

## Bible Proposals (`src/learner/proposals.ts`)

Converts promoted pattern groups into concrete Bible modification proposals.

| Pattern | Proposed Action |
|---------|----------------|
| Consistent `CUT_FILLER` of word X | Add X to avoid list |
| Consistent `WORD_SWAP` from A → B | Add vocabulary preference (B instead of A) |
| Consistent `CUT_HEDGE` | Add structural ban for hedging pattern |
| Consistent voice corrections for character | Update character voice notes |

### BibleProposal Type

```typescript
interface BibleProposal {
  id: string;
  title: string;
  description: string;
  action: { section: "killList" | "characters" | "styleGuide" | "locations"; value: string };
  evidence: { patterns: number; confidence: number; examples: Array<{ original: string; edited: string }> };
}
```

## Tuning Proposals (`src/learner/tuning.ts`)

Analyzes edit *intensity* (not content) to propose parameter adjustments.

### Gate Conditions
- At least 10 edited chunks across at least 3 scenes

### Checks

| Condition | Proposal |
|-----------|----------|
| Average edit ratio > 40% | Lower `defaultTemperature` (0.2 step) |
| Edited text consistently >20% shorter than generated | Reduce `reservedForOutput` |

### Levenshtein Distance

`levenshteinDistance(a, b)` — standard DP implementation with two-row memory optimization.
`computeEditRatio(chunk)` — levenshtein / max(length, 1).

## Key Files

| File | Purpose |
|------|---------|
| `src/learner/diff.ts` | Edit classification (47 tests) |
| `src/learner/patterns.ts` | Wilson score accumulation (86 tests) |
| `src/learner/proposals.ts` | Bible proposal generation (19 tests) |
| `src/learner/tuning.ts` | Parameter tuning proposals (20 tests) |
