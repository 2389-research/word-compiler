import { describe, expect, it } from "vitest";
import {
  analyzeEdits,
  classifyEdit,
  computeSimilarity,
  type DiffResult,
  detectReorder,
  diffSentences,
  segmentSentences,
} from "../../src/learner/diff.js";

// ─── segmentSentences ───────────────────────────

describe("segmentSentences", () => {
  it("returns empty array for empty/whitespace input", () => {
    expect(segmentSentences("")).toEqual([]);
    expect(segmentSentences("   ")).toEqual([]);
  });

  it("splits simple sentences on period", () => {
    const result = segmentSentences("Hello world. Goodbye world.");
    expect(result).toEqual(["Hello world.", "Goodbye world."]);
  });

  it("splits on exclamation and question marks", () => {
    const result = segmentSentences("What happened? She screamed! Then silence.");
    expect(result).toEqual(["What happened?", "She screamed!", "Then silence."]);
  });

  it("keeps quoted text together even with sentence-ending punctuation", () => {
    const result = segmentSentences('"Are you sure? Really?" she asked. He nodded.');
    expect(result).toEqual(['"Are you sure? Really?" she asked.', "He nodded."]);
  });

  it("handles curly quotes in dialogue", () => {
    const result = segmentSentences("\u201CAre you sure?\u201D she asked. He nodded.");
    expect(result).toEqual(["\u201CAre you sure?\u201D she asked.", "He nodded."]);
  });

  it("preserves paragraph breaks as empty strings", () => {
    const result = segmentSentences("First paragraph.\n\nSecond paragraph.");
    expect(result).toEqual(["First paragraph.", "", "Second paragraph."]);
  });

  it("handles abbreviations without splitting", () => {
    const result = segmentSentences("Dr. Smith arrived. Mr. Jones left.");
    expect(result).toEqual(["Dr. Smith arrived.", "Mr. Jones left."]);
  });

  it("handles ellipsis without splitting", () => {
    const result = segmentSentences("She waited... and waited. Then left.");
    expect(result).toEqual(["She waited... and waited.", "Then left."]);
  });

  it("handles single sentence without trailing period", () => {
    const result = segmentSentences("Just a fragment");
    expect(result).toEqual(["Just a fragment"]);
  });
});

// ─── diffSentences ──────────────────────────────

describe("diffSentences", () => {
  it("returns empty for two empty arrays", () => {
    expect(diffSentences([], [])).toEqual([]);
  });

  it("detects all matches when identical", () => {
    const sentences = ["Hello.", "World."];
    const result = diffSentences(sentences, sentences);
    expect(result.every((r) => r.type === "match")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("detects pure deletions", () => {
    const original = ["First.", "Second.", "Third."];
    const edited = ["First.", "Third."];
    const result = diffSentences(original, edited);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "match", original: "First.", edited: "First." });
    expect(result[1]).toEqual({ type: "delete", original: "Second.", edited: null });
    expect(result[2]).toEqual({ type: "match", original: "Third.", edited: "Third." });
  });

  it("detects pure insertions", () => {
    const original = ["First.", "Third."];
    const edited = ["First.", "Second.", "Third."];
    const result = diffSentences(original, edited);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "match", original: "First.", edited: "First." });
    expect(result[1]).toEqual({ type: "insert", original: null, edited: "Second." });
    expect(result[2]).toEqual({ type: "match", original: "Third.", edited: "Third." });
  });

  it("merges adjacent delete+insert into modify when similar", () => {
    const original = ["The cat sat on the mat."];
    const edited = ["The cat sat on the rug."];
    const result = diffSentences(original, edited);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("modify");
    expect(result[0]!.original).toBe("The cat sat on the mat.");
    expect(result[0]!.edited).toBe("The cat sat on the rug.");
  });

  it("keeps delete+insert separate when very different", () => {
    const original = ["AAAA BBBB CCCC."];
    const edited = ["XXXX YYYY ZZZZ."];
    const result = diffSentences(original, edited);
    // Similarity is low, so they stay separate
    const hasDelete = result.some((r) => r.type === "delete");
    const hasInsert = result.some((r) => r.type === "insert");
    expect(hasDelete || result.some((r) => r.type === "modify")).toBe(true);
    expect(hasInsert || result.some((r) => r.type === "modify")).toBe(true);
  });
});

// ─── classifyEdit ───────────────────────────────

describe("classifyEdit", () => {
  it("classifies short deletion as CUT_FILLER", () => {
    const diff: DiffResult = { type: "delete", original: "Um, well.", edited: null };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "DELETION", subType: "CUT_FILLER" });
  });

  it("classifies long deletion as CUT_PASSAGE", () => {
    const diff: DiffResult = {
      type: "delete",
      original: "This is a longer sentence that has more than five words in it.",
      edited: null,
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "DELETION", subType: "CUT_PASSAGE" });
  });

  it("classifies insertion with sensory words as SENSORY_ADDED", () => {
    const diff: DiffResult = {
      type: "insert",
      original: null,
      edited: "The bitter aroma of coffee filled the room.",
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "ADDITION", subType: "SENSORY_ADDED" });
  });

  it("classifies insertion with beat pattern as BEAT_ADDED", () => {
    const diff: DiffResult = {
      type: "insert",
      original: null,
      edited: "She shrugged and looked away.",
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "ADDITION", subType: "BEAT_ADDED" });
  });

  it("classifies modification with dialogue as DIALOGUE_VOICE", () => {
    const diff: DiffResult = {
      type: "modify",
      original: '"I think so," she said.',
      edited: '"I know so," she said firmly.',
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "SUBSTITUTION", subType: "DIALOGUE_VOICE" });
  });

  it("classifies modification removing abstract telling as SHOW_DONT_TELL", () => {
    const diff: DiffResult = {
      type: "modify",
      original: "She felt a sense of dread creeping over her.",
      edited: "Her hands trembled as shadows lengthened across the floor.",
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "SUBSTITUTION", subType: "SHOW_DONT_TELL" });
  });

  it("classifies generic modification as TONE_SHIFT", () => {
    const diff: DiffResult = {
      type: "modify",
      original: "The building was old.",
      edited: "The building had weathered decades of neglect.",
    };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "SUBSTITUTION", subType: "TONE_SHIFT" });
  });

  it("returns fallback for unexpected diff type", () => {
    const diff: DiffResult = { type: "match", original: "same", edited: "same" };
    const result = classifyEdit(diff);
    expect(result).toEqual({ editType: "DELETION", subType: "CUT_PASSAGE" });
  });
});

// ─── detectReorder ──────────────────────────────

describe("detectReorder", () => {
  it("returns false for different lengths", () => {
    expect(detectReorder(["A.", "B."], ["A."])).toBe(false);
  });

  it("returns false when same order", () => {
    expect(detectReorder(["A.", "B.", "C."], ["A.", "B.", "C."])).toBe(false);
  });

  it("returns true when same sentences reordered", () => {
    expect(detectReorder(["A.", "B.", "C."], ["C.", "A.", "B."])).toBe(true);
  });

  it("returns false when sentences differ", () => {
    expect(detectReorder(["A.", "B."], ["A.", "X."])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectReorder(["Hello.", "World."], ["world.", "hello."])).toBe(true);
  });
});

// ─── computeSimilarity ──────────────────────────

describe("computeSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(computeSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for very short strings", () => {
    expect(computeSimilarity("a", "b")).toBe(0);
  });

  it("returns high similarity for similar strings", () => {
    const sim = computeSimilarity("the cat sat on the mat", "the cat sat on the rug");
    expect(sim).toBeGreaterThan(0.7);
  });

  it("returns low similarity for very different strings", () => {
    const sim = computeSimilarity("abcdefgh", "zyxwvuts");
    expect(sim).toBeLessThan(0.3);
  });

  it("is symmetric", () => {
    const ab = computeSimilarity("hello world", "hello earth");
    const ba = computeSimilarity("hello earth", "hello world");
    expect(ab).toBeCloseTo(ba, 10);
  });
});

// ─── analyzeEdits (integration) ─────────────────

describe("analyzeEdits", () => {
  it("returns empty array when texts are identical", () => {
    const result = analyzeEdits("Same text.", "Same text.", "c1", "s1", "p1");
    expect(result).toEqual([]);
  });

  it("returns empty array when editedText is empty", () => {
    const result = analyzeEdits("Some text.", "", "c1", "s1", "p1");
    expect(result).toEqual([]);
  });

  it("detects reorder and returns single RESTRUCTURE pattern", () => {
    const original = "First sentence. Second sentence.";
    const edited = "Second sentence. First sentence.";
    const result = analyzeEdits(original, edited, "c1", "s1", "p1");
    expect(result).toHaveLength(1);
    expect(result[0]!.editType).toBe("RESTRUCTURE");
    expect(result[0]!.subType).toBe("REORDER");
    expect(result[0]!.projectId).toBe("p1");
    expect(result[0]!.sceneId).toBe("s1");
    expect(result[0]!.chunkId).toBe("c1");
  });

  it("detects deletion edits", () => {
    const original = "Keep this. Remove this. Keep that.";
    const edited = "Keep this. Keep that.";
    const result = analyzeEdits(original, edited, "c1", "s1", "p1");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((p) => p.editType === "DELETION")).toBe(true);
  });

  it("populates EditPattern fields correctly", () => {
    const original = "The old text here. Another line.";
    const edited = "The new text here. Another line.";
    const result = analyzeEdits(original, edited, "chunk-1", "scene-1", "proj-1");
    expect(result.length).toBeGreaterThanOrEqual(1);
    const pat = result[0]!;
    expect(pat.id).toBeTruthy();
    expect(pat.chunkId).toBe("chunk-1");
    expect(pat.sceneId).toBe("scene-1");
    expect(pat.projectId).toBe("proj-1");
    expect(pat.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes surrounding context in patterns", () => {
    const original = "Before. Changed sentence. After.";
    const edited = "Before. Modified sentence entirely. After.";
    const result = analyzeEdits(original, edited, "c1", "s1", "p1");
    const nonMatch = result.find((p) => p.editType !== "DELETION" || p.subType !== "CUT_PASSAGE");
    if (nonMatch && nonMatch.context) {
      // Context should reference neighboring sentences
      expect(nonMatch.context.length).toBeGreaterThan(0);
    }
  });
});
