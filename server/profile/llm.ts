import type Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MAX_TOKENS = 16384;

/**
 * Make an LLM call expecting a structured JSON response.
 * Uses Anthropic tool_use: defines a tool with the given schema,
 * forces tool use, extracts the input object.
 */
export async function structuredCall<T>(
  client: Anthropic,
  model: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  schemaName: string,
): Promise<T> {
  const response = await client.messages.create({
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
    tools: [
      {
        name: schemaName,
        description: `Output structured data as ${schemaName}`,
        input_schema: schema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: schemaName },
  });

  console.log(`[llm] ${schemaName}: ${response.usage?.output_tokens} output tokens used`);
  if (response.stop_reason === "max_tokens") {
    console.warn(`[llm] WARNING: Response truncated at max_tokens for ${schemaName}`);
  }

  const toolBlock = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolBlock) {
    throw new Error(`No tool_use block in response for schema "${schemaName}"`);
  }
  return toolBlock.input as T;
}

/**
 * Make an LLM call expecting a plain text response.
 */
export async function textCall(client: Anthropic, model: string, system: string, user: string): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock) {
    throw new Error("No text block in response");
  }
  return textBlock.text;
}

/**
 * Run multiple structured calls with a concurrency limit.
 * Uses a simple Promise-based semaphore (no external deps).
 */
export async function parallelStructuredCalls<T>(
  calls: Array<{
    model: string;
    system: string;
    user: string;
    schema: Record<string, unknown>;
    schemaName: string;
  }>,
  client: Anthropic,
  semaphoreLimit = 5,
): Promise<T[]> {
  let active = 0;
  const queue: Array<() => void> = [];

  function acquire(): Promise<void> {
    if (active < semaphoreLimit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(resolve);
    });
  }

  function release(): void {
    const next = queue.shift();
    if (next) {
      next();
    } else {
      active--;
    }
  }

  const tasks = calls.map(async (call) => {
    await acquire();
    try {
      return await structuredCall<T>(client, call.model, call.system, call.user, call.schema, call.schemaName);
    } finally {
      release();
    }
  });

  return Promise.all(tasks);
}
