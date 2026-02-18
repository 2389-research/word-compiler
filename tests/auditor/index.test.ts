import { describe, it, expect } from "vitest";
import {
  checkKillList,
  checkSentenceVariance,
  checkParagraphLength,
  computeMetrics,
  splitSentences,
  runAudit,
} from "../../src/auditor/index.js";
import { createEmptyBible } from "../../src/types/index.js";

describe("checkKillList", () => {
  it("clean prose returns no flags", () => {
    const flags = checkKillList(
      "The bar was quiet and the ice melted slowly.",
      [{ pattern: "a sense of", type: "exact" }],
      "s1",
    );
    expect(flags).toHaveLength(0);
  });

  it("single violation found", () => {
    const flags = checkKillList(
      "He felt a sense of dread as he walked in.",
      [{ pattern: "a sense of", type: "exact" }],
      "s1",
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe("critical");
    expect(flags[0]!.category).toBe("kill_list");
    expect(flags[0]!.message).toContain("a sense of");
  });

  it("multiple violations found", () => {
    const flags = checkKillList(
      "A sense of dread filled him. Later, a sense of relief washed over.",
      [{ pattern: "a sense of", type: "exact" }],
      "s1",
    );
    expect(flags).toHaveLength(2);
  });

  it("case insensitive matching", () => {
    const flags = checkKillList(
      "A Sense Of dread filled the room.",
      [{ pattern: "a sense of", type: "exact" }],
      "s1",
    );
    expect(flags).toHaveLength(1);
  });

  it("regex special characters escaped properly", () => {
    const flags = checkKillList(
      "The price was $100 (plus tax).",
      [{ pattern: "$100 (plus", type: "exact" }],
      "s1",
    );
    expect(flags).toHaveLength(1);
  });

  it("structural entries ignored", () => {
    const flags = checkKillList(
      "He felt a sense of dread.",
      [{ pattern: "a sense of", type: "structural" }],
      "s1",
    );
    expect(flags).toHaveLength(0);
  });

  it("includes line reference", () => {
    const flags = checkKillList(
      "Line one.\nLine two.\nHe felt a sense of dread.",
      [{ pattern: "a sense of", type: "exact" }],
      "s1",
    );
    expect(flags[0]!.lineReference).toBe("line 3");
  });
});

describe("splitSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    const result = splitSentences("First sentence. Second sentence. Third sentence.");
    expect(result).toHaveLength(3);
  });

  it("handles abbreviations", () => {
    const result = splitSentences("Mr. Smith went home. Dr. Jones followed.");
    expect(result).toHaveLength(2);
  });

  it("empty text returns empty array", () => {
    expect(splitSentences("")).toHaveLength(0);
    expect(splitSentences("   ")).toHaveLength(0);
  });
});

describe("checkSentenceVariance", () => {
  it("fewer than 5 sentences → no flags", () => {
    const flags = checkSentenceVariance("Short. Very short. Also short. Done.", "s1");
    expect(flags).toHaveLength(0);
  });

  it("varied sentences → no monotony warning", () => {
    const prose = [
      "He walked in.",
      "The bar stretched before him like a long dark corridor with no visible end.",
      "Nobody moved.",
      "A glass clinked somewhere in the darkness behind the bar where the old bartender shuffled slowly.",
      "She looked up briefly then returned her attention to the condensation forming on the cold surface of her glass.",
      "Silence.",
    ].join(" ");
    const flags = checkSentenceVariance(prose, "s1");
    const warnings = flags.filter((f) => f.severity === "warning");
    expect(warnings).toHaveLength(0);
  });

  it("monotonous sentences → flags warning", () => {
    // All 8-word sentences
    const prose = [
      "He walked into the bar that night.",
      "She looked up from her glass slowly.",
      "The room was quiet and rather dim.",
      "Nobody spoke a single word at all.",
      "He sat down at the old bar.",
      "She turned away without saying a word.",
    ].join(" ");
    const flags = checkSentenceVariance(prose, "s1");
    const warnings = flags.filter((f) => f.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]!.category).toBe("rhythm_monotony");
  });

  it("3+ consecutive similar-length → flags info", () => {
    // Three 8-word sentences followed by different lengths
    const prose = [
      "He walked into the bar that night.",
      "She looked up from her glass slowly.",
      "The room was quiet and very still.",
      "Nobody said anything at all in the long dim room that stretched before them like an endless corridor into darkness.",
      "He sat down at the far end of the bar where the shadows were deepest and the light barely reached.",
    ].join(" ");
    const flags = checkSentenceVariance(prose, "s1");
    const infos = flags.filter((f) => f.severity === "info");
    expect(infos.length).toBeGreaterThanOrEqual(1);
  });
});

describe("checkParagraphLength", () => {
  it("null maxSentences → no flags", () => {
    const flags = checkParagraphLength("Long paragraph with many sentences.", null, "s1");
    expect(flags).toHaveLength(0);
  });

  it("under limit → no flags", () => {
    const flags = checkParagraphLength(
      "First sentence. Second sentence. Third sentence.",
      5,
      "s1",
    );
    expect(flags).toHaveLength(0);
  });

  it("over limit → flags warning", () => {
    const prose =
      "One thing happened. Then another thing. And another. Plus more. Yet more things. Even more. Way too many sentences here.";
    const flags = checkParagraphLength(prose, 4, "s1");
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe("warning");
    expect(flags[0]!.category).toBe("paragraph_length");
  });

  it("multiple paragraphs checked independently", () => {
    const prose =
      "Short paragraph here. Just two sentences.\n\nAnother one. Also short. Just three.\n\nThis paragraph has way too many sentences for the limit. One more. And another. Plus this one. And even more.";
    const flags = checkParagraphLength(prose, 3, "s1");
    expect(flags).toHaveLength(1); // Only the last paragraph exceeds
  });
});

describe("computeMetrics", () => {
  it("correct word count", () => {
    const m = computeMetrics("Hello world. This is a test.");
    expect(m.wordCount).toBe(6);
  });

  it("correct sentence count", () => {
    const m = computeMetrics("First sentence. Second sentence. Third sentence.");
    expect(m.sentenceCount).toBe(3);
  });

  it("paragraph count", () => {
    const m = computeMetrics("Paragraph one.\n\nParagraph two.\n\nParagraph three.");
    expect(m.paragraphCount).toBe(3);
  });

  it("type-token ratio", () => {
    const m = computeMetrics("the cat sat on the mat the cat the mat");
    // 5 unique words out of 10 total
    expect(m.typeTokenRatio).toBe(0.5);
  });

  it("handles empty input", () => {
    const m = computeMetrics("");
    expect(m.wordCount).toBe(0);
    expect(m.sentenceCount).toBe(0);
    expect(m.avgSentenceLength).toBe(0);
  });
});

describe("runAudit", () => {
  it("combines all checks", () => {
    const bible = {
      ...createEmptyBible("test"),
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [{ pattern: "a sense of", type: "exact" as const }],
        paragraphPolicy: { maxSentences: 3, singleSentenceFrequency: null, notes: null },
      },
    };
    const prose = "He felt a sense of dread. Short. Short. Short. Short. Short.";
    const { flags, metrics } = runAudit(prose, bible, "s1");

    expect(flags.some((f) => f.category === "kill_list")).toBe(true);
    expect(metrics.wordCount).toBeGreaterThan(0);
  });
});
