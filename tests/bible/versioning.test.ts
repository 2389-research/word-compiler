import { describe, it, expect } from "vitest";
import { createBibleVersion, diffBibles } from "../../src/bible/versioning.js";
import { createEmptyBible, type Bible } from "../../src/types/index.js";

function makeBible(overrides: Partial<Bible> = {}): Bible {
  return { ...createEmptyBible("test"), ...overrides };
}

describe("createBibleVersion", () => {
  it("increments version number", () => {
    const v1 = makeBible({ version: 1 });
    const v2 = createBibleVersion(v1);
    expect(v2.version).toBe(2);
  });

  it("preserves all other fields", () => {
    const v1 = makeBible({
      version: 3,
      characters: [
        {
          id: "c1", name: "Alice", role: "protagonist",
          physicalDescription: null, backstory: null, selfNarrative: null, contradictions: null,
          voice: {
            sentenceLengthRange: null, vocabularyNotes: null, verbalTics: [],
            metaphoricRegister: null, prohibitedLanguage: [], dialogueSamples: [],
          },
          behavior: null,
        },
      ],
    });
    const v2 = createBibleVersion(v1);
    expect(v2.characters).toHaveLength(1);
    expect(v2.characters[0]!.name).toBe("Alice");
    expect(v2.projectId).toBe("test");
  });

  it("updates createdAt timestamp", () => {
    const v1 = makeBible({ version: 1, createdAt: "2024-01-01T00:00:00.000Z" });
    const v2 = createBibleVersion(v1);
    expect(v2.createdAt).not.toBe(v1.createdAt);
  });
});

describe("diffBibles", () => {
  it("returns empty diff for identical bibles", () => {
    const bible = makeBible();
    const diffs = diffBibles(bible, bible);
    expect(diffs).toHaveLength(0);
  });

  it("detects added character", () => {
    const v1 = makeBible();
    const v2 = makeBible({
      characters: [{
        id: "c1", name: "Bob", role: "protagonist",
        physicalDescription: null, backstory: null, selfNarrative: null, contradictions: null,
        voice: {
          sentenceLengthRange: null, vocabularyNotes: null, verbalTics: [],
          metaphoricRegister: null, prohibitedLanguage: [], dialogueSamples: [],
        },
        behavior: null,
      }],
    });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "added", area: "character", description: expect.stringContaining("Bob"),
    }));
  });

  it("detects removed character", () => {
    const v1 = makeBible({
      characters: [{
        id: "c1", name: "Carol", role: "supporting",
        physicalDescription: null, backstory: null, selfNarrative: null, contradictions: null,
        voice: {
          sentenceLengthRange: null, vocabularyNotes: null, verbalTics: [],
          metaphoricRegister: null, prohibitedLanguage: [], dialogueSamples: [],
        },
        behavior: null,
      }],
    });
    const v2 = makeBible();
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "removed", area: "character", description: expect.stringContaining("Carol"),
    }));
  });

  it("detects modified character", () => {
    const char = {
      id: "c1", name: "Dave", role: "protagonist" as const,
      physicalDescription: null, backstory: null, selfNarrative: null, contradictions: null,
      voice: {
        sentenceLengthRange: null as [number, number] | null, vocabularyNotes: null,
        verbalTics: [] as string[], metaphoricRegister: null,
        prohibitedLanguage: [] as string[], dialogueSamples: [] as string[],
      },
      behavior: null,
    };
    const v1 = makeBible({ characters: [{ ...char }] });
    const v2 = makeBible({ characters: [{ ...char, backstory: "Something happened" }] });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "modified", area: "character",
    }));
  });

  it("detects added kill list entry", () => {
    const v1 = makeBible();
    const v2 = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [{ pattern: "suddenly", type: "exact" }],
      },
    });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "added", area: "kill_list", description: expect.stringContaining("suddenly"),
    }));
  });

  it("detects removed kill list entry", () => {
    const v1 = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        killList: [{ pattern: "very", type: "exact" }],
      },
    });
    const v2 = makeBible();
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "removed", area: "kill_list",
    }));
  });

  it("detects style guide changes", () => {
    const v1 = makeBible();
    const v2 = makeBible({
      styleGuide: {
        ...createEmptyBible("test").styleGuide,
        structuralBans: ["rhetorical questions"],
      },
    });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "modified", area: "style_guide",
    }));
  });

  it("detects narrative rules changes", () => {
    const v1 = makeBible();
    const v2 = makeBible({
      narrativeRules: {
        ...createEmptyBible("test").narrativeRules,
        subtextPolicy: "Never state subtext explicitly",
      },
    });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({
      type: "modified", area: "narrative_rules",
    }));
  });

  it("detects added and removed locations", () => {
    const v1 = makeBible({
      locations: [{ id: "l1", name: "Kitchen", description: null, sensoryPalette: { sounds: [], smells: [], textures: [], lightQuality: null, atmosphere: null, prohibitedDefaults: [] } }],
    });
    const v2 = makeBible({
      locations: [{ id: "l2", name: "Garden", description: null, sensoryPalette: { sounds: [], smells: [], textures: [], lightQuality: null, atmosphere: null, prohibitedDefaults: [] } }],
    });
    const diffs = diffBibles(v1, v2);
    expect(diffs).toContainEqual(expect.objectContaining({ type: "added", area: "location" }));
    expect(diffs).toContainEqual(expect.objectContaining({ type: "removed", area: "location" }));
  });
});
