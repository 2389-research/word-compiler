import { describe, expect, it } from "vitest";
import { measureVoiceSeparability } from "../../src/metrics/voiceSeparability.js";
import { type Bible, createEmptyBible } from "../../src/types/index.js";

function makeBibleWithChars(): Bible {
  return {
    ...createEmptyBible("proj-1"),
    characters: [
      {
        id: "char-alice",
        name: "Alice",
        role: "protagonist",
        physicalDescription: null,
        backstory: null,
        selfNarrative: null,
        contradictions: null,
        voice: {
          sentenceLengthRange: null,
          vocabularyNotes: null,
          verbalTics: [],
          metaphoricRegister: null,
          prohibitedLanguage: [],
          dialogueSamples: [],
        },
        behavior: null,
      },
      {
        id: "char-bob",
        name: "Bob",
        role: "supporting",
        physicalDescription: null,
        backstory: null,
        selfNarrative: null,
        contradictions: null,
        voice: {
          sentenceLengthRange: null,
          vocabularyNotes: null,
          verbalTics: [],
          metaphoricRegister: null,
          prohibitedLanguage: [],
          dialogueSamples: [],
        },
        behavior: null,
      },
    ],
  };
}

describe("measureVoiceSeparability", () => {
  it("returns no-measurement result when no attributed dialogue found", () => {
    const bible = makeBibleWithChars();
    const result = measureVoiceSeparability([{ sceneId: "s1", prose: "The room was silent. Nothing moved." }], bible);
    expect(result.characterStats).toHaveLength(0);
    expect(result.separable).toBe(true); // Can't flag without data
    expect(result.detail).toContain("No attributed dialogue");
  });

  it("detects separable voices with clearly distinct sentence lengths", () => {
    const bible = makeBibleWithChars();
    // Alice: short, clipped sentences
    // Bob: long, elaborate sentences
    const prose = [
      `"Yes," Alice said. "No," Alice replied. "Fine," Alice answered. "I understand," Alice said.`,
      `"Well, you see, the thing is that I've been thinking about this for quite some time now and I simply cannot arrive at a satisfactory conclusion without more information," Bob said.`,
      `"I must admit that my thoughts on this matter are considerably more complex than a simple affirmation or negation could adequately convey," Bob replied.`,
    ].join("\n\n");

    const result = measureVoiceSeparability([{ sceneId: "s1", prose }], bible);
    expect(result.characterStats.length).toBeGreaterThanOrEqual(1);
  });

  it("returns separable: true for single speaker", () => {
    const bible = makeBibleWithChars();
    const prose = `"Let me think about that," Alice said. "I need more time," Alice replied. "Give me a moment," Alice answered.`;
    const result = measureVoiceSeparability([{ sceneId: "s1", prose }], bible);
    expect(result.separable).toBe(true);
    expect(result.detail).toContain("one character");
  });

  it("combines prose from multiple scenes", () => {
    const bible = makeBibleWithChars();
    const scene1 = { sceneId: "s1", prose: `"Yes," Alice said.` };
    const scene2 = { sceneId: "s2", prose: `"No," Alice replied.` };
    const result = measureVoiceSeparability([scene1, scene2], bible);
    const aliceStats = result.characterStats.find((s) => s.characterId === "char-alice");
    expect(aliceStats).toBeDefined();
    expect(aliceStats!.dialogueCount).toBe(2);
  });

  it("reports inter-character variance", () => {
    const bible = makeBibleWithChars();
    const prose = [
      `"Yes," Alice said. "No," Alice replied.`,
      `"Actually, I was thinking about something completely different when you mentioned that earlier this afternoon," Bob said.`,
    ].join("\n\n");
    const result = measureVoiceSeparability([{ sceneId: "s1", prose }], bible);
    expect(typeof result.interCharacterVariance).toBe("number");
    expect(result.interCharacterVariance).toBeGreaterThanOrEqual(0);
  });
});
