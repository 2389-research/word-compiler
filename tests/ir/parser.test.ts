import { describe, expect, it } from "vitest";
import { isStringArray, parseIRResponse } from "../../src/ir/parser.js";

const SCENE_ID = "scene-test-1";

describe("parseIRResponse", () => {
  it("parses a complete valid JSON response", () => {
    const json = JSON.stringify({
      events: ["Alice walked into the room", "Bob left without speaking"],
      factsIntroduced: ["Alice has a key"],
      factsRevealedToReader: ["Bob knows about the letter"],
      factsWithheld: ["The letter's contents"],
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Bob has been lying",
          suspicionGained: null,
          emotionalShift: "suspicion to certainty",
          relationshipChange: null,
        },
      ],
      setupsPlanted: ["The key was placed on the mantle"],
      payoffsExecuted: [],
      characterPositions: { Alice: "study, alone", Bob: "fled the house" },
      unresolvedTensions: ["What was in the letter?"],
    });

    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.sceneId).toBe(SCENE_ID);
    expect(ir.verified).toBe(false);
    expect(ir.events).toHaveLength(2);
    expect(ir.events[0]).toBe("Alice walked into the room");
    expect(ir.factsIntroduced).toContain("Alice has a key");
    expect(ir.characterDeltas).toHaveLength(1);
    expect(ir.characterDeltas[0]!.characterId).toBe("char-alice");
    expect(ir.characterDeltas[0]!.learned).toBe("Bob has been lying");
    expect(ir.characterPositions.Alice).toBe("study, alone");
    expect(ir.unresolvedTensions).toHaveLength(1);
  });

  it("parses JSON wrapped in markdown code fences", () => {
    const json = `Here is the extraction:\n\`\`\`json\n${JSON.stringify({
      events: ["The confrontation happened"],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: {},
      unresolvedTensions: [],
    })}\n\`\`\``;

    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.events).toHaveLength(1);
    expect(ir.events[0]).toBe("The confrontation happened");
  });

  it("extracts JSON from mixed prose + JSON via brace-depth counting", () => {
    const json = `I've analyzed the scene carefully. Here is what I found:\n\n{\n  "events": ["The key was found"],\n  "factsIntroduced": ["key exists"],\n  "factsRevealedToReader": [],\n  "factsWithheld": [],\n  "characterDeltas": [],\n  "setupsPlanted": [],\n  "payoffsExecuted": [],\n  "characterPositions": {},\n  "unresolvedTensions": []\n}\n\nThank you for using this tool.`;

    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.events).toContain("The key was found");
  });

  it("throws on completely unparseable response", () => {
    expect(() => parseIRResponse("I cannot parse this at all. No JSON here!", SCENE_ID)).toThrow(
      "unparseable response",
    );
  });

  it("coerces non-string array items to strings", () => {
    const json = JSON.stringify({
      events: [123, true, "valid string"],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: {},
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.events).toHaveLength(3);
    expect(ir.events[0]).toBe("123");
    expect(ir.events[1]).toBe("true");
    expect(ir.events[2]).toBe("valid string");
  });

  it("handles missing fields gracefully (partial response)", () => {
    const json = JSON.stringify({ events: ["only events provided"] });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.events).toHaveLength(1);
    expect(ir.factsIntroduced).toHaveLength(0);
    expect(ir.characterDeltas).toHaveLength(0);
    expect(ir.characterPositions).toEqual({});
  });

  it("coerces characterPositions non-string values to strings", () => {
    const json = JSON.stringify({
      events: ["Alice moved"],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: { Alice: 42, Bob: true },
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.characterPositions.Alice).toBe("42");
    expect(ir.characterPositions.Bob).toBe("true");
  });

  it("handles null characterDelta fields", () => {
    const json = JSON.stringify({
      events: [],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [
        { characterId: "char-1", learned: null, suspicionGained: null, emotionalShift: null, relationshipChange: null },
      ],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: {},
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.characterDeltas[0]!.learned).toBeNull();
    expect(ir.characterDeltas[0]!.suspicionGained).toBeNull();
  });

  it("coerces array-format characterPositions (new format)", () => {
    const json = JSON.stringify({
      events: ["Alice entered"],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: [{ characterId: "alice", position: "study" }, { characterId: "bob" }],
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.characterPositions.alice).toBe("study");
    expect(ir.characterPositions.bob).toBe("");
  });

  it("returns empty defaults for non-object characterDelta items", () => {
    const json = JSON.stringify({
      events: ["something happened"],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [null, 42, "bad"],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: {},
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.characterDeltas).toHaveLength(3);
    for (const delta of ir.characterDeltas) {
      expect(delta.characterId).toBe("");
      expect(delta.learned).toBeNull();
      expect(delta.suspicionGained).toBeNull();
      expect(delta.emotionalShift).toBeNull();
      expect(delta.relationshipChange).toBeNull();
    }
  });

  it("throws when IR has no recognizable content", () => {
    const json = JSON.stringify({
      events: [],
      factsIntroduced: [],
      characterDeltas: [],
      unresolvedTensions: [],
    });
    expect(() => parseIRResponse(json, SCENE_ID)).toThrow("no recognizable content");
  });

  it("coerces object items in arrays to JSON strings", () => {
    const json = JSON.stringify({
      events: [{ nested: true }],
      factsIntroduced: [],
      factsRevealedToReader: [],
      factsWithheld: [],
      characterDeltas: [],
      setupsPlanted: [],
      payoffsExecuted: [],
      characterPositions: {},
      unresolvedTensions: [],
    });
    const ir = parseIRResponse(json, SCENE_ID);
    expect(ir.events).toHaveLength(1);
    expect(ir.events[0]).toBe('{"nested":true}');
  });

  it("isStringArray rejects non-string arrays", () => {
    expect(isStringArray([1, 2])).toBe(false);
    expect(isStringArray("not-array")).toBe(false);
    expect(isStringArray(["a", "b"])).toBe(true);
  });
});
