import { describe, expect, it } from "vitest";
import { checkEpistemicLeaks } from "../../src/auditor/epistemic.js";
import { createEmptyBible, createEmptyNarrativeIR, type NarrativeIR } from "../../src/types/index.js";

function makeBible() {
  const bible = createEmptyBible("proj-1");
  return {
    ...bible,
    characters: [
      {
        id: "char-alice",
        name: "Alice",
        role: "protagonist" as const,
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
  };
}

function makeVerifiedIR(sceneId: string, overrides: Partial<NarrativeIR> = {}): NarrativeIR {
  return { ...createEmptyNarrativeIR(sceneId), verified: true, ...overrides };
}

describe("checkEpistemicLeaks", () => {
  it("returns no flags when character's knowledge has a source in prior IR", () => {
    const priorIR = makeVerifiedIR("scene-1", {
      factsIntroduced: ["Alice has a key"],
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Alice has a key",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Alice has a key",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    const flags = checkEpistemicLeaks(currentIR, [priorIR], makeBible());
    expect(flags).toHaveLength(0);
  });

  it("flags character knowledge with no prior source", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Bob is a spy",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags).toHaveLength(1);
    expect(flags[0]!.category).toBe("epistemic_leak");
    expect(flags[0]!.message).toContain("Bob is a spy");
    expect(flags[0]!.message).toContain("Alice");
  });

  it("accepts knowledge sourced from current scene's factsIntroduced", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      factsIntroduced: ["Bob is a spy"],
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Bob is a spy",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags).toHaveLength(0);
  });

  it("accepts knowledge sourced from current scene's factsRevealedToReader", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      factsRevealedToReader: ["the letter is forged"],
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "the letter is forged",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags).toHaveLength(0);
  });

  it("skips unverified prior IRs", () => {
    const unverifiedPrior: NarrativeIR = {
      ...createEmptyNarrativeIR("scene-1"),
      verified: false,
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "secret info",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    };
    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "secret info",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    // Unverified prior shouldn't provide sourcing
    const flags = checkEpistemicLeaks(currentIR, [unverifiedPrior], makeBible());
    expect(flags).toHaveLength(1);
  });

  it("accepts null learned fields (no check needed)", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: null,
          suspicionGained: "Bob is acting strangely",
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });

    // suspicionGained is not checked for sourcing (it's a subjective impression)
    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags).toHaveLength(0); // only `learned` is checked
  });

  it("uses character name in flag message when available", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "unsourced fact",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags[0]!.message).toContain("Alice");
  });

  it("uses characterId in message when character not in bible", () => {
    const currentIR = makeVerifiedIR("scene-2", {
      characterDeltas: [
        {
          characterId: "unknown-id",
          learned: "mystery fact",
          suspicionGained: null,
          emotionalShift: null,
          relationshipChange: null,
        },
      ],
    });
    const flags = checkEpistemicLeaks(currentIR, [], makeBible());
    expect(flags[0]!.message).toContain("unknown-id");
  });
});
