import { describe, expect, it } from "vitest";
import {
  buildContinuousText,
  buildRefinementSystemPrompt,
  buildRefinementUserPrompt,
  findChunksForRange,
  parseRefinementResponse,
} from "../../src/review/refine.js";
import type { RefinementChip, RefinementRequest } from "../../src/review/refineTypes.js";
import type { ReviewContext } from "../../src/review/types.js";
import type { Chunk, KillListEntry } from "../../src/types/index.js";

function makeTestChunk(id: string, text: string, index: number): Chunk {
  return {
    id,
    sceneId: "scene-1",
    sequenceNumber: index,
    generatedText: text,
    editedText: null,
    humanNotes: null,
    status: "accepted",
    model: "claude-sonnet-4-6",
    temperature: 0.85,
    topP: 1,
    payloadHash: "abc",
    generatedAt: new Date().toISOString(),
  };
}

// ─── buildContinuousText ────────────────────────

describe("buildContinuousText", () => {
  it("handles a single chunk", () => {
    const chunks = [makeTestChunk("c1", "Hello world.", 0)];
    const result = buildContinuousText(chunks);
    expect(result.text).toBe("Hello world.");
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0]).toEqual({
      chunkIndex: 0,
      chunkId: "c1",
      startOffset: 0,
      endOffset: 12,
    });
  });

  it("concatenates multiple chunks with \\n\\n separator", () => {
    const chunks = [
      makeTestChunk("c1", "First chunk.", 0),
      makeTestChunk("c2", "Second chunk.", 1),
      makeTestChunk("c3", "Third chunk.", 2),
    ];
    const result = buildContinuousText(chunks);
    expect(result.text).toBe("First chunk.\n\nSecond chunk.\n\nThird chunk.");
    expect(result.boundaries).toHaveLength(3);
  });

  it("tracks correct boundary offsets with separator gaps", () => {
    const chunks = [makeTestChunk("c1", "AB", 0), makeTestChunk("c2", "CD", 1)];
    const result = buildContinuousText(chunks);
    // "AB\n\nCD" => AB at 0-2, CD at 4-6
    expect(result.boundaries[0]).toEqual({ chunkIndex: 0, chunkId: "c1", startOffset: 0, endOffset: 2 });
    expect(result.boundaries[1]).toEqual({ chunkIndex: 1, chunkId: "c2", startOffset: 4, endOffset: 6 });
  });

  it("uses editedText when present (canonical text)", () => {
    const chunk = makeTestChunk("c1", "original", 0);
    chunk.editedText = "edited";
    const result = buildContinuousText([chunk]);
    expect(result.text).toBe("edited");
    expect(result.boundaries[0]!.endOffset).toBe(6);
  });

  it("handles empty chunks array", () => {
    const result = buildContinuousText([]);
    expect(result.text).toBe("");
    expect(result.boundaries).toHaveLength(0);
  });
});

// ─── findChunksForRange ─────────────────────────

describe("findChunksForRange", () => {
  const boundaries = [
    { chunkIndex: 0, chunkId: "c1", startOffset: 0, endOffset: 10 },
    { chunkIndex: 1, chunkId: "c2", startOffset: 12, endOffset: 22 },
    { chunkIndex: 2, chunkId: "c3", startOffset: 24, endOffset: 34 },
  ];

  it("finds a range within a single chunk", () => {
    const result = findChunksForRange(2, 8, boundaries);
    expect(result).toHaveLength(1);
    expect(result[0]!.chunkId).toBe("c1");
  });

  it("finds range spanning two chunks", () => {
    const result = findChunksForRange(8, 15, boundaries);
    expect(result).toHaveLength(2);
    expect(result[0]!.chunkId).toBe("c1");
    expect(result[1]!.chunkId).toBe("c2");
  });

  it("finds range spanning all chunks", () => {
    const result = findChunksForRange(0, 34, boundaries);
    expect(result).toHaveLength(3);
  });

  it("returns empty for range outside all chunks (in separator gap)", () => {
    const result = findChunksForRange(10, 12, boundaries);
    expect(result).toHaveLength(0);
  });

  it("returns empty for range after all chunks", () => {
    const result = findChunksForRange(50, 60, boundaries);
    expect(result).toHaveLength(0);
  });
});

// ─── buildRefinementSystemPrompt ────────────────

describe("buildRefinementSystemPrompt", () => {
  const baseContext: ReviewContext = {
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
    editingInstructions: "",
  };

  it("includes core principles", () => {
    const prompt = buildRefinementSystemPrompt(baseContext);
    expect(prompt).toContain("MINIMAL INTERVENTION");
    expect(prompt).toContain("Voice rules > Argumentative coherence");
  });

  it("includes active voices when present", () => {
    const context: ReviewContext = {
      ...baseContext,
      activeVoices: [{ name: "Alice", fingerprint: "clipped, formal" }],
    };
    const prompt = buildRefinementSystemPrompt(context);
    expect(prompt).toContain("Alice: clipped, formal");
  });

  it("includes kill list in ACTIVE mode", () => {
    const context: ReviewContext = {
      ...baseContext,
      styleRules: {
        ...baseContext.styleRules,
        killList: [{ pattern: "suddenly", type: "exact" }],
      },
    };
    const prompt = buildRefinementSystemPrompt(context);
    expect(prompt).toContain("KILL LIST (ACTIVE");
    expect(prompt).toContain("suddenly");
  });

  it("includes POV rules when present", () => {
    const context: ReviewContext = {
      ...baseContext,
      povRules: { distance: "close", interiority: "high", reliability: "unreliable" },
    };
    const prompt = buildRefinementSystemPrompt(context);
    expect(prompt).toContain("Distance=close");
  });
});

// ─── buildRefinementUserPrompt ──────────────────

describe("buildRefinementUserPrompt", () => {
  const baseRequest: RefinementRequest = {
    sceneId: "s1",
    selectedText: "bad prose here",
    selectionStart: 10,
    selectionEnd: 24,
    instruction: "",
    chips: [],
  };

  it("wraps selection in markers", () => {
    const sceneText = "Some text bad prose here and more.";
    const prompt = buildRefinementUserPrompt(sceneText, baseRequest, "Test Scene", "Test Goal");
    expect(prompt).toContain("<<SELECTION_START>>");
    expect(prompt).toContain("<<SELECTION_END>>");
    expect(prompt).toContain("<<SELECTION_START>>bad prose here<<SELECTION_END>>");
  });

  it("includes scene title and goal", () => {
    const prompt = buildRefinementUserPrompt("text", baseRequest, "The Letter", "Alice discovers truth");
    expect(prompt).toContain("SCENE: The Letter");
    expect(prompt).toContain("GOAL: Alice discovers truth");
  });

  it("includes chips when provided", () => {
    const request = { ...baseRequest, chips: ["word_choice", "cliche"] as RefinementChip[] };
    const prompt = buildRefinementUserPrompt("text", request, "S", "G");
    expect(prompt).toContain("word_choice, cliche");
  });

  it("includes instruction when provided", () => {
    const request = { ...baseRequest, instruction: "too flowery" };
    const prompt = buildRefinementUserPrompt("text", request, "S", "G");
    expect(prompt).toContain("too flowery");
  });

  it("omits instruction section when empty", () => {
    const prompt = buildRefinementUserPrompt("text", baseRequest, "S", "G");
    expect(prompt).not.toContain("WRITER'S NOTE:");
  });
});

// ─── parseRefinementResponse ────────────────────

describe("parseRefinementResponse", () => {
  const emptyKillList: KillListEntry[] = [];

  it("parses valid JSON with variants", () => {
    const raw = JSON.stringify({
      variants: [
        { text: "replacement one", rationale: "better rhythm" },
        { text: "replacement two", rationale: "simpler" },
      ],
    });
    const result = parseRefinementResponse(raw, emptyKillList);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0]!.text).toBe("replacement one");
    expect(result.variants[0]!.killListClean).toBe(true);
    expect(result.parseError).toBeUndefined();
  });

  it("flags kill list violations on variants", () => {
    const killList: KillListEntry[] = [{ pattern: "suddenly", type: "exact" }];
    const raw = JSON.stringify({
      variants: [
        { text: "He suddenly turned.", rationale: "dramatic" },
        { text: "He turned slowly.", rationale: "measured" },
      ],
    });
    const result = parseRefinementResponse(raw, killList);
    expect(result.variants[0]!.killListClean).toBe(false);
    expect(result.variants[0]!.killListViolations.length).toBeGreaterThan(0);
    expect(result.variants[1]!.killListClean).toBe(true);
  });

  it("returns parseError for malformed JSON", () => {
    const result = parseRefinementResponse("not json at all", emptyKillList);
    expect(result.variants).toEqual([]);
    expect(result.parseError).toMatch(/JSON parse failed/);
  });

  it("returns parseError for valid JSON without variants array", () => {
    const result = parseRefinementResponse(JSON.stringify({ foo: "bar" }), emptyKillList);
    expect(result.variants).toEqual([]);
    expect(result.parseError).toBe("Response missing 'variants' array");
  });

  it("filters out variants with missing text or rationale", () => {
    const raw = JSON.stringify({
      variants: [{ text: "good", rationale: "yes" }, { text: "no rationale" }, { rationale: "no text" }, {}],
    });
    const result = parseRefinementResponse(raw, emptyKillList);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]!.text).toBe("good");
    expect(result.parseError).toBeUndefined();
  });

  it("preserves adjustedBefore/adjustedAfter when present", () => {
    const raw = JSON.stringify({
      variants: [
        { text: "new", rationale: "reason", adjustedBefore: "before context", adjustedAfter: "after context" },
      ],
    });
    const result = parseRefinementResponse(raw, emptyKillList);
    expect(result.variants[0]!.adjustedBefore).toBe("before context");
    expect(result.variants[0]!.adjustedAfter).toBe("after context");
  });
});
