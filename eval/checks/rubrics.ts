import type { JudgeDimension } from "../types.js";

// ─── Rubric Definition ──────────────────────────────────

export interface Rubric {
  dimension: JudgeDimension;
  systemPrompt: string;
  buildUserPrompt: (context: Record<string, string>) => string;
  passThreshold: number;
  maxScore: number;
  outputSchema: JudgeOutputSchema;
}

export interface JudgeOutputSchema {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

// ─── Shared Output Schema ───────────────────────────────

const STANDARD_SCHEMA: JudgeOutputSchema = {
  type: "object",
  properties: {
    reasoning: { type: "string", description: "Step-by-step analysis before scoring" },
    score: { type: "number", description: "Numeric score" },
    passed: { type: "boolean", description: "Whether the check passed" },
    violations: { type: "string", description: "Specific violations found, or empty string" },
  },
  required: ["reasoning", "score", "passed"],
};

const JUDGE_SYSTEM_BASE = `You are a literary quality evaluator. You assess prose against specific creative writing criteria.

Rules:
- Think step-by-step before scoring
- Be specific — cite text when possible
- Score honestly — do not inflate
- Return ONLY valid JSON matching the requested schema`;

// ─── Voice Consistency ──────────────────────────────────

export const VOICE_CONSISTENCY: Rubric = {
  dimension: "voice_consistency",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether this prose matches the character's voice fingerprint.

## Voice Fingerprint
- Sentence length range: ${ctx["sentenceLengthRange"] ?? "not specified"}
- Vocabulary notes: ${ctx["vocabularyNotes"] ?? "not specified"}
- Verbal tics: ${ctx["verbalTics"] ?? "none"}
- Metaphoric register: ${ctx["metaphoricRegister"] ?? "not specified"}
- Dialogue samples: ${ctx["dialogueSamples"] ?? "none provided"}

## Prose to Evaluate
${ctx["prose"] ?? ""}

## Instructions
Score 1-10 on how well the prose matches this voice:
- 9-10: Voice is unmistakably this character
- 7-8: Voice is mostly consistent with minor drift
- 5-6: Voice is generic, could be anyone
- 3-4: Voice contradicts the fingerprint
- 1-2: Completely wrong voice

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 7+ passes.`,
  passThreshold: 7,
  maxScore: 10,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Subtext Adherence ──────────────────────────────────

export const SUBTEXT_ADHERENCE: Rubric = {
  dimension: "subtext_adherence",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether the prose maintains subtext — the gap between what characters say and what they mean.

## Subtext Specification
- Surface conversation: ${ctx["surfaceConversation"] ?? "not specified"}
- Actual conversation: ${ctx["actualConversation"] ?? "not specified"}
- Enforcement rule: ${ctx["enforcementRule"] ?? "not specified"}

## Prose to Evaluate
${ctx["prose"] ?? ""}

## Instructions
Evaluate on a 3-point scale:
- 3: Subtext is maintained — characters never state the actual conversation directly
- 2: Mostly maintained — one or two moments where subtext becomes text
- 1: Failed — characters directly state what should remain unspoken

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 2+ passes.`,
  passThreshold: 2,
  maxScore: 3,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Tone Whiplash ──────────────────────────────────────

export const TONE_WHIPLASH: Rubric = {
  dimension: "tone_whiplash",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether the transition between two consecutive scenes has jarring tonal shifts (tone whiplash).

## End of Previous Scene
${ctx["prevSceneEnd"] ?? ""}

## Start of Next Scene
${ctx["nextSceneStart"] ?? ""}

## Instructions
Score 1-10 on tonal continuity:
- 9-10: Seamless tonal flow
- 7-8: Minor shift but handled gracefully
- 5-6: Noticeable shift that could disorient readers
- 3-4: Jarring tonal whiplash
- 1-2: Completely disconnected tones

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 7+ passes.`,
  passThreshold: 7,
  maxScore: 10,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Metaphoric Register ────────────────────────────────

export const METAPHORIC_REGISTER: Rubric = {
  dimension: "metaphoric_register",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether all metaphors and figurative language in this prose use approved domains and avoid prohibited domains.

## Approved Metaphor Domains
${ctx["approvedDomains"] ?? "not specified"}

## Prohibited Metaphor Domains
${ctx["prohibitedDomains"] ?? "not specified"}

## Prose to Evaluate
${ctx["prose"] ?? ""}

## Instructions
Evaluate on a 3-point scale:
- 3: All metaphors drawn from approved domains, none from prohibited
- 2: Mostly compliant — one borderline metaphor
- 1: Clear violations — metaphors from prohibited domains

If no metaphoric register is specified, score 3 (pass).

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 2+ passes.`,
  passThreshold: 2,
  maxScore: 3,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Scene Goal Achievement ─────────────────────────────

export const SCENE_GOAL: Rubric = {
  dimension: "scene_goal",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether this prose accomplishes its narrative goal.

## Scene Narrative Goal
${ctx["narrativeGoal"] ?? ""}

## Emotional Beat
${ctx["emotionalBeat"] ?? ""}

## Intended Reader Effect
${ctx["readerEffect"] ?? ""}

## Failure Mode to Avoid
${ctx["failureModeToAvoid"] ?? ""}

## Prose to Evaluate
${ctx["prose"] ?? ""}

## Instructions
Score 1-10:
- 9-10: Goal fully achieved, emotional beat lands, reader effect delivered
- 7-8: Goal mostly achieved, minor misses
- 5-6: Goal partially achieved, significant gaps
- 3-4: Goal barely touched
- 1-2: Goal not achieved or failure mode manifested

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 7+ passes.`,
  passThreshold: 7,
  maxScore: 10,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Cross-Scene Continuity ─────────────────────────────

export const CONTINUITY: Rubric = {
  dimension: "continuity",
  systemPrompt: JUDGE_SYSTEM_BASE,
  buildUserPrompt: (ctx) => `Evaluate whether the opening of a new scene follows naturally from the ending of the previous scene.

## End of Previous Scene
${ctx["prevSceneEnd"] ?? ""}

## Start of Next Scene
${ctx["nextSceneStart"] ?? ""}

## Instructions
Score 1-10 on narrative continuity:
- 9-10: Opening flows naturally from previous ending, maintains physical/emotional state
- 7-8: Good continuity with minor gaps
- 5-6: Noticeable discontinuity in space, time, or character state
- 3-4: Significant continuity break
- 1-2: Scenes feel completely unrelated

Respond with JSON: { "reasoning": "...", "score": N, "passed": true/false, "violations": "..." }
A score of 7+ passes.`,
  passThreshold: 7,
  maxScore: 10,
  outputSchema: STANDARD_SCHEMA,
};

// ─── Registry ───────────────────────────────────────────

export const ALL_RUBRICS: Record<JudgeDimension, Rubric> = {
  voice_consistency: VOICE_CONSISTENCY,
  subtext_adherence: SUBTEXT_ADHERENCE,
  tone_whiplash: TONE_WHIPLASH,
  metaphoric_register: METAPHORIC_REGISTER,
  scene_goal: SCENE_GOAL,
  continuity: CONTINUITY,
};
