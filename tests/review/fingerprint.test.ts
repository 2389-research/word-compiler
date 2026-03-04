import { describe, expect, it } from "vitest";
import { hashFingerprint } from "../../src/review/fingerprint.js";

describe("hashFingerprint", () => {
  it("produces same hash for same category + focus", () => {
    const a = hashFingerprint("tone", "the sky was dark");
    const b = hashFingerprint("tone", "the sky was dark");
    expect(a).toBe(b);
  });

  it("produces different hash for different category", () => {
    const a = hashFingerprint("tone", "the sky was dark");
    const b = hashFingerprint("grammar", "the sky was dark");
    expect(a).not.toBe(b);
  });

  it("produces different hash for different focus text", () => {
    const a = hashFingerprint("tone", "the sky was dark");
    const b = hashFingerprint("tone", "the morning was bright");
    expect(a).not.toBe(b);
  });

  it("truncates focus to 50 chars for stability", () => {
    const longFocus = "a".repeat(100);
    const a = hashFingerprint("tone", longFocus);
    const b = hashFingerprint("tone", `${longFocus.slice(0, 50)}DIFFERENT`);
    expect(a).toBe(b);
  });

  it("handles empty focus", () => {
    const result = hashFingerprint("tone", "");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a base-36 string", () => {
    const result = hashFingerprint("voice", "hello world");
    expect(result).toMatch(/^-?[0-9a-z]+$/);
  });
});
