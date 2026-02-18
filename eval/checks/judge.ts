import Anthropic from "@anthropic-ai/sdk";
import type { Bible, CharacterDossier, ScenePlan } from "../../src/types/index.js";
import type { JudgeScore } from "../types.js";
import {
  VOICE_CONSISTENCY,
  SUBTEXT_ADHERENCE,
  TONE_WHIPLASH,
  METAPHORIC_REGISTER,
  SCENE_GOAL,
  CONTINUITY,
  type Rubric,
} from "./rubrics.js";

// ─── Raw Judge Response ─────────────────────────────────

interface RawJudgeResponse {
  reasoning: string;
  score: number;
  passed: boolean;
  violations?: string;
}

// ─── Core Judge Call ────────────────────────────────────

export async function callJudge(
  rubric: Rubric,
  context: Record<string, string>,
  client: Anthropic,
  model: string,
): Promise<JudgeScore> {
  const userPrompt = rubric.buildUserPrompt(context);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: rubric.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = parseJudgeResponse(text, rubric);
  return parsed;
}

// ─── Response Parsing ───────────────────────────────────

export function parseJudgeResponse(text: string, rubric: Rubric): JudgeScore {
  try {
    // Try to extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackScore(rubric, `No JSON found in response: ${text.slice(0, 200)}`);
    }

    const raw: RawJudgeResponse = JSON.parse(jsonMatch[0]);

    if (typeof raw.score !== "number" || typeof raw.reasoning !== "string") {
      return fallbackScore(rubric, `Invalid JSON shape: ${jsonMatch[0].slice(0, 200)}`);
    }

    // Clamp score to valid range
    const score = Math.max(0, Math.min(raw.score, rubric.maxScore));

    return {
      dimension: rubric.dimension,
      score,
      passed: score >= rubric.passThreshold,
      reasoning: raw.reasoning,
    };
  } catch (e) {
    return fallbackScore(rubric, `JSON parse error: ${(e as Error).message}`);
  }
}

function fallbackScore(rubric: Rubric, reason: string): JudgeScore {
  return {
    dimension: rubric.dimension,
    score: 0,
    passed: false,
    reasoning: `[PARSE FAILURE] ${reason}`,
  };
}

// ─── Dimension-Specific Evaluators ──────────────────────

export async function evaluateVoice(
  prose: string,
  character: CharacterDossier,
  client: Anthropic,
  model: string,
): Promise<JudgeScore> {
  return callJudge(VOICE_CONSISTENCY, {
    prose,
    sentenceLengthRange: character.voice.sentenceLengthRange?.join("-") ?? "not specified",
    vocabularyNotes: character.voice.vocabularyNotes ?? "not specified",
    verbalTics: character.voice.verbalTics.join(", ") || "none",
    metaphoricRegister: character.voice.metaphoricRegister ?? "not specified",
    dialogueSamples: character.voice.dialogueSamples.join("\n") || "none provided",
  }, client, model);
}

export async function evaluateSubtext(
  prose: string,
  plan: ScenePlan,
  client: Anthropic,
  model: string,
): Promise<JudgeScore | null> {
  if (!plan.subtext) return null;

  return callJudge(SUBTEXT_ADHERENCE, {
    prose,
    surfaceConversation: plan.subtext.surfaceConversation,
    actualConversation: plan.subtext.actualConversation,
    enforcementRule: plan.subtext.enforcementRule,
  }, client, model);
}

export async function evaluateToneWhiplash(
  prevSceneEnd: string,
  nextSceneStart: string,
  client: Anthropic,
  model: string,
): Promise<JudgeScore> {
  return callJudge(TONE_WHIPLASH, {
    prevSceneEnd,
    nextSceneStart,
  }, client, model);
}

export async function evaluateMetaphoricRegister(
  prose: string,
  bible: Bible,
  client: Anthropic,
  model: string,
): Promise<JudgeScore | null> {
  if (!bible.styleGuide.metaphoricRegister) return null;

  return callJudge(METAPHORIC_REGISTER, {
    prose,
    approvedDomains: bible.styleGuide.metaphoricRegister.approvedDomains.join(", "),
    prohibitedDomains: bible.styleGuide.metaphoricRegister.prohibitedDomains.join(", "),
  }, client, model);
}

export async function evaluateSceneGoal(
  prose: string,
  plan: ScenePlan,
  client: Anthropic,
  model: string,
): Promise<JudgeScore> {
  return callJudge(SCENE_GOAL, {
    prose,
    narrativeGoal: plan.narrativeGoal,
    emotionalBeat: plan.emotionalBeat,
    readerEffect: plan.readerEffect,
    failureModeToAvoid: plan.failureModeToAvoid,
  }, client, model);
}

export async function evaluateContinuity(
  prevSceneEnd: string,
  nextSceneStart: string,
  client: Anthropic,
  model: string,
): Promise<JudgeScore> {
  return callJudge(CONTINUITY, {
    prevSceneEnd,
    nextSceneStart,
  }, client, model);
}
