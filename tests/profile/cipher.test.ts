import { describe, expect, it } from "vitest";
import { buildBatchCipherPrompt, CIPHER_BATCH_SIZE, CIPHER_SYSTEM } from "../../server/profile/cipher.js";

describe("buildBatchCipherPrompt", () => {
  it("includes all edit pairs", () => {
    const edits = [
      { original: "She felt sad", edited: "Her hands shook" },
      { original: "He said hello", edited: "He nodded" },
    ];
    const prompt = buildBatchCipherPrompt(edits);
    expect(prompt).toContain("She felt sad");
    expect(prompt).toContain("He nodded");
    expect(prompt).toContain("Edit 1");
    expect(prompt).toContain("Edit 2");
  });

  it("truncates long texts to token limit", () => {
    // 2000 tokens ≈ 8000 chars, so a 20000-char string should be truncated
    const longText = "word ".repeat(4000);
    const edits = [{ original: longText, edited: "short" }];
    const prompt = buildBatchCipherPrompt(edits);
    expect(prompt.length).toBeLessThan(longText.length);
  });

  it("CIPHER_SYSTEM is non-empty", () => {
    expect(CIPHER_SYSTEM.length).toBeGreaterThan(10);
  });

  it("CIPHER_BATCH_SIZE is 10", () => {
    expect(CIPHER_BATCH_SIZE).toBe(10);
  });
});
