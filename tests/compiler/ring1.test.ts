import { describe, it, expect } from "vitest";
import { buildRing1 } from "../../src/compiler/ring1.js";
import {
  createEmptyBible,
  createDefaultCompilationConfig,
  type Bible,
  type CompilationConfig,
} from "../../src/types/index.js";

function makeBible(overrides: Partial<Bible> = {}): Bible {
  return { ...createEmptyBible("test"), ...overrides };
}

function makeConfig(overrides: Partial<CompilationConfig> = {}): CompilationConfig {
  return { ...createDefaultCompilationConfig(), ...overrides };
}

describe("buildRing1", () => {
  it("empty bible → header + POV (default pov always present)", () => {
    const result = buildRing1(makeBible(), makeConfig());
    expect(result.text).toContain("=== PROJECT VOICE ===");
    // HEADER + POV (default bible always has pov)
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]!.name).toBe("HEADER");
    expect(result.sections[1]!.name).toBe("POV");
    expect(result.wasTruncated).toBe(false);
  });

  it("kill-list-only bible → header + NEVER WRITE", () => {
    const bible = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [
          { pattern: "a sense of", type: "exact" },
          { pattern: "palpable tension", type: "exact" },
        ],
      },
    });
    const result = buildRing1(bible, makeConfig());
    expect(result.text).toContain("NEVER WRITE:");
    expect(result.text).toContain('"a sense of"');
    expect(result.text).toContain('"palpable tension"');
    expect(result.sections).toHaveLength(3); // HEADER + NEVER_WRITE + POV (always present from defaults)
  });

  it("structural kill list entries excluded from NEVER WRITE", () => {
    const bible = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [
          { pattern: "a sense of", type: "exact" },
          { pattern: "3+ consecutive same-structure sentences", type: "structural" },
        ],
      },
    });
    const result = buildRing1(bible, makeConfig());
    const neverWrite = result.sections.find((s) => s.name === "NEVER_WRITE");
    expect(neverWrite).toBeDefined();
    expect(neverWrite!.text).toContain('"a sense of"');
    expect(neverWrite!.text).not.toContain("consecutive");
  });

  it("full bible → all sections in order", () => {
    const bible = makeBible({
      styleGuide: {
        metaphoricRegister: {
          approvedDomains: ["machinery", "water"],
          prohibitedDomains: ["flowers"],
        },
        vocabularyPreferences: [{ preferred: "calcified", insteadOf: "hardened" }],
        sentenceArchitecture: {
          targetVariance: "High variance",
          fragmentPolicy: "sparingly",
          notes: null,
        },
        paragraphPolicy: {
          maxSentences: 5,
          singleSentenceFrequency: "every 3rd paragraph",
          notes: null,
        },
        killList: [{ pattern: "a sense of", type: "exact" }],
        negativeExemplars: [
          { text: "She felt a wave of sadness", annotation: "telling not showing" },
        ],
        positiveExemplars: [
          { text: "The glass sweated in his grip", annotation: "embodied detail" },
        ],
        structuralBans: ["Never end on stated emotion"],
      },
      narrativeRules: {
        pov: {
          default: "close-third",
          distance: "intimate",
          interiority: "filtered",
          reliability: "reliable",
          notes: "Marcus only",
        },
        subtextPolicy: "Never state the theme",
        expositionPolicy: "Drip-feed only",
        sceneEndingPolicy: "End on action, not reflection",
        setups: [],
      },
    });

    const result = buildRing1(bible, makeConfig());
    const names = result.sections.map((s) => s.name);

    expect(names).toEqual([
      "HEADER",
      "METAPHORS",
      "VOCABULARY",
      "SENTENCES",
      "PARAGRAPHS",
      "NEVER_WRITE",
      "STRUCTURAL_RULES",
      "NEGATIVE_EXEMPLARS",
      "POSITIVE_EXEMPLARS",
      "POV",
      "NARRATIVE_RULES",
    ]);

    // Check text is joined with double newlines
    expect(result.text).toContain("=== PROJECT VOICE ===\n\n");
    expect(result.text).toContain("METAPHORS:");
    expect(result.text).toContain("VOCABULARY:");
  });

  it("exemplars capped at config values", () => {
    const bible = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        negativeExemplars: [
          { text: "bad 1", annotation: "a" },
          { text: "bad 2", annotation: "b" },
          { text: "bad 3", annotation: "c" },
        ],
        positiveExemplars: [
          { text: "good 1", annotation: "a" },
          { text: "good 2", annotation: "b" },
          { text: "good 3", annotation: "c" },
        ],
      },
    });

    const config = makeConfig({ maxNegativeExemplars: 1, maxPositiveExemplars: 1 });
    const result = buildRing1(bible, config);

    const negSection = result.sections.find((s) => s.name === "NEGATIVE_EXEMPLARS");
    expect(negSection!.text).toContain('"bad 1"');
    expect(negSection!.text).not.toContain('"bad 2"');

    const posSection = result.sections.find((s) => s.name === "POSITIVE_EXEMPLARS");
    expect(posSection!.text).toContain('"good 1"');
    expect(posSection!.text).not.toContain('"good 2"');
  });

  it("over-cap truncation sets wasTruncated flag", () => {
    // Create a bible with lots of text so it exceeds a tiny hard cap
    const longExemplars = Array.from({ length: 20 }, (_, i) => ({
      text: `This is a long negative exemplar number ${i} that uses many words to fill space and exceed our token budget`,
      annotation: `annotation ${i}`,
    }));

    const bible = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        negativeExemplars: longExemplars,
        positiveExemplars: longExemplars.map((e) => ({
          ...e,
          text: e.text.replace("negative", "positive"),
        })),
      },
    });

    const config = makeConfig({ ring1HardCap: 30, maxNegativeExemplars: 20, maxPositiveExemplars: 20 });
    const result = buildRing1(bible, config);

    expect(result.wasTruncated).toBe(true);
    expect(result.tokenCount).toBeLessThanOrEqual(30);
  });

  it("POV section includes all fields", () => {
    const bible = makeBible({
      narrativeRules: {
        ...createEmptyBible("test").narrativeRules,
        pov: {
          default: "first",
          distance: "intimate",
          interiority: "stream",
          reliability: "unreliable",
          notes: "paranoid narrator",
        },
      },
    });

    const result = buildRing1(bible, makeConfig());
    const povSection = result.sections.find((s) => s.name === "POV");
    expect(povSection).toBeDefined();
    expect(povSection!.text).toContain("first");
    expect(povSection!.text).toContain("intimate");
    expect(povSection!.text).toContain("stream");
    expect(povSection!.text).toContain("unreliable");
    expect(povSection!.text).toContain("paranoid narrator");
    expect(povSection!.immune).toBe(true);
  });

  it("immune sections have priority 0", () => {
    const bible = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [{ pattern: "test", type: "exact" }],
        structuralBans: ["no ban"],
      },
    });

    const result = buildRing1(bible, makeConfig());
    const immuneSections = result.sections.filter((s) => s.immune);
    for (const s of immuneSections) {
      expect(s.priority).toBe(0);
    }
  });
});
