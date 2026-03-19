# CIPHER Batch Prompt — Iteration 1

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

For each pattern you identify, ask: "Does this appear in 3+ edits?" If not, it's likely a one-off content decision, not a style preference. Skip it.

Produce 3-5 writing preferences. Each preference MUST:
1. Be written as a direct command suitable for an LLM system prompt ("Write with...", "Avoid...", "When X, do Y instead of Z...")
2. Address a DIFFERENT writing dimension from every other preference. Dimensions include: register/diction, sentence structure, emotional handling, humor/tone, specificity/detail, dialogue style, punctuation habits. Do not produce two preferences about the same dimension.
3. Be one sentence — concise enough to inject into a system message.

Format: numbered list, one preference per line. No headers, no explanations, no examples.`;
}
```
