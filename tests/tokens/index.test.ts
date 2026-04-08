import { describe, expect, it } from "vitest";
import { countTokens, countWords, lastNTokens, truncateToTokens } from "../../src/tokens/index.js";
import {
  type Chunk,
  createDefaultCompilationConfig,
  createEmptyBible,
  createEmptyCharacterDossier,
  createEmptyScenePlan,
  getCanonicalText,
} from "../../src/types/index.js";

describe("countWords", () => {
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("counts words in simple text", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("handles multiple spaces", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });
});

describe("countTokens", () => {
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("estimates tokens as words × 1.3 (ceiling)", () => {
    // 10 words × 1.3 = 13
    expect(countTokens("one two three four five six seven eight nine ten")).toBe(13);
  });

  it("handles a paragraph", () => {
    const text = "The quick brown fox jumps over the lazy dog near the river bank";
    const words = countWords(text); // 12
    expect(countTokens(text)).toBe(Math.ceil(words * 1.3));
  });
});

describe("truncateToTokens", () => {
  it("returns full text when under budget", () => {
    const text = "short text";
    expect(truncateToTokens(text, 100)).toBe(text);
  });

  it("truncates from end when over budget", () => {
    const text = "one two three four five six seven eight nine ten";
    // maxTokens=5 → maxWords = floor(5/1.3) = 3
    const result = truncateToTokens(text, 5);
    expect(countWords(result)).toBe(3);
    expect(result).toBe("one two three");
  });
});

describe("lastNTokens", () => {
  it("returns full text when under budget", () => {
    const text = "short text";
    expect(lastNTokens(text, 100)).toBe(text);
  });

  it("returns tail words when over budget", () => {
    const text = "one two three four five six seven eight nine ten";
    // tokenCount=5 → maxWords = floor(5/1.3) = 3
    const result = lastNTokens(text, 5);
    expect(countWords(result)).toBe(3);
    expect(result).toBe("eight nine ten");
  });
});

describe("factory functions", () => {
  it("createEmptyBible produces valid structure", () => {
    const bible = createEmptyBible("proj-1");
    expect(bible.projectId).toBe("proj-1");
    expect(bible.version).toBe(1);
    expect(bible.characters).toEqual([]);
    expect(bible.styleGuide.killList).toEqual([]);
    expect(bible.narrativeRules.pov.default).toBe("close-third");
  });

  it("createEmptyScenePlan produces valid structure", () => {
    const plan = createEmptyScenePlan("proj-1");
    expect(plan.projectId).toBe("proj-1");
    expect(plan.id).toBeTruthy();
    expect(plan.chunkCount).toBe(3);
    expect(plan.density).toBe("moderate");
  });

  it("createDefaultCompilationConfig has expected defaults", () => {
    const config = createDefaultCompilationConfig();
    expect(config.modelContextWindow).toBe(200000);
    expect(config.ring1HardCap).toBe(4000);
    expect(config.defaultTemperature).toBe(0.8);
    expect(config.maxNegativeExemplars).toBe(2);
  });

  it("createEmptyCharacterDossier sets name and empty voice", () => {
    const char = createEmptyCharacterDossier("Marcus");
    expect(char.name).toBe("Marcus");
    expect(char.id).toBeTruthy();
    expect(char.voice.dialogueSamples).toEqual([]);
    expect(char.behavior).toBeNull();
  });
});

describe("getCanonicalText", () => {
  const baseChunk: Chunk = {
    id: "c1",
    sceneId: "s1",
    sequenceNumber: 0,
    generatedText: "generated prose",
    payloadHash: "hash",
    model: "test",
    temperature: 0.8,
    topP: 0.92,
    generatedAt: new Date().toISOString(),
    status: "pending",
    editedText: null,
    humanNotes: null,
  };

  it("returns generatedText when no edit", () => {
    expect(getCanonicalText(baseChunk)).toBe("generated prose");
  });

  it("prefers editedText when present", () => {
    const edited = { ...baseChunk, editedText: "human revised" };
    expect(getCanonicalText(edited)).toBe("human revised");
  });
});
