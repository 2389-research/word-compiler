import { describe, expect, it } from "vitest";
import type { SceneEntry } from "../../src/app/store/project.svelte.js";
import { exportToMarkdown } from "../../src/export/markdown.js";
import type { ChapterArc, Chunk } from "../../src/types/index.js";

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

function makeArc(title: string): ChapterArc {
  return {
    id: "arc-1",
    projectId: "p1",
    chapterNumber: 1,
    workingTitle: title,
    narrativeFunction: "",
    dominantRegister: "",
    pacingTarget: "",
    endingPosture: "",
    readerStateEntering: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    readerStateExiting: { knows: [], suspects: [], wrongAbout: [], activeTensions: [] },
    sourcePrompt: null,
  };
}

describe("exportToMarkdown", () => {
  it("generates chapter heading from arc title", () => {
    const scenes = [makeScene("s1", "Opening", 0)];
    const chunks = { s1: [makeChunk("Hello world.")] };
    const result = exportToMarkdown(scenes, chunks, makeArc("Chapter One"));
    expect(result).toContain("# Chapter One");
  });

  it("generates scene headings", () => {
    const scenes = [makeScene("s1", "The Arrival", 0)];
    const chunks = { s1: [makeChunk("She arrived.")] };
    const result = exportToMarkdown(scenes, chunks);
    expect(result).toContain("## The Arrival");
  });

  it("uses scene separators between scenes", () => {
    const scenes = [makeScene("s1", "A", 0), makeScene("s2", "B", 1)];
    const chunks = { s1: [makeChunk("First.")], s2: [makeChunk("Second.")] };
    const result = exportToMarkdown(scenes, chunks);
    expect(result).toContain("---");
  });

  it("uses canonical text (editedText over generatedText)", () => {
    const scenes = [makeScene("s1", "Test", 0)];
    const chunks = { s1: [makeChunk("original", "edited version")] };
    const result = exportToMarkdown(scenes, chunks);
    expect(result).toContain("edited version");
    expect(result).not.toContain("original");
  });

  it("skips scenes with no chunks", () => {
    const scenes = [makeScene("s1", "A", 0), makeScene("s2", "B", 1)];
    const chunks = { s1: [makeChunk("Hello.")], s2: [] };
    const result = exportToMarkdown(scenes, chunks);
    expect(result).not.toContain("## B");
    expect(result).toContain("## A");
  });

  it("includes word count footer", () => {
    const scenes = [makeScene("s1", "A", 0)];
    const chunks = { s1: [makeChunk("One two three four five.")] };
    const result = exportToMarkdown(scenes, chunks);
    expect(result).toMatch(/\*\d+ words\*/);
  });

  it("returns empty-ish output for no scenes with prose", () => {
    const result = exportToMarkdown([], {});
    expect(result).toBe("");
  });

  it("sorts scenes by sceneOrder", () => {
    const scenes = [makeScene("s2", "B", 1), makeScene("s1", "A", 0)];
    const chunks = { s1: [makeChunk("First scene.")], s2: [makeChunk("Second scene.")] };
    const result = exportToMarkdown(scenes, chunks);
    const aIdx = result.indexOf("## A");
    const bIdx = result.indexOf("## B");
    expect(aIdx).toBeLessThan(bIdx);
  });
});
