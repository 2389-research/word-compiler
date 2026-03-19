import { describe, expect, it } from "vitest";
import { shouldTriggerCipher } from "@/profile/editFilter.js";

describe("shouldTriggerCipher", () => {
  // Should NOT trigger
  it("returns false for identical text", () => {
    expect(shouldTriggerCipher("Hello world", "Hello world")).toBe(false);
  });
  it("returns false for whitespace-only changes", () => {
    expect(shouldTriggerCipher("Hello  world", "Hello world")).toBe(false);
    expect(shouldTriggerCipher("Hello world\n", "Hello world")).toBe(false);
  });
  it("returns false for tiny edits (typos)", () => {
    expect(shouldTriggerCipher("Hello world", "Hello worlf")).toBe(false);
    expect(shouldTriggerCipher("She walked to the store quickly", "She walked to the store quikly")).toBe(false);
  });
  it("returns false for punctuation-only changes", () => {
    expect(shouldTriggerCipher("Hello world.", "Hello world!")).toBe(false);
    expect(shouldTriggerCipher("Hello, world", "Hello world")).toBe(false);
  });
  it("returns false for capitalization-only changes", () => {
    expect(shouldTriggerCipher("hello world", "Hello World")).toBe(false);
  });
  it("returns false for empty strings", () => {
    expect(shouldTriggerCipher("", "")).toBe(false);
  });

  // SHOULD trigger
  it("returns true for semantic rewrites", () => {
    expect(shouldTriggerCipher("She felt overwhelmed by sadness", "Her hands shook")).toBe(true);
  });
  it("returns true for action substitutions", () => {
    expect(shouldTriggerCipher("He said hello", "He nodded")).toBe(true);
  });
  it("returns true for deliberate cuts", () => {
    expect(
      shouldTriggerCipher("The sky was blue and beautiful and stretched endlessly above them", "The sky was blue"),
    ).toBe(true);
  });
  it("returns true for significant expansions", () => {
    expect(
      shouldTriggerCipher(
        "He walked away",
        "He walked to the door, pausing at the threshold to look back one last time",
      ),
    ).toBe(true);
  });
  it("returns true for dialogue voice changes", () => {
    expect(
      shouldTriggerCipher('"I think we should probably go," she said nervously.', '"We should go," she said.'),
    ).toBe(true);
  });
  it("returns true for tone shifts", () => {
    expect(
      shouldTriggerCipher(
        "The devastating loss shattered everything she had ever known.",
        "She noticed the house was empty. The coat rack by the door held nothing.",
      ),
    ).toBe(true);
  });
});
