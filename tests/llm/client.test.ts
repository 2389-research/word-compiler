import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callLLM,
  fetchModels,
  type GenerateResponse,
  generate,
  generateStream,
  type StreamCallbacks,
} from "../../src/llm/client.js";
import type { CompiledPayload } from "../../src/types/index.js";

// ─── Helpers ─────────────────────────────────────────────

function makePayload(overrides?: Partial<CompiledPayload>): CompiledPayload {
  return {
    systemMessage: "You are a helpful assistant.",
    userMessage: "Write a sentence.",
    temperature: 0.7,
    topP: 1,
    maxTokens: 1024,
    model: "claude-opus-4-6",
    ...overrides,
  };
}

function mockFetchOk(body: unknown, headers?: Record<string, string>): void {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
    headers: new Headers(headers),
    body: null,
  });
}

function mockFetchError(status: number, statusText: string, errorBody?: unknown): void {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: errorBody !== undefined ? () => Promise.resolve(errorBody) : () => Promise.reject(new Error("no json")),
    body: null,
  });
}

/** Build a ReadableStream reader that yields the given string chunks in sequence. */
function makeStreamReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    read: vi.fn().mockImplementation(() => {
      if (index < chunks.length) {
        const value = encoder.encode(chunks[index]);
        index++;
        return Promise.resolve({ done: false, value });
      }
      return Promise.resolve({ done: true, value: undefined });
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

function mockFetchStream(chunks: string[]): void {
  const reader = makeStreamReader(chunks);
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({}),
    body: { getReader: () => reader },
  });
}

function makeCallbacks(): StreamCallbacks & {
  tokens: string[];
  doneArgs: Array<{ usage: { input_tokens: number; output_tokens: number }; stopReason: string }>;
  errors: string[];
} {
  const tokens: string[] = [];
  const doneArgs: Array<{ usage: { input_tokens: number; output_tokens: number }; stopReason: string }> = [];
  const errors: string[] = [];
  return {
    tokens,
    doneArgs,
    errors,
    onToken: vi.fn((text: string) => tokens.push(text)),
    onDone: vi.fn((usage, stopReason) => doneArgs.push({ usage, stopReason })),
    onError: vi.fn((error: string) => errors.push(error)),
  };
}

// ─── Setup / Teardown ────────────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─── fetchModels ─────────────────────────────────────────

describe("fetchModels", () => {
  it("returns mapped ModelSpec array on success", async () => {
    mockFetchOk({
      models: [
        { id: "claude-opus-4-6", displayName: "Claude Opus 4.6", contextWindow: 200000, maxOutput: 4096 },
        { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5", contextWindow: 200000, maxOutput: 8192 },
      ],
    });

    const result = await fetchModels();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/models");
    expect(result).toEqual([
      { id: "claude-opus-4-6", label: "Claude Opus 4.6", contextWindow: 200000, maxOutput: 4096 },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", contextWindow: 200000, maxOutput: 8192 },
    ]);
  });

  it("returns empty array when API returns no models", async () => {
    mockFetchOk({ models: [] });

    const result = await fetchModels();

    expect(result).toEqual([]);
  });

  it("throws on non-ok response", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(fetchModels()).rejects.toThrow("Failed to fetch models");
  });
});

// ─── generate ────────────────────────────────────────────

describe("generate", () => {
  it("sends correct request body and returns response", async () => {
    const payload = makePayload();
    const responseBody: GenerateResponse = {
      text: "Once upon a time.",
      usage: { input_tokens: 42, output_tokens: 7 },
      stopReason: "end_turn",
    };
    mockFetchOk(responseBody);

    const result = await generate(payload);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: payload.systemMessage,
        userMessage: payload.userMessage,
        temperature: payload.temperature,
        topP: payload.topP,
        maxTokens: payload.maxTokens,
        model: payload.model,
      }),
    });
    expect(result).toEqual(responseBody);
  });

  it("includes outputSchema when present in payload", async () => {
    const schema = { type: "object", properties: { scene: { type: "string" } } };
    const payload = makePayload({ outputSchema: schema });
    mockFetchOk({ text: "ok", usage: { input_tokens: 1, output_tokens: 1 }, stopReason: "end_turn" });

    await generate(payload);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody.outputSchema).toEqual(schema);
  });

  it("omits outputSchema when not present in payload", async () => {
    const payload = makePayload();
    mockFetchOk({ text: "ok", usage: { input_tokens: 1, output_tokens: 1 }, stopReason: "end_turn" });

    await generate(payload);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody).not.toHaveProperty("outputSchema");
  });

  it("throws with error body on non-ok response", async () => {
    const payload = makePayload();
    mockFetchError(400, "Bad Request", { error: "Invalid model" });

    await expect(generate(payload)).rejects.toThrow("Generation failed: Invalid model");
  });

  it("falls back to statusText when error JSON parse fails", async () => {
    const payload = makePayload();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: () => Promise.reject(new Error("not json")),
      body: null,
    });

    await expect(generate(payload)).rejects.toThrow("Generation failed: Bad Gateway");
  });
});

// ─── callLLM ─────────────────────────────────────────────

describe("callLLM", () => {
  it("constructs payload and returns text", async () => {
    mockFetchOk({
      text: "The answer is 42.",
      usage: { input_tokens: 10, output_tokens: 5 },
      stopReason: "end_turn",
    });

    const result = await callLLM("System prompt", "User message", "claude-opus-4-6", 512);

    expect(result).toBe("The answer is 42.");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody.temperature).toBe(0);
    expect(sentBody.topP).toBe(1);
    expect(sentBody.maxTokens).toBe(512);
    expect(sentBody.model).toBe("claude-opus-4-6");
    expect(sentBody.systemMessage).toBe("System prompt");
    expect(sentBody.userMessage).toBe("User message");
  });

  it("passes outputSchema when provided", async () => {
    const schema = { type: "object" };
    mockFetchOk({
      text: '{"result": true}',
      usage: { input_tokens: 5, output_tokens: 3 },
      stopReason: "end_turn",
    });

    await callLLM("sys", "user", "claude-opus-4-6", 256, schema);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody.outputSchema).toEqual(schema);
  });

  it("omits outputSchema when not provided", async () => {
    mockFetchOk({
      text: "text",
      usage: { input_tokens: 1, output_tokens: 1 },
      stopReason: "end_turn",
    });

    await callLLM("sys", "user", "model", 100);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody).not.toHaveProperty("outputSchema");
  });

  it("propagates generate errors", async () => {
    mockFetchError(500, "Server Error", { error: "out of memory" });

    await expect(callLLM("sys", "user", "model", 100)).rejects.toThrow("Generation failed: out of memory");
  });
});

// ─── generateStream ──────────────────────────────────────

describe("generateStream", () => {
  it("sends correct request body to stream endpoint", async () => {
    const payload = makePayload();
    mockFetchStream(['data: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n']);

    const cb = makeCallbacks();
    await generateStream(payload, cb);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: payload.systemMessage,
        userMessage: payload.userMessage,
        temperature: payload.temperature,
        topP: payload.topP,
        maxTokens: payload.maxTokens,
        model: payload.model,
      }),
    });
  });

  it("does not include outputSchema in stream request", async () => {
    const payload = makePayload({ outputSchema: { type: "object" } });
    mockFetchStream(['data: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n']);

    const cb = makeCallbacks();
    await generateStream(payload, cb);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const sentBody = JSON.parse(callArgs[1].body as string);
    expect(sentBody).not.toHaveProperty("outputSchema");
  });

  // ─── SSE event parsing ───────────────────────────────

  describe("SSE delta events", () => {
    it("calls onToken for each delta event", async () => {
      mockFetchStream([
        'data: {"type":"delta","text":"Hello "}\n',
        'data: {"type":"delta","text":"world"}\n',
        'data: {"type":"done","usage":{"input_tokens":5,"output_tokens":2},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onToken).toHaveBeenCalledTimes(2);
      expect(cb.tokens).toEqual(["Hello ", "world"]);
    });
  });

  describe("SSE done events", () => {
    it("calls onDone with usage and stopReason", async () => {
      mockFetchStream([
        'data: {"type":"done","usage":{"input_tokens":100,"output_tokens":50},"stopReason":"max_tokens"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onDone).toHaveBeenCalledTimes(1);
      expect(cb.doneArgs[0]).toEqual({
        usage: { input_tokens: 100, output_tokens: 50 },
        stopReason: "max_tokens",
      });
    });
  });

  describe("SSE error events", () => {
    it("calls onError for error events", async () => {
      mockFetchStream(['data: {"type":"error","error":"Rate limit exceeded"}\n']);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onError).toHaveBeenCalledTimes(1);
      expect(cb.errors).toEqual(["Rate limit exceeded"]);
    });
  });

  describe("SSE line parsing edge cases", () => {
    it("ignores lines that do not start with 'data: '", async () => {
      mockFetchStream([
        ": keepalive\n",
        "event: message\n",
        'data: {"type":"delta","text":"ok"}\n',
        "\n",
        'data: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onToken).toHaveBeenCalledTimes(1);
      expect(cb.tokens).toEqual(["ok"]);
    });

    it("ignores malformed JSON in SSE data lines", async () => {
      mockFetchStream([
        "data: {not valid json\n",
        'data: {"type":"delta","text":"after-malformed"}\n',
        'data: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      // The malformed line should be silently skipped
      expect(cb.onToken).toHaveBeenCalledTimes(1);
      expect(cb.tokens).toEqual(["after-malformed"]);
    });

    it("ignores empty lines", async () => {
      mockFetchStream([
        "\n",
        "\n",
        'data: {"type":"delta","text":"text"}\n',
        "\n",
        'data: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("buffered / incomplete lines", () => {
    it("handles data split across multiple chunks", async () => {
      // The SSE line is split across two chunks: first chunk has partial line, second completes it
      mockFetchStream([
        'data: {"type":"del',
        'ta","text":"split"}\ndata: {"type":"done","usage":{"input_tokens":1,"output_tokens":1},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onToken).toHaveBeenCalledTimes(1);
      expect(cb.tokens).toEqual(["split"]);
      expect(cb.onDone).toHaveBeenCalledTimes(1);
    });

    it("handles multiple events in a single chunk", async () => {
      const combined = [
        'data: {"type":"delta","text":"a"}',
        'data: {"type":"delta","text":"b"}',
        'data: {"type":"delta","text":"c"}',
        'data: {"type":"done","usage":{"input_tokens":3,"output_tokens":3},"stopReason":"end_turn"}',
        "",
      ].join("\n");

      mockFetchStream([combined]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.onToken).toHaveBeenCalledTimes(3);
      expect(cb.tokens).toEqual(["a", "b", "c"]);
      expect(cb.onDone).toHaveBeenCalledTimes(1);
    });

    it("handles trailing incomplete line that never completes", async () => {
      // The last chunk ends with an incomplete line (no newline) which stays in buffer
      mockFetchStream(['data: {"type":"delta","text":"ok"}\ndata: {"type":"incompl']);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      // "ok" is processed, but the incomplete line is left in buffer and never parsed
      expect(cb.onToken).toHaveBeenCalledTimes(1);
      expect(cb.tokens).toEqual(["ok"]);
    });
  });

  // ─── Error paths ─────────────────────────────────────

  describe("error paths", () => {
    it("throws on non-ok response with error body", async () => {
      mockFetchError(500, "Internal Server Error", { error: "Model overloaded" });

      const cb = makeCallbacks();
      await expect(generateStream(makePayload(), cb)).rejects.toThrow("Generation failed: Model overloaded");
    });

    it("falls back to statusText when error JSON parse fails", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: () => Promise.reject(new Error("no json body")),
        body: null,
      });

      const cb = makeCallbacks();
      await expect(generateStream(makePayload(), cb)).rejects.toThrow("Generation failed: Service Unavailable");
    });

    it("throws when response body is null", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        body: null,
      });

      const cb = makeCallbacks();
      await expect(generateStream(makePayload(), cb)).rejects.toThrow("No response body");
    });

    it("throws when response body is undefined", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        body: undefined,
      });

      const cb = makeCallbacks();
      await expect(generateStream(makePayload(), cb)).rejects.toThrow("No response body");
    });
  });

  // ─── Full streaming scenario ─────────────────────────

  describe("full scenario", () => {
    it("processes a realistic multi-chunk stream", async () => {
      mockFetchStream([
        'data: {"type":"delta","text":"The "}\ndata: {"type":"delta","text":"cat "}\n',
        'data: {"type":"delta","text":"sat "}\n',
        'data: {"type":"delta","text":"on the mat."}\n',
        'data: {"type":"done","usage":{"input_tokens":20,"output_tokens":6},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.tokens).toEqual(["The ", "cat ", "sat ", "on the mat."]);
      expect(cb.onDone).toHaveBeenCalledWith({ input_tokens: 20, output_tokens: 6 }, "end_turn");
      expect(cb.onError).not.toHaveBeenCalled();
    });

    it("handles interleaved error and delta events", async () => {
      mockFetchStream([
        'data: {"type":"delta","text":"start"}\n',
        'data: {"type":"error","error":"transient failure"}\n',
        'data: {"type":"delta","text":"resume"}\n',
        'data: {"type":"done","usage":{"input_tokens":10,"output_tokens":2},"stopReason":"end_turn"}\n',
      ]);

      const cb = makeCallbacks();
      await generateStream(makePayload(), cb);

      expect(cb.tokens).toEqual(["start", "resume"]);
      expect(cb.errors).toEqual(["transient failure"]);
      expect(cb.onDone).toHaveBeenCalledTimes(1);
    });
  });
});
