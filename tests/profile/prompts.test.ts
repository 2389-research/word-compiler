import { describe, expect, it } from "vitest";
import {
  buildStage1Prompt,
  buildStage4Prompt,
  buildStage5Prompt,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  STAGE4_SYSTEM,
  STAGE5_SYSTEM,
} from "../../src/profile/prompts.js";
import type { DocumentChunk } from "../../src/profile/types.js";

function makeChunk(overrides: Partial<DocumentChunk> = {}): DocumentChunk {
  return {
    text: "The rain fell softly on the cobblestones.",
    index: 0,
    total: 3,
    isFirst: true,
    isLast: false,
    overlapPrev: null,
    overlapNext: null,
    tokenCount: 10,
    ...overrides,
  };
}

describe("system prompts", () => {
  it("all system prompts are non-empty strings", () => {
    for (const prompt of [STAGE1_SYSTEM, STAGE2_SYSTEM, STAGE3_SYSTEM, STAGE4_SYSTEM, STAGE5_SYSTEM]) {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("buildStage1Prompt", () => {
  it("includes chunk text and position metadata", () => {
    const chunk = makeChunk({ index: 1, total: 5, isFirst: false, isLast: false });
    const result = buildStage1Prompt(chunk);
    expect(result).toContain("The rain fell softly on the cobblestones.");
    expect(result).toContain("<chunk>");
    expect(result).toContain("</chunk>");
    // Position metadata
    expect(result).toMatch(/chunk\s*(2|index.*1)/i); // chunk index or 1-based
    expect(result).toMatch(/5/); // total chunks
  });

  it("includes overlap tags when present", () => {
    const chunk = makeChunk({
      index: 1,
      total: 3,
      isFirst: false,
      isLast: false,
      overlapPrev: "Previous context text here.",
      overlapNext: "Next context text here.",
    });
    const result = buildStage1Prompt(chunk);
    expect(result).toContain("Previous context text here.");
    expect(result).toContain("Next context text here.");
    expect(result).toMatch(/context only/i);
  });

  it("omits overlap tags when null", () => {
    const chunk = makeChunk({
      index: 0,
      total: 3,
      isFirst: true,
      isLast: false,
      overlapPrev: null,
      overlapNext: null,
    });
    const result = buildStage1Prompt(chunk);
    expect(result).not.toContain("<overlap_prev>");
    expect(result).not.toContain("<overlap_next>");
  });
});

describe("buildStage4Prompt", () => {
  it("includes source and target domain names", () => {
    const result = buildStage4Prompt("[]", "newsletter", "essay");
    expect(result).toContain("newsletter");
    expect(result).toContain("essay");
  });
});

describe("buildStage5Prompt", () => {
  it("includes document count and confidence counts", () => {
    const result = buildStage5Prompt("[]", 12, "newsletter", "essay", 5, 3, 2, []);
    expect(result).toContain("12");
    expect(result).toContain("5");
    expect(result).toContain("3");
    expect(result).toContain("2");
  });
});
