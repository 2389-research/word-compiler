import { describe, expect, it } from "vitest";
import {
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  buildSuggestionRequestPrompt,
  REVIEW_OUTPUT_SCHEMA,
  SUGGESTION_REQUEST_SCHEMA,
} from "../../src/review/prompt.js";
import type { EditorialAnnotation, ReviewContext } from "../../src/review/types.js";

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

function makeAnnotation(overrides: Partial<EditorialAnnotation> = {}): EditorialAnnotation {
  return {
    id: "ann-1",
    category: "tone",
    severity: "warning",
    scope: "narration",
    message: "Overwrought metaphor",
    suggestion: null,
    anchor: { prefix: "She walked into ", focus: "the cathedral of light", suffix: " and sat down." },
    charRange: { start: 16, end: 38 },
    fingerprint: "fp-1",
    ...overrides,
  };
}

// ─── Schema Shape ───────────────────────────────

describe("REVIEW_OUTPUT_SCHEMA", () => {
  it("requires annotations array at top level", () => {
    expect(REVIEW_OUTPUT_SCHEMA.type).toBe("object");
    expect(REVIEW_OUTPUT_SCHEMA.required).toContain("annotations");
    const props = REVIEW_OUTPUT_SCHEMA.properties as Record<string, unknown>;
    expect(props.annotations).toBeDefined();
  });

  it("annotation items require all editorial fields", () => {
    const props = REVIEW_OUTPUT_SCHEMA.properties as Record<string, Record<string, unknown>>;
    const items = props.annotations!.items as Record<string, unknown>;
    const required = items.required as string[];
    expect(required).toContain("category");
    expect(required).toContain("severity");
    expect(required).toContain("scope");
    expect(required).toContain("message");
    expect(required).toContain("suggestion");
    expect(required).toContain("anchor");
  });
});

describe("SUGGESTION_REQUEST_SCHEMA", () => {
  it("requires suggestion and rationale", () => {
    expect(SUGGESTION_REQUEST_SCHEMA.type).toBe("object");
    const required = SUGGESTION_REQUEST_SCHEMA.required as string[];
    expect(required).toContain("suggestion");
    expect(required).toContain("rationale");
  });
});

// ─── buildReviewSystemPrompt ─────────────────────

describe("buildReviewSystemPrompt", () => {
  it("includes base editorial role and severity definitions", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("editorial review assistant");
    expect(prompt).toContain("SEVERITY DEFINITIONS");
    expect(prompt).toContain("critical:");
    expect(prompt).toContain("warning:");
    expect(prompt).toContain("info:");
  });

  it("includes anchor instructions and exclusion rules", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("ANCHOR FORMAT");
    expect(prompt).toContain("prefix");
    expect(prompt).toContain("FOCUS/SUGGESTION ALIGNMENT");
    expect(prompt).toContain("SCOPE RULE");
    expect(prompt).toContain("Do NOT flag: kill list violations");
  });

  it("includes suggestion field rules", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("SUGGESTION FIELD RULES");
    expect(prompt).toContain("VERBATIM REPLACEMENT PROSE");
  });

  it("includes scope rule with WRONG/RIGHT examples for duplication prevention", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).toContain("SCOPE RULE");
    expect(prompt).toContain("WRONG:");
    expect(prompt).toContain("RIGHT:");
    expect(prompt).toContain("expand anchor.focus");
  });

  it("includes metaphoric register when present", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        metaphoricRegister: {
          approvedDomains: ["weather", "water"],
          prohibitedDomains: ["warfare"],
        },
      },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("METAPHORIC REGISTER");
    expect(prompt).toContain("weather, water");
    expect(prompt).toContain("warfare");
  });

  it("omits metaphoric register when null", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).not.toContain("METAPHORIC REGISTER");
  });

  it("includes vocabulary preferences when present", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        vocabularyPreferences: [{ preferred: "said", insteadOf: "exclaimed" }],
      },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("VOCABULARY PREFERENCES");
    expect(prompt).toContain("said (not exclaimed)");
  });

  it("omits vocabulary when empty", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).not.toContain("VOCABULARY PREFERENCES");
  });

  it("includes sentence architecture when present", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        sentenceArchitecture: {
          targetVariance: "high",
          fragmentPolicy: "occasional",
          notes: null,
        },
      },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("SENTENCE ARCHITECTURE");
    expect(prompt).toContain("high");
  });

  it("includes structural bans when present", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        structuralBans: ["flashbacks mid-action", "direct address"],
      },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("STRUCTURAL BANS");
    expect(prompt).toContain("flashbacks mid-action");
  });

  it("includes kill list as reference-only section", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        killList: [
          { pattern: "very", type: "exact" as const },
          { pattern: "suddenly", type: "exact" as const },
        ],
      },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("KILL LIST (reference only");
    expect(prompt).toContain("do NOT flag these");
    expect(prompt).toContain("very");
    expect(prompt).toContain("suddenly");
  });

  it("includes POV rules when present", () => {
    const ctx = makeContext({
      povRules: { distance: "intimate", interiority: "stream", reliability: "unreliable" },
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("POV RULES");
    expect(prompt).toContain("intimate");
    expect(prompt).toContain("stream");
    expect(prompt).toContain("unreliable");
  });

  it("includes character voices when present", () => {
    const ctx = makeContext({
      activeVoices: [
        { name: "Elena", fingerprint: "vocab: formal; tics: trailing off" },
        { name: "Marcus", fingerprint: "vocab: blue-collar" },
      ],
    });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("CHARACTER VOICES");
    expect(prompt).toContain("Elena: vocab: formal");
    expect(prompt).toContain("Marcus: vocab: blue-collar");
  });

  it("includes subtext policy when present", () => {
    const ctx = makeContext({ subtextPolicy: "Characters never say what they mean" });
    const prompt = buildReviewSystemPrompt(ctx);
    expect(prompt).toContain("SUBTEXT POLICY");
    expect(prompt).toContain("never say what they mean");
  });

  it("omits subtext policy when empty string", () => {
    const prompt = buildReviewSystemPrompt(makeContext());
    expect(prompt).not.toContain("SUBTEXT POLICY");
  });
});

// ─── buildReviewUserPrompt ───────────────────────

describe("buildReviewUserPrompt", () => {
  it("wraps chunk text in review instruction", () => {
    const prompt = buildReviewUserPrompt("She walked into the room.");
    expect(prompt).toContain("Review the following prose chunk");
    expect(prompt).toContain("She walked into the room.");
  });
});

// ─── buildSuggestionRequestPrompt ────────────────

describe("buildSuggestionRequestPrompt", () => {
  it("returns system and user prompts", () => {
    const ctx = makeContext();
    const ann = makeAnnotation();
    const result = buildSuggestionRequestPrompt(
      ctx,
      ann,
      "She walked into the cathedral of light and sat down.",
      "Make it less overwrought",
    );
    expect(result.systemPrompt).toBeDefined();
    expect(result.userPrompt).toBeDefined();
  });

  it("system prompt includes rewriting role", () => {
    const ctx = makeContext();
    const ann = makeAnnotation();
    const { systemPrompt } = buildSuggestionRequestPrompt(ctx, ann, "text", "feedback");
    expect(systemPrompt).toContain("prose rewriting assistant");
    expect(systemPrompt).toContain("VERBATIM replacement");
  });

  it("user prompt marks focus span with delimiters", () => {
    const chunkText = "She walked into the cathedral of light and sat down.";
    const ann = makeAnnotation();
    const { userPrompt } = buildSuggestionRequestPrompt(makeContext(), ann, chunkText, "tone it down");
    expect(userPrompt).toContain("<<FOCUS_START>>");
    expect(userPrompt).toContain("<<FOCUS_END>>");
    expect(userPrompt).toContain("<<FOCUS_START>>the cathedral of light<<FOCUS_END>>");
  });

  it("user prompt includes diagnosis and author direction", () => {
    const ann = makeAnnotation({ category: "metaphor", message: "Mixed metaphor" });
    const { userPrompt } = buildSuggestionRequestPrompt(makeContext(), ann, "text", "simplify this");
    expect(userPrompt).toContain("[metaphor] Mixed metaphor");
    expect(userPrompt).toContain("AUTHOR DIRECTION: simplify this");
  });

  it("user prompt includes scope constraint and anti-duplication examples", () => {
    const ann = makeAnnotation();
    const { userPrompt } = buildSuggestionRequestPrompt(makeContext(), ann, "text", "feedback");
    expect(userPrompt).toContain("SCOPE CONSTRAINT");
    expect(userPrompt).toContain("Do NOT repeat or rephrase any words");
    expect(userPrompt).toContain("WRONG:");
    expect(userPrompt).toContain("RIGHT:");
  });

  it("system prompt includes context sections when available", () => {
    const ctx = makeContext({
      styleRules: {
        ...makeContext().styleRules,
        metaphoricRegister: { approvedDomains: ["nature"], prohibitedDomains: [] },
        killList: [{ pattern: "very", type: "exact" as const }],
      },
      povRules: { distance: "close", interiority: "filtered", reliability: "reliable" },
    });
    const { systemPrompt } = buildSuggestionRequestPrompt(ctx, makeAnnotation(), "text", "feedback");
    expect(systemPrompt).toContain("METAPHORIC REGISTER");
    expect(systemPrompt).toContain("KILL LIST");
    expect(systemPrompt).toContain("POV RULES");
  });
});
