import { describe, expect, it } from "vitest";
import {
  bootstrapToBible,
  buildBootstrapPrompt,
  type ParsedBootstrap,
  parseBootstrapResponse,
} from "../../src/bootstrap/index.js";
import { createEmptyBible, createEmptyChapterArc } from "../../src/types/index.js";

describe("buildBootstrapPrompt", () => {
  it("includes synopsis in user message", () => {
    const payload = buildBootstrapPrompt("A story about two old friends meeting in a bar.");
    expect(payload.userMessage).toContain("A story about two old friends meeting in a bar.");
    expect(payload.systemMessage).toContain("literary analyst");
    expect(payload.temperature).toBe(0.7);
    expect(payload.maxTokens).toBe(16384);
  });

  it("does not include outputSchema (streaming requires plain text)", () => {
    const payload = buildBootstrapPrompt("Any synopsis");
    expect(payload.outputSchema).toBeUndefined();
  });
});

describe("parseBootstrapResponse", () => {
  const validJson: ParsedBootstrap = {
    characters: [{ name: "Marcus", role: "protagonist" }],
    locations: [{ name: "The Bar" }],
    suggestedKillList: ["a sense of"],
  };

  it("parses clean JSON", () => {
    const result = parseBootstrapResponse(JSON.stringify(validJson));
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).characters[0]!.name).toBe("Marcus");
  });

  it("parses markdown-wrapped JSON", () => {
    const wrapped = `Here's the result:\n\`\`\`json\n${JSON.stringify(validJson)}\n\`\`\`\nDone.`;
    const result = parseBootstrapResponse(wrapped);
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).characters[0]!.name).toBe("Marcus");
  });

  it("parses JSON embedded in prose (brace depth)", () => {
    const embedded = `I analyzed the synopsis. ${JSON.stringify(validJson)} Hope this helps!`;
    const result = parseBootstrapResponse(embedded);
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).characters[0]!.name).toBe("Marcus");
  });

  it("returns error for completely invalid input", () => {
    const result = parseBootstrapResponse("This is just text with no JSON at all.");
    expect("error" in result).toBe(true);
    expect((result as { error: string; rawText: string }).rawText).toContain("just text");
  });
});

describe("bootstrapToBible", () => {
  const parsed: ParsedBootstrap = {
    characters: [
      {
        name: "Marcus",
        role: "protagonist",
        physicalDescription: "Weathered hands, crooked nose",
        backstory: "Former boxer turned bartender",
        voiceNotes: "Short sentences, never uses fancy words",
        emotionPhysicality: "Jaw tightens, hands go to pockets",
      },
      {
        name: "Elena",
        role: "supporting",
      },
    ],
    locations: [
      {
        name: "The Bar",
        sensoryPalette: {
          sounds: ["ice in glass", "low murmur"],
          smells: ["old wood"],
          textures: ["sticky bar top"],
          lightQuality: "amber neon",
          prohibitedDefaults: ["dim lighting"],
        },
      },
    ],
    suggestedTone: {
      metaphoricDomains: ["machinery", "water"],
      prohibitedDomains: ["flowers", "sunshine"],
      interiority: "filtered",
    },
    suggestedKillList: ["a sense of", "palpable tension"],
  };

  it("produces Bible with generated IDs", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.projectId).toBe("proj-1");
    expect(bible.characters).toHaveLength(2);
    expect(bible.characters[0]!.id).toBeTruthy();
    expect(bible.characters[0]!.id).not.toBe(bible.characters[1]!.id);
  });

  it("maps character fields correctly", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    const marcus = bible.characters[0]!;
    expect(marcus.name).toBe("Marcus");
    expect(marcus.physicalDescription).toBe("Weathered hands, crooked nose");
    expect(marcus.voice.vocabularyNotes).toBe("Short sentences, never uses fancy words");
    expect(marcus.behavior?.emotionPhysicality).toBe("Jaw tightens, hands go to pockets");
  });

  it("dialogue samples are empty (human must author)", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.characters[0]!.voice.dialogueSamples).toEqual([]);
    expect(bible.characters[1]!.voice.dialogueSamples).toEqual([]);
  });

  it("maps locations with sensory palettes", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.locations).toHaveLength(1);
    expect(bible.locations[0]!.name).toBe("The Bar");
    expect(bible.locations[0]!.sensoryPalette.sounds).toContain("ice in glass");
    expect(bible.locations[0]!.sensoryPalette.prohibitedDefaults).toContain("dim lighting");
  });

  it("maps kill list as exact entries", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.styleGuide.killList).toHaveLength(2);
    expect(bible.styleGuide.killList[0]).toEqual({ pattern: "a sense of", type: "exact" });
  });

  it("maps suggested tone to metaphoric register", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.styleGuide.metaphoricRegister).toEqual({
      approvedDomains: ["machinery", "water"],
      prohibitedDomains: ["flowers", "sunshine"],
    });
  });

  it("handles minimal parsed input", () => {
    const minimal: ParsedBootstrap = {
      characters: [],
      locations: [],
    };
    const bible = bootstrapToBible(minimal, "proj-1");
    expect(bible.characters).toEqual([]);
    expect(bible.locations).toEqual([]);
    expect(bible.styleGuide.killList).toEqual([]);
  });

  it("sets sourcePrompt when provided", () => {
    const bible = bootstrapToBible(parsed, "proj-1", "A noir detective story in a jazz bar.");
    expect(bible.sourcePrompt).toBe("A noir detective story in a jazz bar.");
  });

  it("defaults sourcePrompt to null when omitted", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.sourcePrompt).toBeNull();
  });
});

describe("factory function sourcePrompt defaults", () => {
  it("createEmptyBible includes sourcePrompt: null", () => {
    const bible = createEmptyBible("proj-1");
    expect(bible.sourcePrompt).toBeNull();
  });

  it("createEmptyChapterArc includes sourcePrompt: null", () => {
    const arc = createEmptyChapterArc("proj-1");
    expect(arc.sourcePrompt).toBeNull();
  });
});
