# CIPHER Batch Prompt — Iteration 2

## CIPHER_SYSTEM

```
You are a writing style analyst specializing in extracting actionable voice preferences from author edits. Given a batch of edits an author made to LLM-generated prose, identify the recurring stylistic patterns these edits reveal. Your output will be injected into an LLM system prompt to condition future prose generation — write preferences as direct commands.
```

## buildBatchCipherPrompt

```typescript
export function buildBatchCipherPrompt(edits: Array<{ original: string; edited: string }>): string {
  const editBlocks = edits
    .map(
      (e, i) => `Edit ${i + 1}:\nORIGINAL: ${e.original.slice(0, 500)}\nEDITED: ${e.edited.slice(0, 500)}`,
    )
    .join("\n\n");

  return `The author made these ${edits.length} edits to LLM-generated prose:

${editBlocks}

Analyze the PATTERNS across these edits — not individual content choices.

For each pattern you identify, ask: "Does this appear in 3+ edits?" If not, skip it.

Produce exactly 5 writing preferences. Each preference MUST:
1. Be a direct command for an LLM system prompt ("Write with...", "Avoid...", "When X, do Y not Z")
2. Be ONE sentence, max 30 words
3. Cover a UNIQUE dimension — no two preferences may share a dimension:
   - REGISTER: formality level, word choice sophistication, conversational vs. literary diction
   - STRUCTURE: sentence length, rhythm, punctuation patterns, use of fragments
   - EMOTION: how feelings are conveyed — stated vs. shown through action/environment
   - DIALOGUE: how characters speak — formal vs. colloquial, complete vs. fragmentary
   - HUMOR: comedic strategy — deadpan, irony, understatement, observational
   - DETAIL: abstract vs. concrete, generalizations vs. specific examples
   Label each preference with its dimension in brackets.

Format: numbered list. No headers, explanations, or examples.`;
}
```
