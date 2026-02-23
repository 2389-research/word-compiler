import { describe, expect, it } from "vitest";
import type { EditPattern } from "../../src/learner/diff.js";
import type { PatternGroup } from "../../src/learner/patterns.js";
import { applyProposal, type BibleProposal, generateProposals } from "../../src/learner/proposals.js";
import type { Bible } from "../../src/types/index.js";

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

function makeGroup(overrides: Partial<PatternGroup> = {}): PatternGroup {
  return {
    patternType: "CUT_FILLER",
    key: "a sense of",
    edits: [makeEdit(), makeEdit({ id: "e2", sceneId: "s2" })],
    weightedCount: 6,
    confidence: 0.65,
    ...overrides,
  };
}

function makeMinimalBible(): Bible {
  return {
    projectId: "p1",
    version: 1,
    characters: [
      {
        id: "char-1",
        name: "Alice",
        role: "protagonist",
        physicalDescription: null,
        backstory: null,
        selfNarrative: null,
        contradictions: null,
        voice: {
          sentenceLengthRange: null,
          vocabularyNotes: null,
          verbalTics: [],
          metaphoricRegister: null,
          prohibitedLanguage: [],
          dialogueSamples: [],
        },
        behavior: null,
      },
    ],
    styleGuide: {
      metaphoricRegister: null,
      vocabularyPreferences: [],
      sentenceArchitecture: null,
      paragraphPolicy: null,
      killList: [],
      negativeExemplars: [],
      positiveExemplars: [],
      structuralBans: [],
    },
    narrativeRules: {
      pov: {
        default: "close-third",
        distance: "close",
        interiority: "filtered",
        reliability: "reliable",
      },
      subtextPolicy: null,
      expositionPolicy: null,
      sceneEndingPolicy: null,
      setups: [],
    },
    locations: [
      {
        id: "loc-1",
        name: "The Office",
        description: null,
        sensoryPalette: {
          sounds: [],
          smells: [],
          textures: [],
          lightQuality: null,
          atmosphere: null,
          prohibitedDefaults: [],
        },
      },
    ],
    createdAt: new Date().toISOString(),
    sourcePrompt: null,
  };
}

// ─── generateProposals ──────────────────────────

describe("generateProposals", () => {
  it("returns empty array for no groups", () => {
    expect(generateProposals([], "p1")).toEqual([]);
  });

  it("generates a proposal for CUT_FILLER group", () => {
    const groups = [makeGroup({ patternType: "CUT_FILLER", key: "a sense of" })];
    const proposals = generateProposals(groups, "p1");
    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    expect(p.projectId).toBe("p1");
    expect(p.title).toContain("a sense of");
    expect(p.title).toContain("avoid list");
    expect(p.action.target).toBe("killList");
    expect(p.action.value).toBe("a sense of");
    expect(p.status).toBe("pending");
  });

  it("includes evidence with examples capped at 5", () => {
    const edits = Array.from({ length: 8 }, (_, i) => makeEdit({ id: `e${i}`, sceneId: i < 4 ? "s1" : "s2" }));
    const groups = [makeGroup({ edits, weightedCount: 8 })];
    const proposals = generateProposals(groups, "p1");
    expect(proposals[0]!.evidence.examples).toHaveLength(5);
    expect(proposals[0]!.evidence.sceneCount).toBe(2);
  });

  it("generates proposals for multiple groups", () => {
    const groups = [
      makeGroup({ patternType: "CUT_FILLER", key: "well" }),
      makeGroup({ patternType: "SHOW_DONT_TELL", key: "felt a sense of dread" }),
    ];
    const proposals = generateProposals(groups, "p1");
    expect(proposals).toHaveLength(2);
    expect(proposals[0]!.patternType).toBe("CUT_FILLER");
    expect(proposals[1]!.patternType).toBe("SHOW_DONT_TELL");
  });

  it("populates confidence and occurrence count in evidence", () => {
    const groups = [makeGroup({ weightedCount: 7, confidence: 0.72 })];
    const proposals = generateProposals(groups, "p1");
    expect(proposals[0]!.evidence.occurrences).toBe(7);
    expect(proposals[0]!.evidence.confidence).toBe(0.72);
  });
});

// ─── applyProposal ──────────────────────────────

describe("applyProposal", () => {
  function makeProposal(overrides: Partial<BibleProposal> = {}): BibleProposal {
    return {
      id: "prop-1",
      projectId: "p1",
      patternType: "CUT_FILLER",
      title: 'Add "well" to avoid list',
      description: "test",
      evidence: { occurrences: 6, confidence: 0.65, examples: [], sceneCount: 2 },
      action: { target: "killList", value: "well", section: "killList" },
      status: "accepted",
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("does not mutate original bible", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal();
    const updated = applyProposal(bible, proposal);
    expect(bible.styleGuide.killList).toHaveLength(0);
    expect(updated.styleGuide.killList).toHaveLength(1);
  });

  it("adds kill list entry for CUT_FILLER", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal();
    const updated = applyProposal(bible, proposal);
    expect(updated.styleGuide.killList).toHaveLength(1);
    expect(updated.styleGuide.killList[0]!.pattern).toBe("well");
  });

  it("does not duplicate kill list entries", () => {
    const bible = makeMinimalBible();
    bible.styleGuide.killList.push({ pattern: "well", type: "exact" });
    const proposal = makeProposal();
    const updated = applyProposal(bible, proposal);
    expect(updated.styleGuide.killList).toHaveLength(1);
  });

  it("adds negative exemplar for SHOW_DONT_TELL", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal({
      patternType: "SHOW_DONT_TELL",
      action: { target: "suggestedTone.exemplars", value: "felt a sense of dread", section: "styleGuide" },
    });
    const updated = applyProposal(bible, proposal);
    expect(updated.styleGuide.negativeExemplars).toHaveLength(1);
    expect(updated.styleGuide.negativeExemplars[0]!.text).toBe("felt a sense of dread");
  });

  it("updates character voice notes for DIALOGUE_VOICE", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal({
      patternType: "DIALOGUE_VOICE",
      action: { target: "characters.voiceNotes", value: "shorter dialogue", section: "characters" },
    });
    const updated = applyProposal(bible, proposal);
    expect(updated.characters[0]!.voice.vocabularyNotes).toBe("shorter dialogue");
  });

  it("appends to existing character voice notes", () => {
    const bible = makeMinimalBible();
    bible.characters[0]!.voice.vocabularyNotes = "existing notes";
    const proposal = makeProposal({
      patternType: "DIALOGUE_VOICE",
      action: { target: "characters.voiceNotes", value: "new note", section: "characters" },
    });
    const updated = applyProposal(bible, proposal);
    expect(updated.characters[0]!.voice.vocabularyNotes).toBe("existing notes; new note");
  });

  it("updates location atmosphere for SENSORY_ADDED", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal({
      patternType: "SENSORY_ADDED",
      action: { target: "locations.sensoryPalette", value: "coffee aroma", section: "locations" },
    });
    const updated = applyProposal(bible, proposal);
    expect(updated.locations[0]!.sensoryPalette.atmosphere).toBe("coffee aroma");
  });

  it("creates metaphoricRegister if null for TONE_SHIFT", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal({
      patternType: "TONE_SHIFT",
      action: { target: "suggestedTone.metaphoricDomains", value: "clinical language", section: "styleGuide" },
    });
    const updated = applyProposal(bible, proposal);
    expect(updated.styleGuide.metaphoricRegister).toBeTruthy();
    expect(updated.styleGuide.metaphoricRegister!.prohibitedDomains).toContain("clinical language");
  });

  it("handles compilationNotes gracefully (no-op)", () => {
    const bible = makeMinimalBible();
    const proposal = makeProposal({
      action: { target: "compilationNotes", value: "notes", section: "compilationNotes" },
    });
    const updated = applyProposal(bible, proposal);
    // Should not throw, bible unchanged structurally
    expect(updated.styleGuide.killList).toHaveLength(0);
  });
});
