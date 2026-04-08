import type Anthropic from "@anthropic-ai/sdk";
import type { PreferenceStatement } from "../../src/profile/types.js";
import { truncateToTokens } from "../../src/tokens/index.js";
import { DEFAULT_MODEL, generateId } from "../../src/types/index.js";
import { textCall } from "./llm.js";

export const CIPHER_BATCH_SIZE = 10;
const EDIT_TOKEN_LIMIT = 2000;

export const CIPHER_SYSTEM =
  "You are a writing style analyst specializing in extracting actionable voice preferences from author edits. Given a batch of edits an author made to LLM-generated prose, identify the recurring stylistic patterns these edits reveal. Your output will be injected into an LLM system prompt to condition future prose generation — write preferences as direct commands.";

export function buildBatchCipherPrompt(edits: Array<{ original: string; edited: string }>): string {
  const editBlocks = edits
    .map(
      (e, i) =>
        `Edit ${i + 1}:\nORIGINAL: ${truncateToTokens(e.original, EDIT_TOKEN_LIMIT)}\nEDITED: ${truncateToTokens(e.edited, EDIT_TOKEN_LIMIT)}`,
    )
    .join("\n\n");

  return `The author made these ${edits.length} edits to LLM-generated prose:

${editBlocks}

Analyze the PATTERNS across these edits — not individual content choices.

For each pattern you identify, ask: "Does this appear in 3+ edits?" If not, skip it.

Produce exactly 5 writing preferences. Each preference MUST:
1. Be a direct command for an LLM system prompt ("Write with...", "Avoid...", "When X, do Y not Z")
2. Be ONE sentence, max 30 words
3. Cover a UNIQUE writing dimension — no two preferences may overlap. Choose the 5 dimensions MOST represented in the edits from this list:
   - REGISTER: formality level, word choice, conversational vs. literary diction
   - STRUCTURE: sentence length, rhythm, punctuation patterns (em-dashes, fragments)
   - EMOTION: how feelings are conveyed — stated vs. shown through action/environment
   - DIALOGUE: how characters speak — formal vs. colloquial, complete vs. fragmentary, said-bookisms
   - HUMOR: comedic strategy — deadpan, irony, understatement, observational
   - DETAIL: abstract generalizations vs. concrete specifics
   - PACING: information density, scene tempo, when to slow down or speed up
   If fewer than 3 edits touch a dimension, skip it and pick another.
   Label each preference with its dimension in brackets.

Format: numbered list. No headers, explanations, or examples.`;
}

const CIPHER_MODEL = DEFAULT_MODEL;

export async function inferBatchPreferences(
  client: Anthropic,
  projectId: string,
  edits: Array<{ original: string; edited: string }>,
): Promise<PreferenceStatement> {
  const statement = await textCall(client, CIPHER_MODEL, CIPHER_SYSTEM, buildBatchCipherPrompt(edits));

  return {
    id: generateId(),
    projectId,
    statement,
    editCount: edits.length,
    createdAt: new Date().toISOString(),
  };
}
