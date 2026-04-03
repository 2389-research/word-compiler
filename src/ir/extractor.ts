import type { Bible, NarrativeIR, ScenePlan } from "../types/index.js";
import { DEFAULT_MODEL } from "../types/index.js";
import { parseIRResponse } from "./parser.js";

// ─── LLM Client Interface ────────────────────────────────

export interface IRLLMClient {
  call(
    systemMessage: string,
    userMessage: string,
    model: string,
    maxTokens: number,
    outputSchema?: Record<string, unknown>,
  ): Promise<string>;
}

// ─── Prompt Builder ──────────────────────────────────────

export function buildIRExtractionPrompt(prose: string, plan: ScenePlan, bible: Bible): string {
  const characterList = bible.characters.map((c) => `- ${c.name} (id: ${c.id}, role: ${c.role})`).join("\n");

  const activeSetups = bible.narrativeRules.setups.filter((s) => s.status === "planned" || s.status === "planted");

  const setupList =
    activeSetups.length > 0
      ? activeSetups.map((s) => `- [${s.id}] ${s.description} (${s.status})`).join("\n")
      : "(none registered)";

  return `SCENE PLAN:
Title: ${plan.title}
Narrative goal: ${plan.narrativeGoal}
Emotional beat: ${plan.emotionalBeat}

CHARACTERS IN BIBLE:
${characterList}

ACTIVE SETUPS:
${setupList}

PAYOFF MATCHING RULES:
When a setup from ACTIVE SETUPS is paid off in this scene, reference it in
payoffsExecuted using the setup's description verbatim as a prefix, followed
by " — " and a brief note on how the payoff occurred. Only list payoffs for
setups in the ACTIVE SETUPS list above.

SCENE PROSE:
${prose}

---

Extract the narrative internal record for this scene. Return ONLY valid JSON in this exact shape:

{
  "events": ["List of concrete story events that occurred — plot-level facts, not atmosphere"],
  "factsIntroduced": ["Facts that now exist in the story world after this scene"],
  "factsRevealedToReader": ["Facts the reader now knows (may differ from character knowledge)"],
  "factsWithheld": ["Facts that exist but were deliberately not revealed to reader"],
  "characterDeltas": [
    {
      "characterId": "exact id from character list",
      "learned": "what this character learned, or null",
      "suspicionGained": "new suspicion formed, or null",
      "emotionalShift": "emotional state change, or null",
      "relationshipChange": "relationship dynamic change, or null"
    }
  ],
  "setupsPlanted": ["description of each setup planted in this scene — quote from prose if possible"],
  "payoffsExecuted": ["<setup description from ACTIVE SETUPS> — <how it was paid off>"],
  "characterPositions": [
    { "characterId": "character name or id", "position": "physical/narrative position at scene end" }
  ],
  "unresolvedTensions": ["tensions still active at scene end — what keeps the reader wanting to turn the page"]
}

Be specific and factual. Keep each string value TERSE (under 15 words). Do not add commentary. Do not invent facts not present in the prose.`;
}

// ─── Extractor ───────────────────────────────────────────

const IR_SYSTEM_MESSAGE = `You are a narrative structure analyst. Your job is to extract a precise, factual internal record from scene prose. You identify events, knowledge states, and dramatic tensions without interpretation or evaluation. Return only JSON.`;

export async function extractIR(
  prose: string,
  plan: ScenePlan,
  bible: Bible,
  llmClient: IRLLMClient,
  model = DEFAULT_MODEL,
): Promise<NarrativeIR> {
  const userMessage = buildIRExtractionPrompt(prose, plan, bible);
  const responseText = await llmClient.call(IR_SYSTEM_MESSAGE, userMessage, model, 4096);
  if (!responseText || !responseText.trim()) {
    throw new Error("IR extraction failed: LLM returned an empty response");
  }
  return parseIRResponse(responseText, plan.id);
}
