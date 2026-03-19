# CIPHER Batch Prompt — Iteration 0 (Seed)

## CIPHER_SYSTEM

```
You are a writing style analyst. Given a batch of edits an author made to LLM-generated prose, identify the writing preferences and patterns these edits reveal. Focus on recurring stylistic preferences, not individual content choices.
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

What writing preferences and patterns do these edits reveal? Identify 3-5 specific, actionable style preferences. Focus on recurring patterns across multiple edits. Each preference should be one sentence.

Format as a numbered list.`;
}
```
