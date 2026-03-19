import { describe, expect, it } from "vitest";
import { chunkDocument, splitParagraphs, splitSentences } from "../../src/profile/chunker.js";
import type { PipelineConfig, WritingSample } from "../../src/profile/types.js";
import { createDefaultPipelineConfig, createWritingSample } from "../../src/profile/types.js";

function makeSample(text: string, domain = "fiction"): WritingSample {
  return createWritingSample(null, domain, text);
}

function makeConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return { ...createDefaultPipelineConfig(), ...overrides };
}

describe("splitParagraphs", () => {
  it("splits on double newlines", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const result = splitParagraphs(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("First paragraph.");
    expect(result[1]).toBe("Second paragraph.");
    expect(result[2]).toBe("Third paragraph.");
  });

  it("handles transcript-style (single newlines) by grouping ~30 lines", () => {
    const lines = Array.from({ length: 90 }, (_, i) => `Line ${i + 1}: Some content here.`);
    const text = lines.join("\n");
    const result = splitParagraphs(text);
    // 90 lines grouped into ~30-line blocks → 3 blocks
    expect(result.length).toBe(3);
    // Each block should contain roughly 30 lines
    for (const block of result) {
      const blockLines = block.split("\n").filter((l) => l.length > 0);
      expect(blockLines.length).toBeGreaterThanOrEqual(28);
      expect(blockLines.length).toBeLessThanOrEqual(32);
    }
  });
});

describe("splitSentences", () => {
  it("splits on . ! ? followed by whitespace", () => {
    const text = "Hello world. How are you? I am fine! Great.";
    const result = splitSentences(text);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe("Hello world.");
    expect(result[1]).toBe("How are you?");
    expect(result[2]).toBe("I am fine!");
    expect(result[3]).toBe("Great.");
  });
});

describe("chunkDocument", () => {
  it("returns single chunk for short documents", () => {
    const sample = makeSample("A short piece of writing.");
    const config = makeConfig({ chunkTargetTokens: 10000 });
    const chunks = chunkDocument(sample, config);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe("A short piece of writing.");
  });

  it("single chunk has isFirst=true, isLast=true, null overlaps", () => {
    const sample = makeSample("A short piece of writing.");
    const config = makeConfig({ chunkTargetTokens: 10000 });
    const chunks = chunkDocument(sample, config);
    expect(chunks[0]!.isFirst).toBe(true);
    expect(chunks[0]!.isLast).toBe(true);
    expect(chunks[0]!.overlapPrev).toBeNull();
    expect(chunks[0]!.overlapNext).toBeNull();
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.total).toBe(1);
  });

  it("produces multiple chunks with overlap for long documents", () => {
    // Generate a long document that exceeds chunkTargetTokens
    const paragraphs = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}. ${"word ".repeat(80)}`);
    const text = paragraphs.join("\n\n");
    const config = makeConfig({ chunkTargetTokens: 500, chunkOverlapTokens: 50 });
    const sample = makeSample(text);
    const chunks = chunkDocument(sample, config);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("multi-chunk: first has isFirst=true, last has isLast=true", () => {
    const paragraphs = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}. ${"word ".repeat(80)}`);
    const text = paragraphs.join("\n\n");
    const config = makeConfig({ chunkTargetTokens: 500, chunkOverlapTokens: 50 });
    const sample = makeSample(text);
    const chunks = chunkDocument(sample, config);

    expect(chunks[0]!.isFirst).toBe(true);
    expect(chunks[0]!.isLast).toBe(false);
    expect(chunks[chunks.length - 1]!.isFirst).toBe(false);
    expect(chunks[chunks.length - 1]!.isLast).toBe(true);
  });

  it("interior chunks have non-null overlapPrev", () => {
    const paragraphs = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}. ${"word ".repeat(80)}`);
    const text = paragraphs.join("\n\n");
    const config = makeConfig({ chunkTargetTokens: 500, chunkOverlapTokens: 50 });
    const sample = makeSample(text);
    const chunks = chunkDocument(sample, config);

    // All chunks after the first should have overlapPrev
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.overlapPrev).not.toBeNull();
      expect(chunks[i]!.overlapPrev!.length).toBeGreaterThan(0);
    }
  });

  it("each chunk has tokenCount > 0", () => {
    const paragraphs = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}. ${"word ".repeat(80)}`);
    const text = paragraphs.join("\n\n");
    const config = makeConfig({ chunkTargetTokens: 500, chunkOverlapTokens: 50 });
    const sample = makeSample(text);
    const chunks = chunkDocument(sample, config);

    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });
});
