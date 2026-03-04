import { describe, expect, it } from "vitest";
import { trimSuggestionOverlap } from "../../src/review/suggestionValidator.js";

describe("trimSuggestionOverlap", () => {
  it("returns suggestion unchanged when no overlap", () => {
    const result = trimSuggestionOverlap("static that resolved", "It was more like ", " and sat down.");
    expect(result).toBe("static that resolved");
  });

  it("trims prefix overlap from suggestion start", () => {
    const result = trimSuggestionOverlap(
      "It was more like static that resolved into a picture",
      "It was more like ",
      ".",
    );
    expect(result).toBe("static that resolved into a picture");
  });

  it("trims suffix overlap from suggestion end", () => {
    const result = trimSuggestionOverlap(
      "a bitter draft swept through the valley",
      "He felt ",
      " swept through the valley",
    );
    expect(result).toBe("a bitter draft");
  });

  it("trims both prefix and suffix overlap", () => {
    const result = trimSuggestionOverlap("She said a quiet word. He turned", "She said ", ". He turned away.");
    expect(result).toBe("a quiet word");
  });

  it("ignores overlaps shorter than minimum length (4 chars)", () => {
    // "He " is only 3 chars — should NOT be trimmed
    const result = trimSuggestionOverlap("He walked away slowly", "He ", " and stopped.");
    expect(result).toBe("He walked away slowly");
  });

  it("handles exact 4-char minimum overlap", () => {
    const result = trimSuggestionOverlap("like a ghost", "more like ", " in the dark.");
    expect(result).toBe("a ghost");
  });

  it("returns suggestion unchanged when prefix/suffix are empty", () => {
    const result = trimSuggestionOverlap("a new phrase", "", "");
    expect(result).toBe("a new phrase");
  });

  it("handles suggestion that is entirely prefix overlap", () => {
    // Edge case: suggestion is a substring of the prefix
    const result = trimSuggestionOverlap("more like", "It was more like", " a file.");
    expect(result).toBe("");
  });

  it("handles the exact user-reported bug scenario", () => {
    const prefix = "It was more like ";
    const suffix = ".";
    const suggestion = "It was more like static that resolved into a picture before he'd decided to look at it.";
    const result = trimSuggestionOverlap(suggestion, prefix, suffix);
    expect(result).toBe("static that resolved into a picture before he'd decided to look at it.");
  });

  it("finds longest matching overlap, not first short match", () => {
    // Prefix ends with "walked into the " — should match the full 17 chars, not just "the "
    const result = trimSuggestionOverlap("walked into the bright room", "She walked into the ", " and sat down.");
    expect(result).toBe("bright room");
  });
});
