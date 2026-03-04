import { describe, expect, it } from "vitest";
import type { EditPattern } from "../../src/learner/diff.js";
import {
  accumulatePatterns,
  computeWeightedCount,
  groupPatterns,
  groupPatternsBySubType,
  mapToProposedAction,
  meetsAdvisoryThreshold,
  meetsPromotionThreshold,
  normalizePatternKey,
  type PatternGroup,
  wilsonLowerBound,
} from "../../src/learner/patterns.js";

function makeEdit(overrides: Partial<EditPattern> = {}): EditPattern {
  return {
    id: "e1",
    chunkId: "c1",
    sceneId: "s1",
    projectId: "p1",
    editType: "DELETION",
    subType: "CUT_FILLER",
    originalText: "um well",
    editedText: "",
    context: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── wilsonLowerBound ───────────────────────────

describe("wilsonLowerBound", () => {
  it("returns 0 for zero total", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("returns 0 for zero successes", () => {
    expect(wilsonLowerBound(0, 10)).toBe(0);
  });

  it("returns value between 0 and 1 for normal inputs", () => {
    const result = wilsonLowerBound(7, 10);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("increases with more successes at same total", () => {
    const low = wilsonLowerBound(3, 10);
    const high = wilsonLowerBound(8, 10);
    expect(high).toBeGreaterThan(low);
  });

  it("converges toward ratio for large samples", () => {
    const result = wilsonLowerBound(800, 1000);
    // With 80% success rate and n=1000, Wilson lower should be close to 0.8
    expect(result).toBeGreaterThan(0.75);
    expect(result).toBeLessThan(0.82);
  });

  it("is conservative for small samples", () => {
    // 2/2 = 100%, but Wilson should be well below 1
    const result = wilsonLowerBound(2, 2);
    expect(result).toBeLessThan(0.8);
  });
});

// ─── computeWeightedCount ───────────────────────

describe("computeWeightedCount", () => {
  it("returns 0 for empty edits", () => {
    expect(computeWeightedCount([], new Map())).toBe(0);
  });

  it("counts recent edits at full weight", () => {
    const edits = [makeEdit({ sceneId: "s1" }), makeEdit({ sceneId: "s2" }), makeEdit({ sceneId: "s3" })];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 1],
      ["s3", 2],
    ]);
    // All within 30-scene window of max (2)
    expect(computeWeightedCount(edits, sceneOrder)).toBe(3);
  });

  it("applies 50% decay to old edits", () => {
    const edits = [makeEdit({ sceneId: "s-old" }), makeEdit({ sceneId: "s-new" })];
    // s-old is at order 0, s-new at order 35 → age of s-old = 35 > 30
    const sceneOrder = new Map([
      ["s-old", 0],
      ["s-new", 35],
    ]);
    expect(computeWeightedCount(edits, sceneOrder)).toBe(1.5); // 0.5 + 1.0
  });

  it("respects custom decay window", () => {
    const edits = [makeEdit({ sceneId: "s1" }), makeEdit({ sceneId: "s2" })];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 5],
    ]);
    // With window of 3, s1 is at age 5 > 3 → decayed
    expect(computeWeightedCount(edits, sceneOrder, 3)).toBe(1.5);
  });
});

// ─── normalizePatternKey ────────────────────────

describe("normalizePatternKey", () => {
  it("uses exact lowercase text for CUT_FILLER", () => {
    const edit = makeEdit({ subType: "CUT_FILLER", originalText: "Um Well" });
    expect(normalizePatternKey(edit)).toBe("um well");
  });

  it("extracts abstract indicator for SHOW_DONT_TELL", () => {
    const edit = makeEdit({
      editType: "SUBSTITUTION",
      subType: "SHOW_DONT_TELL",
      originalText: "She felt a sense of unease",
    });
    expect(normalizePatternKey(edit)).toBe("felt a sense of");
  });

  it("falls back to sentinel for SHOW_DONT_TELL without indicator match", () => {
    const edit = makeEdit({
      editType: "SUBSTITUTION",
      subType: "SHOW_DONT_TELL",
      originalText: "The weather was gloomy",
    });
    expect(normalizePatternKey(edit)).toBe("_show_dont_tell_");
  });

  it("extracts sensory word for SENSORY_ADDED", () => {
    const edit = makeEdit({
      editType: "ADDITION",
      subType: "SENSORY_ADDED",
      editedText: "The bitter aroma of fresh coffee filled the room",
    });
    expect(normalizePatternKey(edit)).toBe("aroma");
  });

  it("extracts beat verb for BEAT_ADDED", () => {
    const edit = makeEdit({
      editType: "ADDITION",
      subType: "BEAT_ADDED",
      editedText: "She shrugged and turned away",
    });
    expect(normalizePatternKey(edit)).toBe("shrugged");
  });

  it("uses sentinel for CUT_PASSAGE", () => {
    const edit = makeEdit({ subType: "CUT_PASSAGE", originalText: "A long passage about nothing" });
    expect(normalizePatternKey(edit)).toBe("_cut_passage_");
  });

  it("uses sentinel for TONE_SHIFT", () => {
    const edit = makeEdit({ editType: "SUBSTITUTION", subType: "TONE_SHIFT" });
    expect(normalizePatternKey(edit)).toBe("_tone_shift_");
  });

  it("uses sentinel for DIALOGUE_VOICE", () => {
    const edit = makeEdit({ editType: "SUBSTITUTION", subType: "DIALOGUE_VOICE" });
    expect(normalizePatternKey(edit)).toBe("_dialogue_voice_");
  });

  it("returns 'reorder' for REORDER", () => {
    const edit = makeEdit({ editType: "RESTRUCTURE", subType: "REORDER" });
    expect(normalizePatternKey(edit)).toBe("reorder");
  });
});

// ─── groupPatterns ──────────────────────────────

describe("groupPatterns", () => {
  it("groups edits by subType + normalizedKey", () => {
    const edits = [
      makeEdit({ id: "e1", subType: "CUT_FILLER", originalText: "um well" }),
      makeEdit({ id: "e2", subType: "CUT_FILLER", originalText: "Um Well" }),
      makeEdit({ id: "e3", subType: "CUT_FILLER", originalText: "you know" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    // "um well" group has 2, "you know" has 1
    expect(groups).toHaveLength(2);
    const umGroup = groups.find((g) => g.key === "um well");
    expect(umGroup!.edits).toHaveLength(2);
  });

  it("computes confidence using Wilson interval", () => {
    const edits = Array.from({ length: 8 }, (_, i) =>
      makeEdit({ id: `e${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
    );
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.confidence).toBeGreaterThan(0);
    expect(groups[0]!.confidence).toBeLessThan(1);
  });

  it("sorts by confidence descending", () => {
    const edits = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeEdit({ id: `a${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      makeEdit({ id: "b1", sceneId: "s1", subType: "CUT_FILLER", originalText: "rare" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatterns(edits, sceneOrder);
    expect(groups[0]!.key).toBe("well");
  });
});

// ─── meetsPromotionThreshold ────────────────────

describe("meetsPromotionThreshold", () => {
  it("rejects groups with fewer than 5 occurrences", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 4,
      confidence: 0.8,
    };
    expect(meetsPromotionThreshold(group)).toBe(false);
  });

  it("rejects groups with confidence below 0.60", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 10,
      confidence: 0.55,
    };
    expect(meetsPromotionThreshold(group)).toBe(false);
  });

  it("accepts groups meeting both thresholds", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "well",
      edits: [],
      weightedCount: 7,
      confidence: 0.65,
    };
    expect(meetsPromotionThreshold(group)).toBe(true);
  });
});

// ─── mapToProposedAction ────────────────────────

describe("mapToProposedAction", () => {
  it("maps CUT_FILLER to killList", () => {
    const group: PatternGroup = {
      patternType: "CUT_FILLER",
      key: "a sense of",
      edits: [],
      weightedCount: 5,
      confidence: 0.7,
    };
    const action = mapToProposedAction(group);
    expect(action).toEqual({ target: "killList", value: "a sense of" });
  });

  it("maps DIALOGUE_VOICE to characters.voiceNotes", () => {
    const group: PatternGroup = {
      patternType: "DIALOGUE_VOICE",
      key: "said softly",
      edits: [],
      weightedCount: 6,
      confidence: 0.7,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("characters.voiceNotes");
  });

  it("maps SHOW_DONT_TELL to suggestedTone.exemplars", () => {
    const group: PatternGroup = {
      patternType: "SHOW_DONT_TELL",
      key: "felt a sense of dread",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("suggestedTone.exemplars");
  });

  it("maps SENSORY_ADDED to locations.sensoryPalette", () => {
    const group: PatternGroup = {
      patternType: "SENSORY_ADDED",
      key: "the bitter aroma",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("locations.sensoryPalette");
  });

  it("maps BEAT_ADDED to characters.emotionPhysicality", () => {
    const group: PatternGroup = {
      patternType: "BEAT_ADDED",
      key: "she shrugged and",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("characters.emotionPhysicality");
  });

  it("maps TONE_SHIFT to suggestedTone.metaphoricDomains", () => {
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "the building was old",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("suggestedTone.metaphoricDomains");
  });

  it("maps REORDER to compilationNotes", () => {
    const group: PatternGroup = {
      patternType: "REORDER",
      key: "reorder",
      edits: [],
      weightedCount: 5,
      confidence: 0.65,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("compilationNotes");
  });

  it("maps advisory TONE_SHIFT to compilationNotes with coaching message", () => {
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "_tone_shift_",
      edits: [makeEdit({ sceneId: "s1" }), makeEdit({ id: "e2", sceneId: "s2" })],
      weightedCount: 10,
      confidence: 0.5,
      advisory: true,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("compilationNotes");
    expect(action!.value).toContain("frequently adjust tone");
    expect(action!.value).toContain("10 edits");
  });

  it("maps advisory SHOW_DONT_TELL to suggestedTone.exemplars with coaching", () => {
    const group: PatternGroup = {
      patternType: "SHOW_DONT_TELL",
      key: "_show_dont_tell_",
      edits: [makeEdit({ sceneId: "s1" }), makeEdit({ id: "e2", sceneId: "s2" })],
      weightedCount: 12,
      confidence: 0.4,
      advisory: true,
    };
    const action = mapToProposedAction(group);
    expect(action!.target).toBe("suggestedTone.exemplars");
    expect(action!.value).toContain("abstract emotional telling");
  });
});

// ─── groupPatternsBySubType ─────────────────────

describe("groupPatternsBySubType", () => {
  it("groups all edits of the same subType together", () => {
    const edits = [
      makeEdit({ id: "e1", subType: "TONE_SHIFT", originalText: "unique text A" }),
      makeEdit({ id: "e2", subType: "TONE_SHIFT", originalText: "unique text B" }),
      makeEdit({ id: "e3", subType: "CUT_FILLER", originalText: "well" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatternsBySubType(edits, sceneOrder);
    expect(groups).toHaveLength(2);
    const toneGroup = groups.find((g) => g.patternType === "TONE_SHIFT");
    expect(toneGroup!.edits).toHaveLength(2);
    expect(toneGroup!.advisory).toBe(true);
  });

  it("computes Wilson confidence against total edit count", () => {
    const edits = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeEdit({ id: `t${i}`, subType: "TONE_SHIFT", originalText: `text ${i}` }),
      ),
      ...Array.from({ length: 4 }, (_, i) => makeEdit({ id: `c${i}`, subType: "CUT_FILLER", originalText: "well" })),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const groups = groupPatternsBySubType(edits, sceneOrder);
    const toneGroup = groups.find((g) => g.patternType === "TONE_SHIFT")!;
    // 6/10 → Wilson lower bound should be moderate
    expect(toneGroup.confidence).toBeGreaterThan(0);
    expect(toneGroup.confidence).toBeLessThan(0.7);
  });
});

// ─── meetsAdvisoryThreshold ─────────────────────

describe("meetsAdvisoryThreshold", () => {
  it("rejects groups with fewer than 8 weighted occurrences", () => {
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "_tone_shift_",
      edits: [makeEdit({ sceneId: "s1" }), makeEdit({ id: "e2", sceneId: "s2" })],
      weightedCount: 7,
      confidence: 0.5,
      advisory: true,
    };
    expect(meetsAdvisoryThreshold(group)).toBe(false);
  });

  it("rejects groups with edits from only 1 scene", () => {
    const edits = Array.from({ length: 10 }, (_, i) => makeEdit({ id: `e${i}`, sceneId: "s1", subType: "TONE_SHIFT" }));
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "_tone_shift_",
      edits,
      weightedCount: 10,
      confidence: 0.5,
      advisory: true,
    };
    expect(meetsAdvisoryThreshold(group)).toBe(false);
  });

  it("accepts groups meeting both thresholds", () => {
    const edits = [
      ...Array.from({ length: 5 }, (_, i) => makeEdit({ id: `a${i}`, sceneId: "s1", subType: "TONE_SHIFT" })),
      ...Array.from({ length: 5 }, (_, i) => makeEdit({ id: `b${i}`, sceneId: "s2", subType: "TONE_SHIFT" })),
    ];
    const group: PatternGroup = {
      patternType: "TONE_SHIFT",
      key: "_tone_shift_",
      edits,
      weightedCount: 10,
      confidence: 0.5,
      advisory: true,
    };
    expect(meetsAdvisoryThreshold(group)).toBe(true);
  });
});

// ─── accumulatePatterns ─────────────────────────

describe("accumulatePatterns", () => {
  it("returns empty for no edits", () => {
    const result = accumulatePatterns([], new Map());
    expect(result).toEqual([]);
  });

  it("filters out groups below promotion threshold", () => {
    // Only 2 edits — won't meet the 5-occurrence threshold or 8-advisory threshold
    const edits = [
      makeEdit({ id: "e1", subType: "CUT_FILLER", originalText: "well" }),
      makeEdit({ id: "e2", subType: "CUT_FILLER", originalText: "well" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toEqual([]);
  });

  it("promotes keyed groups that meet strict threshold", () => {
    const edits = Array.from({ length: 8 }, (_, i) =>
      makeEdit({ id: `e${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
    );
    const sceneOrder = new Map([["s1", 0]]);
    // 8/8 within CUT_FILLER subType → Wilson well above 0.60
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("well");
    expect(result[0]!.advisory).toBeFalsy();
    expect(result[0]!.weightedCount).toBe(8);
  });

  it("handles mixed groups with some promoted and some not", () => {
    const edits = [
      // 10 "well" edits — should promote (10/11 ratio → Wilson ≈ 0.62 > 0.60)
      ...Array.from({ length: 10 }, (_, i) =>
        makeEdit({ id: `a${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      // 1 "um" edit — should not promote (below 5 occurrences)
      makeEdit({ id: "b1", sceneId: "s1", subType: "CUT_FILLER", originalText: "um" }),
    ];
    const sceneOrder = new Map([["s1", 0]]);
    const result = accumulatePatterns(edits, sceneOrder);
    // CUT_FILLER is already covered by Tier 1, so no Tier 2 advisory for it
    expect(result).toHaveLength(1);
    expect(result[0]!.key).toBe("well");
  });

  it("promotes advisory groups for subTypes where no single key reaches keyed threshold", () => {
    // 10 diverse SHOW_DONT_TELL edits across 2 scenes, each with a different abstract indicator
    // or no indicator match → keys are split, no single keyed group reaches 5.
    // But advisory tier sees 10 total across 2 scenes → promoted.
    const indicators = [
      "She felt a sense of dread",
      "He felt a sense of wonder",
      "It was an overwhelming rush",
      "She knew that something was wrong",
      "The weather was gloomy and dark",
      "He felt a sense of relief",
      "She realized that he lied",
      "The road was sad and lonely",
      "She understood that it was over",
      "He was nervous about tomorrow",
    ];
    const edits = indicators.map((text, i) =>
      makeEdit({
        id: `e${i}`,
        sceneId: i < 5 ? "s1" : "s2",
        editType: "SUBSTITUTION",
        subType: "SHOW_DONT_TELL",
        originalText: text,
      }),
    );
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 1],
    ]);
    const result = accumulatePatterns(edits, sceneOrder);
    // Keyed groups: "felt a sense of" (4 edits), "was nervous" (1), etc. — none reach 5
    // Advisory: 10 SHOW_DONT_TELL across 2 scenes → promoted
    expect(result.length).toBeGreaterThanOrEqual(1);
    const advisory = result.find((g) => g.advisory);
    expect(advisory).toBeDefined();
    expect(advisory!.patternType).toBe("SHOW_DONT_TELL");
  });

  it("excludes advisory groups for subTypes already covered by keyed promotion", () => {
    // 8 identical CUT_FILLER edits across 2 scenes → promotes keyed group
    // Advisory for CUT_FILLER should be suppressed
    const edits = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeEdit({ id: `a${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeEdit({ id: `b${i}`, sceneId: "s2", subType: "CUT_FILLER", originalText: "well" }),
      ),
    ];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 1],
    ]);
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result).toHaveLength(1);
    expect(result[0]!.advisory).toBeFalsy();
    expect(result[0]!.key).toBe("well");
  });

  it("combines keyed and advisory promotions for different subTypes", () => {
    // Use diverse SHOW_DONT_TELL indicators so no single keyed group reaches 5
    const showDontTellTexts = [
      "She felt a sense of dread",
      "He felt a sense of wonder",
      "She knew that it was wrong",
      "He realized that time was up",
      "She was nervous about it",
      "He felt a sense of calm",
      "She was afraid of the dark",
      "He understood that she left",
      "The scene was sad and cold",
      "She felt a sense of loss",
    ];
    const edits = [
      // 8 identical CUT_FILLER → Tier 1 keyed promotion
      ...Array.from({ length: 8 }, (_, i) =>
        makeEdit({ id: `f${i}`, sceneId: "s1", subType: "CUT_FILLER", originalText: "well" }),
      ),
      // 10 diverse SHOW_DONT_TELL across 2 scenes → Tier 2 advisory
      ...showDontTellTexts.map((text, i) =>
        makeEdit({
          id: `s${i}`,
          sceneId: i < 5 ? "s1" : "s2",
          editType: "SUBSTITUTION",
          subType: "SHOW_DONT_TELL",
          originalText: text,
        }),
      ),
    ];
    const sceneOrder = new Map([
      ["s1", 0],
      ["s2", 1],
    ]);
    const result = accumulatePatterns(edits, sceneOrder);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const keyed = result.find((g) => !g.advisory);
    const advisory = result.find((g) => g.advisory);
    expect(keyed).toBeDefined();
    expect(keyed!.key).toBe("well");
    expect(advisory).toBeDefined();
    expect(advisory!.patternType).toBe("SHOW_DONT_TELL");
  });
});
