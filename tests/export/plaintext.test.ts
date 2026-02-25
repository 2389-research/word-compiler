import { describe, expect, it } from "vitest";
import type { SceneEntry } from "../../src/app/store/project.svelte.js";
import { exportToPlaintext } from "../../src/export/plaintext.js";
import type { Chunk } from "../../src/types/index.js";

function makeChunk(text: string, edited?: string): Chunk {
  return {
    id: `c-${Math.random()}`,
    sceneId: "s1",
    sequenceNumber: 0,
    generatedText: text,
    payloadHash: "",
    model: "test",
    temperature: 0.8,
    topP: 0.9,
    generatedAt: new Date().toISOString(),
    status: edited ? "edited" : "accepted",
    editedText: edited ?? null,
    humanNotes: null,
  };
}

function makeScene(id: string, title: string, order: number): SceneEntry {
  return {
    plan: {
      id,
      projectId: "p1",
      chapterId: null,
      title,
      povCharacterId: "",
      povDistance: "close",
      narrativeGoal: "",
      emotionalBeat: "",
      readerEffect: "",
      readerStateEntering: null,
      readerStateExiting: null,
      characterKnowledgeChanges: {},
      subtext: null,
      dialogueConstraints: {},
      pacing: null,
      density: "moderate",
      sensoryNotes: null,
      sceneSpecificProhibitions: [],
      anchorLines: [],
      estimatedWordCount: [500, 800],
      chunkCount: 2,
      chunkDescriptions: [],
      failureModeToAvoid: "",
      locationId: null,
      presentCharacterIds: [],
    },
    status: "complete",
    sceneOrder: order,
  };
}

describe("exportToPlaintext", () => {
  it("joins scenes with asterisk separators", () => {
    const scenes = [makeScene("s1", "A", 0), makeScene("s2", "B", 1)];
    const chunks = { s1: [makeChunk("First.")], s2: [makeChunk("Second.")] };
    const result = exportToPlaintext(scenes, chunks);
    expect(result).toContain("* * *");
    expect(result).toContain("First.");
    expect(result).toContain("Second.");
  });

  it("uses canonical text", () => {
    const scenes = [makeScene("s1", "A", 0)];
    const chunks = { s1: [makeChunk("generated", "edited")] };
    const result = exportToPlaintext(scenes, chunks);
    expect(result).toBe("edited");
  });

  it("skips empty scenes", () => {
    const scenes = [makeScene("s1", "A", 0), makeScene("s2", "B", 1)];
    const chunks = { s1: [makeChunk("Only this.")], s2: [] };
    const result = exportToPlaintext(scenes, chunks);
    expect(result).toBe("Only this.");
    expect(result).not.toContain("* * *");
  });

  it("returns empty string for no prose", () => {
    expect(exportToPlaintext([], {})).toBe("");
  });

  it("sorts scenes by sceneOrder", () => {
    const scenes = [makeScene("s2", "B", 1), makeScene("s1", "A", 0)];
    const chunks = { s1: [makeChunk("AAA")], s2: [makeChunk("BBB")] };
    const result = exportToPlaintext(scenes, chunks);
    expect(result.indexOf("AAA")).toBeLessThan(result.indexOf("BBB"));
  });

  it("joins multiple chunks within a scene", () => {
    const scenes = [makeScene("s1", "A", 0)];
    const chunks = { s1: [makeChunk("Paragraph one."), makeChunk("Paragraph two.")] };
    const result = exportToPlaintext(scenes, chunks);
    expect(result).toContain("Paragraph one.\n\nParagraph two.");
  });
});
