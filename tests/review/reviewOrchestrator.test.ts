import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LLMReviewClient } from "../../src/review/orchestrator.js";
import { createReviewOrchestrator } from "../../src/review/orchestrator.js";
import type { ChunkView, EditorialAnnotation } from "../../src/review/types.js";
import { createEmptyBible } from "../../src/types/bible.js";
import { createEmptyScenePlan } from "../../src/types/scene.js";

function makeBible() {
  const bible = createEmptyBible("p1");
  bible.styleGuide.killList = [{ pattern: "very", type: "exact" }];
  return bible;
}

function makeScene() {
  const scene = createEmptyScenePlan("p1");
  scene.povCharacterId = "";
  return scene;
}

function makeChunk(text: string, index = 0): ChunkView {
  return { index, text, sceneId: "scene-1" };
}

function makeLLMResponse(annotations: Array<Record<string, unknown>> = []) {
  return JSON.stringify({ annotations });
}

function createMockClient(response: string | Error = makeLLMResponse()): LLMReviewClient {
  return {
    review: vi.fn().mockImplementation((_sys: string, _user: string, signal: AbortSignal) => {
      if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response);
    }),
  };
}

function getAnns(onChange: ReturnType<typeof vi.fn>, callIndex = 0): EditorialAnnotation[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (onChange.mock.calls as Array<[number, EditorialAnnotation[]]>)[callIndex]![1];
}

describe("createReviewOrchestrator", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("produces local annotations for kill list violations", async () => {
    const client = createMockClient();
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy and very excited.")]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    const killAnns = anns.filter((a) => a.category === "kill_list");
    expect(killAnns.length).toBeGreaterThanOrEqual(2);
  });

  it("merges local and LLM annotations", async () => {
    const llmResponse = makeLLMResponse([
      {
        category: "tone",
        severity: "warning",
        scope: "narration",
        message: "Tone feels inconsistent",
        suggestion: null,
        anchor: { prefix: "She was", focus: "very happy", suffix: "and very" },
      },
    ]);
    const client = createMockClient(llmResponse);
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy and very excited.")]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    const categories = anns.map((a) => a.category);
    expect(categories).toContain("kill_list");
    expect(categories).toContain("tone");
  });

  it("filters dismissed annotations by fingerprint", async () => {
    const client = createMockClient();
    const bible = makeBible();
    const chunk = makeChunk("She was very happy.");

    // First run to get fingerprints
    const firstOnChange = vi.fn();
    const orch1 = createReviewOrchestrator(bible, makeScene(), new Set(), client, firstOnChange);
    orch1.requestReview([chunk]);
    await vi.waitFor(() => expect(firstOnChange).toHaveBeenCalled());
    const firstAnns = getAnns(firstOnChange);
    const killFingerprint = firstAnns.find((a) => a.category === "kill_list")?.fingerprint;
    expect(killFingerprint).toBeDefined();

    // Second run with that fingerprint dismissed
    const dismissed = new Set([killFingerprint!]);
    const orch2 = createReviewOrchestrator(bible, makeScene(), dismissed, client, onChange);
    orch2.requestReview([chunk]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    const killAnns = anns.filter((a) => a.category === "kill_list");
    expect(killAnns).toHaveLength(0);
  });

  it("falls back to local-only on LLM failure", async () => {
    const client = createMockClient(new Error("API error"));
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.")]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    expect(anns.length).toBeGreaterThan(0);
    expect(anns.every((a) => a.category === "kill_list")).toBe(true);
  });

  it("aborts previous request when new one starts", async () => {
    let resolveFirst: (value: string) => void;
    const firstPromise = new Promise<string>((r) => {
      resolveFirst = r;
    });
    const client: LLMReviewClient = {
      review: vi.fn().mockImplementation((_sys: string, _user: string, signal: AbortSignal) => {
        if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
        return firstPromise;
      }),
    };

    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.")]);
    // Second request should abort the first
    orch.requestReview([makeChunk("A different chunk.")]);

    // Resolve the first after abort
    resolveFirst!(makeLLMResponse());
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(client.review).toHaveBeenCalledTimes(2);
  });

  it("cancelAll clears reviewing set", () => {
    const neverResolves: LLMReviewClient = {
      review: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), neverResolves, onChange);

    orch.requestReview([makeChunk("text", 0), makeChunk("more", 1)]);
    expect(orch.reviewing.size).toBe(2);

    orch.cancelAll();
    expect(orch.reviewing.size).toBe(0);
  });

  it("handles malformed LLM JSON gracefully", async () => {
    const client = createMockClient("not valid json {{{");
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.")]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    expect(anns.length).toBeGreaterThan(0);
  });

  it("handles empty LLM annotations array", async () => {
    const client = createMockClient(makeLLMResponse([]));
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.")]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    const anns = getAnns(onChange);
    expect(anns.every((a) => a.category === "kill_list")).toBe(true);
  });

  it("reviews multiple chunks independently", async () => {
    const client = createMockClient();
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.", 0), makeChunk("Clean prose here.", 1)]);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));

    const calls = onChange.mock.calls as Array<[number, EditorialAnnotation[]]>;
    const chunk0Anns = calls.find((c) => c[0] === 0)![1];
    const chunk1Anns = calls.find((c) => c[0] === 1)![1];

    expect(chunk0Anns.some((a) => a.category === "kill_list")).toBe(true);
    expect(chunk1Anns.every((a) => a.category !== "kill_list")).toBe(true);
  });

  it("stores annotations in the map", async () => {
    const client = createMockClient();
    const orch = createReviewOrchestrator(makeBible(), makeScene(), new Set(), client, onChange);

    orch.requestReview([makeChunk("She was very happy.", 0)]);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(orch.annotations.has(0)).toBe(true);
    expect(orch.annotations.get(0)!.length).toBeGreaterThan(0);
  });
});
