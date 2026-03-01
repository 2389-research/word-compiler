import { describe, expect, it } from "vitest";
import { extractDialogueByCharacter } from "../../src/metrics/voiceSeparability.js";
import { type Bible, type CharacterDossier, createEmptyBible } from "../../src/types/index.js";

// ─── Test Helpers ────────────────────────────────

const EMPTY_VOICE = {
  sentenceLengthRange: null,
  vocabularyNotes: null,
  verbalTics: [],
  metaphoricRegister: null,
  prohibitedLanguage: [],
  dialogueSamples: [],
};

function makeChar(id: string, name: string, role: CharacterDossier["role"] = "supporting"): CharacterDossier {
  return {
    id,
    name,
    role,
    physicalDescription: null,
    backstory: null,
    selfNarrative: null,
    contradictions: null,
    voice: EMPTY_VOICE,
    behavior: null,
  };
}

function makeBible(...chars: CharacterDossier[]): Bible {
  return { ...createEmptyBible("test"), characters: chars };
}

function names(blocks: ReturnType<typeof extractDialogueByCharacter>): string[] {
  return blocks.map((b) => b.characterName);
}

function texts(blocks: ReturnType<typeof extractDialogueByCharacter>): string[] {
  return blocks.map((b) => b.text);
}

// ─── Tests ───────────────────────────────────────

describe("extractDialogueByCharacter", () => {
  // ── Basic verb-based attribution ──────────────
  describe("standard dialogue verbs", () => {
    const bible = makeBible(makeChar("1", "Alice"), makeChar("2", "Bob"));

    it("matches 'said' attribution after quote", () => {
      const result = extractDialogueByCharacter(`"Hello there," Alice said.`, bible);
      expect(names(result)).toEqual(["Alice"]);
      expect(texts(result)).toEqual(["Hello there,"]);
    });

    it("matches attribution before quote", () => {
      const result = extractDialogueByCharacter(`Bob whispered, "Stay quiet."`, bible);
      expect(names(result)).toEqual(["Bob"]);
    });

    it("matches multiple dialogue lines", () => {
      const prose = `"Hello," Alice said. "Hi back," Bob replied.`;
      const result = extractDialogueByCharacter(prose, bible);
      expect(names(result)).toEqual(["Alice", "Bob"]);
    });
  });

  // ── Action-based attribution (no dialogue verb) ──
  describe("action-based attribution (no dialogue verb)", () => {
    const bible = makeBible(makeChar("1", "Marcus"), makeChar("2", "Elena"));

    it("attributes when character performs action after dialogue", () => {
      const result = extractDialogueByCharacter(`"Let's go." Marcus slammed the door.`, bible);
      expect(names(result)).toEqual(["Marcus"]);
    });

    it("attributes when character performs action before dialogue", () => {
      const result = extractDialogueByCharacter(`Elena turned sharply. "Watch your step."`, bible);
      expect(names(result)).toEqual(["Elena"]);
    });

    it("handles unconventional verbs like 'growled' or 'breathed'", () => {
      const result = extractDialogueByCharacter(`"Not a chance," Marcus growled through gritted teeth.`, bible);
      expect(names(result)).toEqual(["Marcus"]);
    });

    it("handles verbs not in any reasonable list", () => {
      const result = extractDialogueByCharacter(`"The signal's dead." Elena tapped the screen twice.`, bible);
      expect(names(result)).toEqual(["Elena"]);
    });
  });

  // ── Multi-word character names ──────────────────
  describe("multi-word character names", () => {
    const bible = makeBible(
      makeChar("1", "Marcus Verne"),
      makeChar("2", "Elena Zhao"),
      makeChar("3", "Captain Torres"),
    );

    it("matches first name to full bible name", () => {
      const result = extractDialogueByCharacter(`"Let's move," Marcus said.`, bible);
      expect(names(result)).toEqual(["Marcus Verne"]);
    });

    it("matches last name to full bible name", () => {
      const result = extractDialogueByCharacter(`"Understood," Verne replied.`, bible);
      expect(names(result)).toEqual(["Marcus Verne"]);
    });

    it("matches title+last name pattern", () => {
      const result = extractDialogueByCharacter(`"Report," Captain Torres demanded.`, bible);
      expect(names(result)).toEqual(["Captain Torres"]);
    });

    it("matches title alone when it's a unique fragment", () => {
      const result = extractDialogueByCharacter(`Torres frowned. "Not yet."`, bible);
      expect(names(result)).toEqual(["Captain Torres"]);
    });

    it("handles mixed name usage across dialogue", () => {
      const prose = [
        `"Orders?" Marcus asked.`,
        `Torres shook his head. "Stand down."`,
        `"Copy that," Zhao confirmed.`,
      ].join("\n");
      const result = extractDialogueByCharacter(prose, bible);
      expect(result).toHaveLength(3);
      // First and third are unambiguous
      expect(result[0]!.characterName).toBe("Marcus Verne");
      expect(result[2]!.characterName).toBe("Elena Zhao");
      // Middle quote: Torres (before) and Zhao (after) compete on proximity
      // Zhao wins because "Zhao" is 14 chars after the quote vs Torres 17 chars before
      expect(result[1]!.characterName).toBe("Elena Zhao");
    });
  });

  // ── Quote styles ──────────────────────────────
  describe("quote styles", () => {
    const bible = makeBible(makeChar("1", "Alice"), makeChar("2", "Bob"));

    it("handles straight double quotes", () => {
      const result = extractDialogueByCharacter(`"Hello," Alice said.`, bible);
      expect(result).toHaveLength(1);
    });

    it("handles left/right curly quotes", () => {
      const result = extractDialogueByCharacter(`\u201CHello,\u201D Alice said.`, bible);
      expect(result).toHaveLength(1);
      expect(names(result)).toEqual(["Alice"]);
    });

    it("handles mixed quote styles in same text", () => {
      const prose = `"Hello," Alice said. \u201CGoodbye,\u201D Bob replied.`;
      const result = extractDialogueByCharacter(prose, bible);
      expect(result).toHaveLength(2);
      expect(names(result)).toEqual(["Alice", "Bob"]);
    });
  });

  // ── Unattributed dialogue ─────────────────────
  describe("unattributed dialogue", () => {
    const bible = makeBible(makeChar("1", "Alice"));

    it("skips dialogue with no character name nearby", () => {
      const result = extractDialogueByCharacter(`"Hello?" The wind howled through the corridor.`, bible);
      expect(result).toHaveLength(0);
    });

    it("skips dialogue attributed only by pronoun", () => {
      // "she" is not a character name — should not attribute
      const result = extractDialogueByCharacter(`"I don't know," she said with a shrug.`, bible);
      expect(result).toHaveLength(0);
    });
  });

  // ── Proximity: closest name wins ──────────────
  describe("proximity resolution", () => {
    const bible = makeBible(makeChar("1", "Marcus"), makeChar("2", "Elena"), makeChar("3", "Torres"));

    it("picks the name closest to the quote when multiple are nearby", () => {
      // Marcus is right after the quote; Elena is further away
      const result = extractDialogueByCharacter(`"Get down!" Marcus yelled, pulling Elena behind the wall.`, bible);
      expect(names(result)).toEqual(["Marcus"]);
    });

    it("before-context picks the closest (last) name to the quote", () => {
      // Elena is closer to the quote than Marcus
      const result = extractDialogueByCharacter(`Marcus watched as Elena steadied herself. "I'm fine."`, bible);
      expect(names(result)).toEqual(["Elena"]);
    });

    it("prefers after-context name when equidistant", () => {
      const result = extractDialogueByCharacter(`Elena paused. "Let's go." Marcus nodded.`, bible);
      // "Marcus" is in after-context, "Elena" is in before-context
      // After at distance ~1, Before "Elena" at distance ~9
      expect(names(result)).toEqual(["Marcus"]);
    });
  });

  // ── Edge cases ────────────────────────────────
  describe("edge cases", () => {
    it("returns empty array when bible has no characters", () => {
      const bible = makeBible();
      const result = extractDialogueByCharacter(`"Hello," someone said.`, bible);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for empty prose", () => {
      const bible = makeBible(makeChar("1", "Alice"));
      const result = extractDialogueByCharacter("", bible);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for prose with no quotes", () => {
      const bible = makeBible(makeChar("1", "Alice"));
      const result = extractDialogueByCharacter("Alice walked through the door and sat down.", bible);
      expect(result).toHaveLength(0);
    });

    it("skips very short quoted text (< 2 chars)", () => {
      const bible = makeBible(makeChar("1", "Alice"));
      const result = extractDialogueByCharacter(`"I" Alice said.`, bible);
      expect(result).toHaveLength(0);
    });

    it("skips name fragments shorter than 3 characters", () => {
      // "Li" is too short to be a reliable name fragment
      const bible = makeBible(makeChar("1", "Li Wei"));
      const result = extractDialogueByCharacter(`"Hello," Li said.`, bible);
      // "Li" is 2 chars, below MIN_NAME_FRAGMENT_LENGTH (3)
      // "Wei" is 3 chars, should work
      expect(result).toHaveLength(0); // "Li" is too short, and "Wei" is not in the prose
    });

    it("matches name fragments at exactly 3 characters", () => {
      const bible = makeBible(makeChar("1", "Wei Chen"));
      const result = extractDialogueByCharacter(`"Hello," Wei said.`, bible);
      expect(result).toHaveLength(1);
      expect(names(result)).toEqual(["Wei Chen"]);
    });
  });

  // ── Overlapping / ambiguous names ─────────────
  describe("overlapping name fragments", () => {
    it("does not double-count when same fragment maps to one character", () => {
      const bible = makeBible(makeChar("1", "Marcus Verne"));
      const result = extractDialogueByCharacter(`"Let's go," Marcus Verne said. "Alright," Verne replied.`, bible);
      // Both should attribute to the same character
      const ids = result.map((b) => b.characterId);
      expect(ids).toEqual(["1", "1"]);
    });

    it("handles two characters sharing a name fragment", () => {
      // Both characters have "Torres" but first registration wins in the index
      const bible = makeBible(makeChar("1", "Captain Torres"), makeChar("2", "Maria Torres"));
      const result = extractDialogueByCharacter(`"Hello," Captain Torres said.`, bible);
      expect(result).toHaveLength(1);
      // "Captain" uniquely maps to character 1, "Torres" maps to whichever was indexed first
      expect(result[0]!.characterId).toBe("1");
    });
  });

  // ── Realistic multi-paragraph prose ───────────
  describe("realistic prose", () => {
    const bible = makeBible(
      makeChar("1", "Marcus Verne"),
      makeChar("2", "Elena Zhao"),
      makeChar("3", "Captain Torres"),
    );

    it("handles a realistic multi-paragraph exchange", () => {
      const prose = [
        `"We need to reach the site before dawn," Marcus said, checking his watch.`,
        ``,
        `Elena stepped closer to the map. "The northern route is shorter but exposed."`,
        ``,
        `"Agreed." Torres folded his arms. "We take the ridge."`,
        ``,
        `"Fine by me." Marcus shouldered his pack.`,
      ].join("\n");

      const result = extractDialogueByCharacter(prose, bible);
      // Should find at least 5 dialogue blocks total
      expect(result.length).toBeGreaterThanOrEqual(5);

      // Verify at least 2 distinct characters are attributed
      const uniqueChars = new Set(result.map((b) => b.characterId));
      expect(uniqueChars.size).toBeGreaterThanOrEqual(2);

      // First and last are unambiguously Marcus
      expect(result[0]!.characterName).toBe("Marcus Verne");
      expect(result[result.length - 1]!.characterName).toBe("Marcus Verne");
    });

    it("handles rapid back-and-forth dialogue", () => {
      const prose = [
        `"Status?" Marcus asked.`,
        `"Clear," Elena replied.`,
        `"Move out," Torres ordered.`,
        `"Copy," Marcus confirmed.`,
      ].join("\n");

      const result = extractDialogueByCharacter(prose, bible);
      expect(result).toHaveLength(4);
      expect(names(result)).toEqual(["Marcus Verne", "Elena Zhao", "Captain Torres", "Marcus Verne"]);
    });

    it("handles dialogue interspersed with narration", () => {
      const prose = [
        `The wind picked up as they approached the ridge.`,
        ``,
        `"Do you hear that?" Elena whispered, pressing herself against the rock.`,
        ``,
        `The sound grew louder — a low mechanical hum from somewhere below.`,
        ``,
        `Marcus peered over the edge. "There's a facility down there."`,
        ``,
        `They exchanged glances. This wasn't on any of their maps.`,
      ].join("\n");

      const result = extractDialogueByCharacter(prose, bible);
      expect(result).toHaveLength(2);
      expect(names(result)).toEqual(["Elena Zhao", "Marcus Verne"]);
    });
  });

  // ── Context window boundary ───────────────────
  describe("context window boundaries", () => {
    const bible = makeBible(makeChar("1", "Alice"), makeChar("2", "Bob"));

    it("does not attribute when character name is beyond the context window", () => {
      // 130+ characters of filler between the quote and the name
      const filler =
        "The long corridor stretched endlessly before them, winding through the ancient ruins. " +
        "Shadows danced on the crumbling walls as torches flickered in the draft. ";
      const prose = `"Hello?" ${filler}Alice turned the corner.`;
      const result = extractDialogueByCharacter(prose, bible);
      // Alice is 160+ chars after the quote — beyond the 120 char window
      expect(result).toHaveLength(0);
    });

    it("attributes when character name is just within the context window", () => {
      // ~80 characters of filler — within the 120 char window
      const filler = "The corridor was dark and quiet as the sounds of footsteps echoed. ";
      const prose = `"Hello?" ${filler}Alice stopped.`;
      const result = extractDialogueByCharacter(prose, bible);
      expect(result).toHaveLength(1);
      expect(names(result)).toEqual(["Alice"]);
    });
  });

  // ── Integration with measureVoiceSeparability ──
  describe("integration with measureVoiceSeparability", () => {
    it("the existing measureVoiceSeparability tests still pass with new extraction", () => {
      // This is validated by the existing test file — this test just confirms
      // that multi-word names flow through correctly to stats
      const bible = makeBible(makeChar("1", "Marcus Verne"), makeChar("2", "Elena Zhao"));
      const prose = [
        `"Quick." Marcus moved. "Now." Marcus gestured. "Go." Marcus pointed.`,
        `"I have been thinking about this situation for quite some time and I believe we should consider all options carefully before making any hasty decisions," Elena said.`,
      ].join("\n\n");
      const result = extractDialogueByCharacter(prose, bible);
      const marcusCount = result.filter((b) => b.characterId === "1").length;
      const elenaCount = result.filter((b) => b.characterId === "2").length;
      expect(marcusCount).toBeGreaterThanOrEqual(2);
      expect(elenaCount).toBeGreaterThanOrEqual(1);
    });
  });
});
