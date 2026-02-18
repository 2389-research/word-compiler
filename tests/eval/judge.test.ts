import { describe, it, expect } from "vitest";
import { parseJudgeResponse } from "../../eval/checks/judge.js";
import {
  VOICE_CONSISTENCY,
  SUBTEXT_ADHERENCE,
  TONE_WHIPLASH,
  METAPHORIC_REGISTER,
  SCENE_GOAL,
  CONTINUITY,
  ALL_RUBRICS,
} from "../../eval/checks/rubrics.js";

// ─── parseJudgeResponse ─────────────────────────────────

describe("parseJudgeResponse", () => {
  it("parses well-formed JSON response", () => {
    const text = '{ "reasoning": "The voice matches well.", "score": 8, "passed": true }';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.dimension).toBe("voice_consistency");
    expect(result.score).toBe(8);
    expect(result.passed).toBe(true);
    expect(result.reasoning).toBe("The voice matches well.");
  });

  it("extracts JSON from markdown code blocks", () => {
    const text = '```json\n{ "reasoning": "Good match.", "score": 9, "passed": true }\n```';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(9);
    expect(result.passed).toBe(true);
  });

  it("extracts JSON from surrounding text", () => {
    const text = 'Here is my evaluation:\n{ "reasoning": "Moderate.", "score": 5, "passed": false }\nEnd.';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(5);
    expect(result.passed).toBe(false);
  });

  it("clamps score to max", () => {
    const text = '{ "reasoning": "Perfect.", "score": 15, "passed": true }';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(10); // maxScore for voice_consistency is 10
  });

  it("clamps negative score to 0", () => {
    const text = '{ "reasoning": "Terrible.", "score": -3, "passed": false }';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(0);
  });

  it("returns fallback on no JSON", () => {
    const text = "I think this is pretty good but I can't output JSON.";
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.reasoning).toContain("PARSE FAILURE");
  });

  it("returns fallback on malformed JSON", () => {
    const text = '{ "reasoning": "ok", "score": "not a number" }';
    const result = parseJudgeResponse(text, VOICE_CONSISTENCY);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.reasoning).toContain("PARSE FAILURE");
  });

  it("uses rubric pass threshold to determine pass/fail", () => {
    // SUBTEXT_ADHERENCE has passThreshold 2, maxScore 3
    const text = '{ "reasoning": "Mostly ok.", "score": 2, "passed": false }';
    const result = parseJudgeResponse(text, SUBTEXT_ADHERENCE);
    // Even though raw "passed" is false, our logic re-evaluates based on threshold
    expect(result.passed).toBe(true); // score 2 >= threshold 2
  });

  it("respects 3-point scale for subtext", () => {
    const text = '{ "reasoning": "Failed.", "score": 1, "passed": false }';
    const result = parseJudgeResponse(text, SUBTEXT_ADHERENCE);
    expect(result.passed).toBe(false); // score 1 < threshold 2
  });
});

// ─── Rubric Prompt Construction ─────────────────────────

describe("rubric prompt construction", () => {
  it("VOICE_CONSISTENCY includes character voice data", () => {
    const prompt = VOICE_CONSISTENCY.buildUserPrompt({
      prose: "Marcus paced the room.",
      sentenceLengthRange: "4-18",
      vocabularyNotes: "Newspaper diction",
      verbalTics: "Look, The thing is",
      metaphoricRegister: "Mechanical",
      dialogueSamples: "Look, nobody remembers.",
    });
    expect(prompt).toContain("4-18");
    expect(prompt).toContain("Newspaper diction");
    expect(prompt).toContain("Mechanical");
    expect(prompt).toContain("Marcus paced the room.");
  });

  it("SUBTEXT_ADHERENCE includes subtext spec", () => {
    const prompt = SUBTEXT_ADHERENCE.buildUserPrompt({
      prose: "They talked about weather.",
      surfaceConversation: "The weather",
      actualConversation: "Their failing marriage",
      enforcementRule: "Never mention the marriage directly",
    });
    expect(prompt).toContain("The weather");
    expect(prompt).toContain("Their failing marriage");
    expect(prompt).toContain("Never mention the marriage directly");
  });

  it("TONE_WHIPLASH includes scene boundary text", () => {
    const prompt = TONE_WHIPLASH.buildUserPrompt({
      prevSceneEnd: "The door closed softly.",
      nextSceneStart: "BANG. Marcus hit the floor.",
    });
    expect(prompt).toContain("The door closed softly.");
    expect(prompt).toContain("BANG. Marcus hit the floor.");
  });

  it("SCENE_GOAL includes all scene plan fields", () => {
    const prompt = SCENE_GOAL.buildUserPrompt({
      prose: "Scene prose here.",
      narrativeGoal: "Establish mystery",
      emotionalBeat: "Unease",
      readerEffect: "Something is wrong",
      failureModeToAvoid: "Stating emotions directly",
    });
    expect(prompt).toContain("Establish mystery");
    expect(prompt).toContain("Unease");
    expect(prompt).toContain("Stating emotions directly");
  });

  it("CONTINUITY includes both scene boundaries", () => {
    const prompt = CONTINUITY.buildUserPrompt({
      prevSceneEnd: "She vanished into the fog.",
      nextSceneStart: "The fog was everywhere now.",
    });
    expect(prompt).toContain("She vanished into the fog.");
    expect(prompt).toContain("The fog was everywhere now.");
  });
});

// ─── Rubric Registry ────────────────────────────────────

describe("rubric registry", () => {
  it("ALL_RUBRICS contains all 6 dimensions", () => {
    expect(Object.keys(ALL_RUBRICS)).toHaveLength(6);
    expect(ALL_RUBRICS.voice_consistency).toBe(VOICE_CONSISTENCY);
    expect(ALL_RUBRICS.subtext_adherence).toBe(SUBTEXT_ADHERENCE);
    expect(ALL_RUBRICS.tone_whiplash).toBe(TONE_WHIPLASH);
    expect(ALL_RUBRICS.metaphoric_register).toBe(METAPHORIC_REGISTER);
    expect(ALL_RUBRICS.scene_goal).toBe(SCENE_GOAL);
    expect(ALL_RUBRICS.continuity).toBe(CONTINUITY);
  });

  it("each rubric has valid passThreshold ≤ maxScore", () => {
    for (const rubric of Object.values(ALL_RUBRICS)) {
      expect(rubric.passThreshold).toBeLessThanOrEqual(rubric.maxScore);
      expect(rubric.passThreshold).toBeGreaterThan(0);
    }
  });
});
