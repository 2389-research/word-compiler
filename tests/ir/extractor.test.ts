import { describe, expect, it, vi } from "vitest";
import { buildIRExtractionPrompt, extractIR, type IRLLMClient } from "../../src/ir/extractor.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

function makeMockClient(responseText: string): IRLLMClient {
  return {
    call: vi.fn().mockResolvedValue(responseText),
  };
}

const SCENE_ID = "scene-123";

function makePlan() {
  const plan = createEmptyScenePlan("proj-1");
  return {
    ...plan,
    id: SCENE_ID,
    title: "The Confrontation",
    narrativeGoal: "Alice discovers the truth",
    emotionalBeat: "shock turning to resolve",
  };
}

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
    narrativeRules: {
      ...bible.narrativeRules,
      setups: [
        {
          id: "s1",
          description: "The hidden letter",
          plantedInScene: null,
          payoffInScene: null,
          status: "planned" as const,
        },
      ],
    },
  };
}

const VALID_IR_JSON = JSON.stringify({
  events: ["Alice found the letter", "Confrontation with Bob"],
  factsIntroduced: ["The letter proves Bob lied"],
  factsRevealedToReader: ["Bob knew all along"],
  factsWithheld: ["Who wrote the letter"],
  characterDeltas: [
    {
      characterId: "char-alice",
      learned: "Bob lied",
      suspicionGained: null,
      emotionalShift: "shock to resolve",
      relationshipChange: "trust broken",
    },
  ],
  setupsPlanted: [],
  payoffsExecuted: ["The hidden letter payoff"],
  characterPositions: { Alice: "study" },
  unresolvedTensions: ["Who wrote the letter?"],
});

describe("buildIRExtractionPrompt", () => {
  it("includes scene title and narrative goal", () => {
    const prompt = buildIRExtractionPrompt("Some prose here.", makePlan(), makeBible());
    expect(prompt).toContain("The Confrontation");
    expect(prompt).toContain("Alice discovers the truth");
  });

  it("includes character list with ids", () => {
    const prompt = buildIRExtractionPrompt("Some prose here.", makePlan(), makeBible());
    expect(prompt).toContain("char-alice");
    expect(prompt).toContain("Alice");
  });

  it("includes the prose", () => {
    const prose = "She opened the drawer and found it.";
    const prompt = buildIRExtractionPrompt(prose, makePlan(), makeBible());
    expect(prompt).toContain(prose);
  });

  it("includes active setups", () => {
    const prompt = buildIRExtractionPrompt("prose", makePlan(), makeBible());
    expect(prompt).toContain("The hidden letter");
  });

  it("shows (none registered) when no setups", () => {
    const bible = { ...makeBible(), narrativeRules: { ...makeBible().narrativeRules, setups: [] } };
    const prompt = buildIRExtractionPrompt("prose", makePlan(), bible);
    expect(prompt).toContain("(none registered)");
  });
});

describe("extractIR", () => {
  it("calls the LLM client and parses the response", async () => {
    const client = makeMockClient(VALID_IR_JSON);
    const ir = await extractIR("The prose of the scene.", makePlan(), makeBible(), client);

    expect(client.call).toHaveBeenCalledOnce();
    expect(ir.sceneId).toBe(SCENE_ID);
    expect(ir.events).toContain("Alice found the letter");
    expect(ir.characterDeltas[0]!.learned).toBe("Bob lied");
    expect(ir.verified).toBe(false);
  });

  it("uses default model when none specified", async () => {
    const client = makeMockClient(VALID_IR_JSON);
    await extractIR("prose", makePlan(), makeBible(), client);
    const callArgs = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(callArgs[2]).toBe("claude-sonnet-4-6");
  });

  it("uses specified model", async () => {
    const client = makeMockClient(VALID_IR_JSON);
    await extractIR("prose", makePlan(), makeBible(), client, "claude-opus-4-6");
    const callArgs = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(callArgs[2]).toBe("claude-opus-4-6");
  });

  it("returns empty IR when LLM returns unparseable response", async () => {
    const client = makeMockClient("I cannot do this task.");
    const ir = await extractIR("prose", makePlan(), makeBible(), client);
    expect(ir.sceneId).toBe(SCENE_ID);
    expect(ir.events).toHaveLength(0);
  });
});
