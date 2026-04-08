import { describe, expect, it } from "vitest";
import {
  bootstrapToBible,
  buildBootstrapPrompt,
  type ParsedBootstrap,
  parseBootstrapResponse,
} from "../../src/bootstrap/index.js";
import { createEmptyBible, createEmptyChapterArc } from "../../src/types/index.js";

describe("buildBootstrapPrompt", () => {
  it("includes brief in user message", () => {
    const payload = buildBootstrapPrompt("Why AI writing tools fail at voice matching");
    expect(payload.userMessage).toContain("Why AI writing tools fail at voice matching");
    expect(payload.systemMessage).toContain("editorial analyst");
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
    thesis: "AI writing tools fail because they treat voice as a prompt, not a learning problem.",
    sections: [{ heading: "The Problem", purpose: "Establish the failure mode", keyPoints: ["voice drift"] }],
    suggestedKillList: ["a sense of"],
    structuralBans: ["Never open with a rhetorical question"],
  };

  it("parses clean JSON", () => {
    const result = parseBootstrapResponse(JSON.stringify(validJson));
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).thesis).toContain("AI writing tools");
  });

  it("parses markdown-wrapped JSON", () => {
    const wrapped = `Here's the result:\n\`\`\`json\n${JSON.stringify(validJson)}\n\`\`\`\nDone.`;
    const result = parseBootstrapResponse(wrapped);
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).thesis).toContain("AI writing tools");
  });

  it("parses JSON embedded in prose (brace depth)", () => {
    const embedded = `I analyzed the brief. ${JSON.stringify(validJson)} Hope this helps!`;
    const result = parseBootstrapResponse(embedded);
    expect("error" in result).toBe(false);
    expect((result as ParsedBootstrap).thesis).toContain("AI writing tools");
  });

  it("returns error for completely invalid input", () => {
    const result = parseBootstrapResponse("This is just text with no JSON at all.");
    expect("error" in result).toBe(true);
    expect((result as { error: string; rawText: string }).rawText).toContain("just text");
  });
});

describe("bootstrapToBible", () => {
  const parsed: ParsedBootstrap = {
    thesis: "AI writing tools fail because they treat voice as a prompt, not a learning problem.",
    sections: [
      { heading: "The Problem", purpose: "Establish the failure mode", keyPoints: ["voice drift", "context loss"] },
      { heading: "The Solution", purpose: "Introduce the compiler approach", keyPoints: ["three-ring architecture"] },
    ],
    suggestedTone: {
      register: "conversational-authoritative",
      audience: "tech-savvy writers",
      pacingNotes: "Build slowly, hit hard at the end",
    },
    suggestedKillList: ["a sense of", "palpable tension"],
    structuralBans: ["Never open with a dictionary definition"],
  };

  it("produces Bible with author persona", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.projectId).toBe("proj-1");
    expect(bible.characters).toHaveLength(1);
    expect(bible.characters[0]!.name).toBe("Author");
    expect(bible.characters[0]!.id).toBeTruthy();
  });

  it("maps tone to author persona voice notes", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.characters[0]!.voice.vocabularyNotes).toBe("conversational-authoritative");
  });

  it("stores thesis in narrativeRules.subtextPolicy", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.narrativeRules.subtextPolicy).toContain("AI writing tools fail");
  });

  it("merges default and bootstrap kill lists", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    // Should have default kills + bootstrap kills, deduplicated
    expect(bible.styleGuide.killList.length).toBeGreaterThan(40);
    expect(bible.styleGuide.killList.some((k) => k.pattern === "delve")).toBe(true);
    expect(bible.styleGuide.killList.some((k) => k.pattern === "palpable tension")).toBe(true);
    expect(bible.styleGuide.killList.every((k) => k.type === "exact")).toBe(true);
  });

  it("merges default and bootstrap structural bans", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.styleGuide.structuralBans.length).toBeGreaterThan(7);
    expect(bible.styleGuide.structuralBans).toContain("Never open with a dictionary definition");
    expect(bible.styleGuide.structuralBans.some((b) => b.includes("However"))).toBe(true);
  });

  it("has no locations", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.locations).toEqual([]);
  });

  it("defaults to first-person POV for essays", () => {
    const bible = bootstrapToBible(parsed, "proj-1");
    expect(bible.narrativeRules.pov.default).toBe("first");
  });

  it("handles minimal parsed input with default kills", () => {
    const minimal: ParsedBootstrap = {};
    const bible = bootstrapToBible(minimal, "proj-1");
    expect(bible.characters).toHaveLength(1);
    expect(bible.locations).toEqual([]);
    // Default kill list should still be populated
    expect(bible.styleGuide.killList.length).toBeGreaterThan(40);
  });

  it("sets sourcePrompt when provided", () => {
    const bible = bootstrapToBible(parsed, "proj-1", "Why AI writing tools fail at voice matching");
    expect(bible.sourcePrompt).toBe("Why AI writing tools fail at voice matching");
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
