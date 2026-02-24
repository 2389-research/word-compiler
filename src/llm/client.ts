import type { CompiledPayload, ModelSpec } from "../types/index.js";

export interface GenerateResponse {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  stopReason: string;
}

export async function fetchModels(): Promise<ModelSpec[]> {
  const response = await fetch("/api/models");
  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }
  const data = (await response.json()) as {
    models: Array<{ id: string; displayName: string; contextWindow: number; maxOutput: number }>;
  };
  return data.models.map((m) => ({
    id: m.id,
    label: m.displayName,
    contextWindow: m.contextWindow,
    maxOutput: m.maxOutput,
  }));
}

export async function generate(payload: CompiledPayload): Promise<GenerateResponse> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemMessage: payload.systemMessage,
      userMessage: payload.userMessage,
      temperature: payload.temperature,
      topP: payload.topP,
      maxTokens: payload.maxTokens,
      model: payload.model,
      ...(payload.outputSchema && { outputSchema: payload.outputSchema }),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Generation failed: ${(err as { error: string }).error}`);
  }

  return response.json() as Promise<GenerateResponse>;
}

export async function callLLM(
  systemMessage: string,
  userMessage: string,
  model: string,
  maxTokens: number,
  outputSchema?: Record<string, unknown>,
): Promise<string> {
  const payload: CompiledPayload = {
    systemMessage,
    userMessage,
    temperature: 0,
    topP: 1,
    maxTokens,
    model,
    ...(outputSchema && { outputSchema }),
  };
  const result = await generate(payload);
  return result.text;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (usage: { input_tokens: number; output_tokens: number }, stopReason: string) => void;
  onError: (error: string) => void;
}

type SSEEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: { input_tokens: number; output_tokens: number }; stopReason: string }
  | { type: "error"; error: string };

function parseSSELine(line: string, callbacks: StreamCallbacks): void {
  if (!line.startsWith("data: ")) return;
  const json = line.slice(6);
  try {
    const event = JSON.parse(json) as SSEEvent;
    if (event.type === "delta") {
      callbacks.onToken(event.text);
    } else if (event.type === "done") {
      callbacks.onDone(event.usage, event.stopReason);
    } else if (event.type === "error") {
      callbacks.onError(event.error);
    }
  } catch {
    // skip malformed SSE line
  }
}

export async function generateStream(payload: CompiledPayload, callbacks: StreamCallbacks): Promise<void> {
  const response = await fetch("/api/generate/stream", {
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

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Generation failed: ${(err as { error: string }).error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete line in buffer

    for (const line of lines) {
      parseSSELine(line, callbacks);
    }
  }
}
