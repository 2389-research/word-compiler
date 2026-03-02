import { describe, expect, it } from "vitest";
import { buildReviewSystemPrompt, buildReviewUserPrompt, REVIEW_OUTPUT_SCHEMA } from "../../src/review/prompt.js";
import type { ReviewContext } from "../../src/review/types.js";

function makeContext(overrides: Partial<ReviewContext> = {}): ReviewContext {
  return {
    styleRules: {
      killList: [],
      metaphoricRegister: null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      structuralBans: [],
    },
    activeVoices: [],
    povRules: null,
    subtextPolicy: "",
    ...overrides,
  };
}

describe("REVIEW_OUTPUT_SCHEMA", () => {
  it("has annotations array as required property", () => {
    expect(REVIEW_OUTPUT_SCHEMA.required).toContain("annotations");
    const props = REVIEW_OUTPUT_SCHEMA.properties as Record<string, unknown>;
    expect(props.annotations).toBeDefined();
  });

  it("uses anyOf for nullable suggestion field", () => {
    // biome-ignore lint: test accessing nested schema structure
    const annotations = (REVIEW_OUTPUT_SCHEMA as any).properties.annotations;
    const suggestion = annotations.items.properties.suggestion;
    expect(suggestion.anyOf).toBeDefined();
  });
});

describe("buildReviewSystemPrompt", () => {
  it("includes base editorial instructions", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("editorial review assistant");
    expect(prompt).toContain("skilled human editor");
  });

  it("includes severity definitions", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("critical:");
    expect(prompt).toContain("warning:");
    expect(prompt).toContain("info:");
  });

  it("includes kill list as reference-only with no-flag instruction", () => {
    const prompt = buildReviewSystemPrompt(
      makeContext({
        styleRules: {
          ...makeContext().styleRules,
          killList: [
            { pattern: "very", type: "exact" },
            { pattern: "suddenly", type: "exact" },
          ],
        },
      }),
    );
    expect(prompt).toContain("do NOT flag these");
    expect(prompt).toContain("very");
    expect(prompt).toContain("suddenly");
  });

  it("includes POV rules when present", () => {
    const prompt = buildReviewSystemPrompt(
      makeContext({
        povRules: { distance: "intimate", interiority: "stream", reliability: "unreliable" },
      }),
    );
    expect(prompt).toContain("Distance=intimate");
    expect(prompt).toContain("Interiority=stream");
    expect(prompt).toContain("Reliability=unreliable");
  });

  it("includes character voice fingerprints", () => {
    const prompt = buildReviewSystemPrompt(
      makeContext({
        activeVoices: [
          { name: "Alice", fingerprint: "vocab: formal; tics: indeed" },
          { name: "Bob", fingerprint: "vocab: casual" },
        ],
      }),
    );
    expect(prompt).toContain("Alice: vocab: formal");
    expect(prompt).toContain("Bob: vocab: casual");
  });

  it("omits empty sections", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).not.toContain("METAPHORIC REGISTER");
    expect(prompt).not.toContain("VOCABULARY PREFERENCES");
    expect(prompt).not.toContain("STRUCTURAL BANS");
    expect(prompt).not.toContain("POV RULES");
    expect(prompt).not.toContain("CHARACTER VOICES");
    expect(prompt).not.toContain("KILL LIST");
    expect(prompt).not.toContain("SUBTEXT POLICY");
  });

  it("includes deterministic exclusion instruction", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("Do NOT flag");
    expect(prompt).toContain("sentence rhythm");
    expect(prompt).toContain("paragraph length");
  });

  it("includes anchor format instructions", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("prefix");
    expect(prompt).toContain("focus");
    expect(prompt).toContain("suffix");
    expect(prompt).toContain("8-15 words");
  });

  it("includes structural bans when present", () => {
    const prompt = buildReviewSystemPrompt(
      makeContext({
        styleRules: {
          ...makeContext().styleRules,
          structuralBans: ["flashbacks", "dream sequences"],
        },
      }),
    );
    expect(prompt).toContain("flashbacks");
    expect(prompt).toContain("dream sequences");
  });

  it("includes subtext policy when present", () => {
    const prompt = buildReviewSystemPrompt(makeContext({ subtextPolicy: "dark, brooding, atmospheric" }));
    expect(prompt).toContain("dark, brooding, atmospheric");
  });
});

describe("buildReviewUserPrompt", () => {
  it("wraps chunk text with review instruction", () => {
    const prompt = buildReviewUserPrompt("The sky was dark and full of stars.");
    expect(prompt).toContain("Review the following");
    expect(prompt).toContain("The sky was dark and full of stars.");
  });
});
