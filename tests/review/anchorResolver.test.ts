import { describe, expect, it } from "vitest";
import { resolveAnchor } from "../../src/review/anchorResolver.js";

const DOC =
  "The rain fell softly on the old stone bridge. She paused, looking down at the water below. The rain fell softly again, this time with thunder.";

describe("resolveAnchor", () => {
  // ─── Exact Match ──────────────────────────────

  it("finds unique focus text with exact confidence", () => {
    const result = resolveAnchor(
      DOC,
      { prefix: "on the", focus: "old stone bridge", suffix: ". She" },
      { start: 28, end: 44 },
    );
    expect(result.confidence).toBe("exact");
    expect(DOC.slice(result.start, result.end)).toBe("old stone bridge");
  });

  it("disambiguates duplicate focus via prefix/suffix adjacency", () => {
    // "The rain fell softly" appears twice
    const result = resolveAnchor(
      DOC,
      { prefix: "below.", focus: "The rain fell softly", suffix: "again" },
      { start: 90, end: 110 },
    );
    expect(result.confidence).toBe("exact");
    // Should match the SECOND occurrence
    expect(result.start).toBeGreaterThan(50);
  });

  it("picks closest occurrence when no adjacency context", () => {
    // "the" appears many times, hint points to middle of doc
    const result = resolveAnchor(
      "the cat and the dog and the bird",
      { prefix: "", focus: "the", suffix: "" },
      { start: 15, end: 18 },
    );
    expect(result.confidence).toBe("exact");
    // "the" at 0, 12, 24 — closest to center 16 is position 12
    expect(result.start).toBe(12);
  });

  // ─── Edge Cases ───────────────────────────────

  it("handles focus at document start (no prefix context)", () => {
    const result = resolveAnchor(DOC, { prefix: "", focus: "The rain", suffix: "fell softly" }, { start: 0, end: 8 });
    expect(result.confidence).toBe("exact");
    expect(result.start).toBe(0);
  });

  it("handles focus at document end", () => {
    const doc = "Hello world end";
    const result = resolveAnchor(doc, { prefix: "world", focus: "end", suffix: "" }, { start: 12, end: 15 });
    expect(result.confidence).toBe("exact");
    expect(result.start).toBe(12);
  });

  it("returns failed caret for empty focus + empty prefix + empty suffix", () => {
    const result = resolveAnchor(DOC, { prefix: "", focus: "", suffix: "" }, { start: 10, end: 20 });
    expect(result.confidence).toBe("failed");
    expect(result.start).toBe(result.end);
  });

  it("treats prefix shorter than 2 chars as absent", () => {
    const result = resolveAnchor("abc def ghi", { prefix: "x", focus: "def", suffix: "ghi" }, { start: 4, end: 7 });
    // prefix "x" is too short, treated as absent; suffix "ghi" still validates
    expect(result.confidence).toBe("exact");
    expect(result.start).toBe(4);
  });

  // ─── Fuzzy Path ───────────────────────────────

  it("falls back to prefix...suffix frame when focus not found", () => {
    // Focus text was edited between request and response
    const result = resolveAnchor(
      DOC,
      { prefix: "on the", focus: "NONEXISTENT TEXT", suffix: ". She paused" },
      { start: 28, end: 44 },
    );
    expect(result.confidence).toBe("fuzzy");
    // Should frame between "on the" and ". She paused"
    expect(result.start).toBeGreaterThan(0);
    expect(result.end).toBeGreaterThan(result.start);
  });

  it("picks smallest gap when multiple prefix/suffix pairs exist", () => {
    const doc = "AA hello BB CC hello BB DD";
    const result = resolveAnchor(doc, { prefix: "AA", focus: "MISSING", suffix: "BB" }, { start: 3, end: 8 });
    expect(result.confidence).toBe("fuzzy");
    // Should pick the first AA...BB pair (smaller gap, closer to hint)
    const content = doc.slice(result.start, result.end);
    expect(content).toContain("hello");
  });

  // ─── Failure ──────────────────────────────────

  it("returns zero-width caret on total failure, never a range", () => {
    const result = resolveAnchor(
      DOC,
      { prefix: "XXXXXXX", focus: "YYYYYYY", suffix: "ZZZZZZZ" },
      { start: 50, end: 60 },
    );
    expect(result.confidence).toBe("failed");
    expect(result.start).toBe(result.end);
  });

  it("confidence is fuzzy when only prefix OR suffix matches", () => {
    const result = resolveAnchor(
      DOC,
      { prefix: "on the", focus: "old stone bridge", suffix: "NONEXISTENT" },
      { start: 28, end: 44 },
    );
    // Prefix matches, suffix doesn't → still finds focus via exact path with fuzzy confidence
    expect(result.confidence).toBe("fuzzy");
    expect(DOC.slice(result.start, result.end)).toBe("old stone bridge");
  });

  // ─── Document Drift ───────────────────────────

  it("resolves correctly after text inserted before anchor", () => {
    const modified = `INSERTED TEXT ${DOC}`;
    const result = resolveAnchor(
      modified,
      { prefix: "on the", focus: "old stone bridge", suffix: ". She" },
      { start: 28, end: 44 }, // hint is now wrong due to insertion
    );
    expect(result.confidence).toBe("exact");
    expect(modified.slice(result.start, result.end)).toBe("old stone bridge");
  });

  it("resolves correctly after text deleted within anchor region", () => {
    // Original had "old stone bridge", now has "old bridge"
    const modified = DOC.replace("old stone bridge", "old bridge");
    const result = resolveAnchor(
      modified,
      { prefix: "on the", focus: "old bridge", suffix: ". She" },
      { start: 28, end: 38 },
    );
    expect(result.confidence).toBe("exact");
    expect(modified.slice(result.start, result.end)).toBe("old bridge");
  });

  it("clamps caret to document length on failure with out-of-bounds hint", () => {
    const shortDoc = "hello";
    const result = resolveAnchor(shortDoc, { prefix: "XX", focus: "YY", suffix: "ZZ" }, { start: 1000, end: 2000 });
    expect(result.confidence).toBe("failed");
    expect(result.start).toBe(shortDoc.length);
    expect(result.end).toBe(shortDoc.length);
  });
});
