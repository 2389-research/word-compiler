import type { Bible, NarrativeIR, ScenePlan } from "../types/index.js";
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

// ─── JSON Schema for Structured Output ───────────────────

export const narrativeIRSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: { type: "array", items: { type: "string" } },
    factsIntroduced: { type: "array", items: { type: "string" } },
    factsRevealedToReader: { type: "array", items: { type: "string" } },
    factsWithheld: { type: "array", items: { type: "string" } },
    characterDeltas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          characterId: { type: "string" },
          learned: { type: ["string", "null"] },
          suspicionGained: { type: ["string", "null"] },
          emotionalShift: { type: ["string", "null"] },
          relationshipChange: { type: ["string", "null"] },
        },
        required: ["characterId", "learned", "suspicionGained", "emotionalShift", "relationshipChange"],
      },
    },
    setupsPlanted: { type: "array", items: { type: "string" } },
    payoffsExecuted: { type: "array", items: { type: "string" } },
    characterPositions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          characterId: { type: "string" },
          position: { type: "string" },
        },
        required: ["characterId", "position"],
      },
    },
    unresolvedTensions: { type: "array", items: { type: "string" } },
  },
  required: [
    "events",
    "factsIntroduced",
    "factsRevealedToReader",
    "factsWithheld",
    "characterDeltas",
    "setupsPlanted",
    "payoffsExecuted",
    "characterPositions",
    "unresolvedTensions",
  ],
};

// ─── Prompt Builder ──────────────────────────────────────

export function buildIRExtractionPrompt(prose: string, plan: ScenePlan, bible: Bible): string {
  const characterList = bible.characters.map((c) => `- ${c.name} (id: ${c.id}, role: ${c.role})`).join("\n");

  const setupList =
    bible.narrativeRules.setups.length > 0
      ? bible.narrativeRules.setups.map((s) => `- [${s.id}] ${s.description} (${s.status})`).join("\n")
      : "(none registered)";

  return `SCENE PLAN:
Title: ${plan.title}
Narrative goal: ${plan.narrativeGoal}
Emotional beat: ${plan.emotionalBeat}

CHARACTERS IN BIBLE:
${characterList}

ACTIVE SETUPS:
${setupList}

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
  "payoffsExecuted": ["description of each setup paid off in this scene"],
  "characterPositions": [
    { "characterId": "character name or id", "position": "physical/narrative position at scene end" }
  ],
  "unresolvedTensions": ["tensions still active at scene end — what keeps the reader wanting to turn the page"]
}

Be specific and factual. Do not add commentary. Do not invent facts not present in the prose.`;
}

// ─── Extractor ───────────────────────────────────────────

const IR_SYSTEM_MESSAGE = `You are a narrative structure analyst. Your job is to extract a precise, factual internal record from scene prose. You identify events, knowledge states, and dramatic tensions without interpretation or evaluation. Return only JSON.`;

export async function extractIR(
  prose: string,
  plan: ScenePlan,
  bible: Bible,
  llmClient: IRLLMClient,
  model = "claude-sonnet-4-6",
): Promise<NarrativeIR> {
  const userMessage = buildIRExtractionPrompt(prose, plan, bible);
  const responseText = await llmClient.call(IR_SYSTEM_MESSAGE, userMessage, model, 2000, narrativeIRSchema);
  return parseIRResponse(responseText, plan.id);
}
