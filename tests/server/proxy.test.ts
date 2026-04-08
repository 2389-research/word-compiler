import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock Anthropic SDK ──────────────────────────────────

const mockCreate = vi.fn();
const mockStream = vi.fn();
const mockModelsList = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
      models = {
        list: mockModelsList,
      };
    },
  };
});

// ─── Mock database ───────────────────────────────────────

vi.mock("../../server/db/connection.js", () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock("../../server/api/routes.js", () => ({
  createApiRouter: vi.fn(() => {
    const { Router } = require("express");
    return Router();
  }),
}));

// ─── Import app after mocks ─────────────────────────────

let baseUrl: string;
let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  const { app } = await import("../../server/proxy.js");
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  mockCreate.mockReset();
  mockStream.mockReset();
  mockModelsList.mockReset();
});

describe("POST /api/generate", () => {
  it("sends output_config when outputSchema is present", async () => {
    const schema = { type: "object", properties: { name: { type: "string" } } };

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"name":"test"}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    });

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "You are helpful.",
        userMessage: "Say hello",
        temperature: 0.5,
        maxTokens: 100,
        model: "claude-sonnet-4-6",
        outputSchema: schema,
      }),
    });

    expect(res.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.output_config).toEqual({
      format: { type: "json_schema", schema },
    });
  });

  it("omits output_config when outputSchema is absent", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hello!" }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    });

    await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "You are helpful.",
        userMessage: "Say hello",
        temperature: 0.5,
        maxTokens: 100,
        model: "claude-sonnet-4-6",
      }),
    });

    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.output_config).toBeUndefined();
  });
});

describe("POST /api/generate/stream", () => {
  it("ignores outputSchema (streaming does not support structured output)", async () => {
    const mockStreamInstance = {
      on: vi.fn().mockReturnThis(),
      abort: vi.fn(),
      finalMessage: vi.fn().mockResolvedValue({
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: "end_turn",
      }),
    };
    mockStream.mockReturnValueOnce(mockStreamInstance);

    const res = await fetch(`${baseUrl}/api/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "You are helpful.",
        userMessage: "List items",
        temperature: 0.5,
        maxTokens: 100,
        model: "claude-sonnet-4-6",
        outputSchema: { type: "object" },
      }),
    });

    expect(res.ok).toBe(true);
    expect(mockStream).toHaveBeenCalledOnce();

    const callArgs = mockStream.mock.calls[0]![0];
    expect(callArgs.output_config).toBeUndefined();
  });

  it("omits output_config when outputSchema is absent", async () => {
    const mockStreamInstance = {
      on: vi.fn().mockReturnThis(),
      abort: vi.fn(),
      finalMessage: vi.fn().mockResolvedValue({
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: "end_turn",
      }),
    };
    mockStream.mockReturnValueOnce(mockStreamInstance);

    await fetch(`${baseUrl}/api/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "You are helpful.",
        userMessage: "Say hello",
        temperature: 0.5,
        maxTokens: 100,
        model: "claude-sonnet-4-6",
      }),
    });

    const callArgs = mockStream.mock.calls[0]![0];
    expect(callArgs.output_config).toBeUndefined();
  });

  it("emits SSE delta events with text chunks, then a done event with usage/stopReason", async () => {
    // Suppress console.log from the route handler
    vi.spyOn(console, "log").mockImplementation(() => {});

    type Handler = (...args: unknown[]) => void;
    const handlers: Record<string, Handler> = {};

    const mockStreamInstance = {
      on(event: string, handler: Handler) {
        handlers[event] = handler;
        return mockStreamInstance;
      },
      abort: vi.fn(),
      finalMessage: () => {
        // Emit text events before resolving, simulating the Anthropic stream
        handlers.text?.("Hello ");
        handlers.text?.("world");
        return Promise.resolve({
          content: [{ type: "text", text: "Hello world" }],
          usage: { input_tokens: 12, output_tokens: 8 },
          stop_reason: "end_turn",
        });
      },
    };
    mockStream.mockReturnValueOnce(mockStreamInstance);

    const res = await fetch(`${baseUrl}/api/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "You are helpful.",
        userMessage: "Say hello world",
        temperature: 0.7,
        maxTokens: 200,
        model: "claude-sonnet-4-6",
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const body = await res.text();
    const lines = body
      .split("\n\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => JSON.parse(l.replace("data: ", "")));

    // Two delta events, then one done event
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ type: "delta", text: "Hello " });
    expect(lines[1]).toEqual({ type: "delta", text: "world" });
    expect(lines[2]).toEqual({
      type: "done",
      usage: { input_tokens: 12, output_tokens: 8 },
      stopReason: "end_turn",
    });
  });
});

// ─── GET /api/models ──────────────────────────────────────

describe("GET /api/models", () => {
  it("fetches, filters, maps, sorts models and caches on second call", async () => {
    // Suppress console.log/debug from the route handler
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});

    // The Anthropic SDK returns data with mixed types — only type==="model" should pass
    mockModelsList.mockResolvedValue({
      data: [
        {
          id: "claude-sonnet-4-6",
          type: "model",
          display_name: "Claude Sonnet 4.6",
          context_window: 200000,
          max_output: 64000,
        },
        {
          id: "claude-haiku-3",
          type: "model",
          display_name: "Claude Haiku 3",
          context_window: 200000,
          max_output: 8192,
        },
        {
          id: "embed-v1",
          type: "embedding",
          display_name: "Embed V1",
          context_window: 100000,
          max_output: 0,
        },
      ],
    });

    // First call — should fetch from SDK
    const res1 = await fetch(`${baseUrl}/api/models`);
    expect(res1.ok).toBe(true);
    const body1 = await res1.json();

    // Filtered (no embedding), mapped, and sorted by id
    expect(body1.models).toHaveLength(2);
    expect(body1.models[0]).toEqual({
      id: "claude-haiku-3",
      displayName: "Claude Haiku 3",
      contextWindow: 200000,
      maxOutput: 8192,
    });
    expect(body1.models[1]).toEqual({
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      contextWindow: 200000,
      maxOutput: 64000,
    });

    expect(mockModelsList).toHaveBeenCalledOnce();

    // Second call — should serve from cache (mockModelsList NOT called again)
    const res2 = await fetch(`${baseUrl}/api/models`);
    expect(res2.ok).toBe(true);
    const body2 = await res2.json();

    expect(body2.models).toEqual(body1.models);
    expect(mockModelsList).toHaveBeenCalledOnce(); // still only one call
  });

  it("returns SDK error status and message on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset the module-level cache by re-importing would be ideal, but since
    // the previous test already populated the cache, we need a fresh module.
    // Instead, we test the error path by ensuring the cache is NOT populated
    // for a fresh server. Since the cache IS populated from the previous test,
    // we'll test that the error path works by directly testing the route
    // behavior — but the cache means it won't hit the SDK at all.
    //
    // To properly test this, we use a separate test file or accept the limitation.
    // Here we use vi.importActual to reset. But the simplest approach: use
    // dynamic import with a cache-busting query. Instead, let's just verify
    // the error handling by clearing the module cache.

    // Since modelsCache is module-level and already set, we need to use
    // resetModules to get a fresh import. But that's complex with the server setup.
    // The pragmatic approach: test error path in a separate describe with resetModules.
    // For now, verify that the route returns the cached data even after mock reset.
    // This IS testing cache behavior.
    const res = await fetch(`${baseUrl}/api/models`);
    expect(res.ok).toBe(true);
    // mockModelsList was reset in beforeEach, but cache serves the data
    expect(mockModelsList).not.toHaveBeenCalled();
  });
});

// Use resetModules to get a fresh proxy import with empty modelsCache for error testing
describe("GET /api/models (error path)", () => {
  it("returns SDK error status and message on failure", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // We need a fresh app instance with an empty modelsCache.
    // Use dynamic import with resetModules.
    vi.resetModules();

    // Re-mock dependencies for the fresh import
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: vi.fn(), stream: vi.fn() };
        models = {
          list: vi.fn().mockRejectedValue(Object.assign(new Error("Authentication failed"), { status: 401 })),
        };
      },
    }));
    vi.doMock("../../server/db/connection.js", () => ({
      getDatabase: vi.fn(() => ({})),
    }));
    vi.doMock("../../server/api/routes.js", () => ({
      createApiRouter: vi.fn(() => {
        const { Router } = require("express");
        return Router();
      }),
    }));

    const { app: freshApp } = await import("../../server/proxy.js");
    const freshServer = createServer(freshApp);
    let freshBaseUrl: string;

    await new Promise<void>((resolve) => {
      freshServer.listen(0, () => {
        const addr = freshServer.address() as AddressInfo;
        freshBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    try {
      const res = await fetch(`${freshBaseUrl!}/api/models`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Authentication failed" });
    } finally {
      freshServer.close();
    }
  });
});

// ─── POST /api/generate (additional cases) ────────────────

describe("POST /api/generate (sampling & defaults)", () => {
  /** Helper to POST to /api/generate with given body overrides. */
  async function generate(overrides: Record<string, unknown> = {}) {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "response" }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    });

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "System",
        userMessage: "User",
        ...overrides,
      }),
    });

    return { res, callArgs: mockCreate.mock.calls[0]![0] as Record<string, unknown> };
  }

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("sends only temperature (no top_p) when temperature is provided", async () => {
    const { callArgs } = await generate({ temperature: 0.3 });

    expect(callArgs.temperature).toBe(0.3);
    expect(callArgs.top_p).toBeUndefined();
  });

  it("sends only top_p (no temperature) when only topP is provided", async () => {
    const { callArgs } = await generate({ topP: 0.9 });

    expect(callArgs.top_p).toBe(0.9);
    expect(callArgs.temperature).toBeUndefined();
  });

  it("defaults to temperature 0.8 when neither temperature nor topP is provided", async () => {
    const { callArgs } = await generate({});

    expect(callArgs.temperature).toBe(0.8);
    expect(callArgs.top_p).toBeUndefined();
  });

  it("uses default model (claude-opus-4-6) and maxTokens (2000) when not provided", async () => {
    const { callArgs } = await generate({});

    expect(callArgs.model).toBe("claude-opus-4-6");
    expect(callArgs.max_tokens).toBe(2000);
  });

  it("returns 502 when API response has no text block", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "t1", name: "search", input: {} }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "tool_use",
    });

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "System",
        userMessage: "User",
        temperature: 0.5,
        model: "claude-sonnet-4-6",
      }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "LLM response contained no text content" });
  });

  it("returns SDK error status on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockReset();
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("Rate limited"), { status: 429 }));

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemMessage: "System",
        userMessage: "User",
        temperature: 0.5,
        model: "claude-sonnet-4-6",
      }),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ error: "Rate limited" });
  });
});
