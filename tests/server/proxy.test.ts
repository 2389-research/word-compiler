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
});
