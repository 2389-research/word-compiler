import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express from "express";
import { DEFAULT_MODEL } from "../src/types/metadata.js";
import { createApiRouter } from "./api/routes.js";
import { getDatabase } from "./db/connection.js";
import { errorHandler, requestLogger } from "./middleware.js";

const app = express();
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || DEFAULT_ORIGINS,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(requestLogger);

const client = new Anthropic({
  baseURL: process.env.LLM_BASE_URL || "https://api.anthropic.com",
  apiKey: process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "",
});

// Initialize database and mount REST API
const db = getDatabase();
app.use("/api/data", createApiRouter(db, client));

// Cache models list — it doesn't change during a session
let modelsCache: Array<{ id: string; displayName: string; contextWindow: number; maxOutput: number }> | null = null;

app.get("/api/models", async (_req, res) => {
  try {
    if (modelsCache) {
      console.debug(`[models] Serving ${modelsCache.length} models from cache`);
      res.json({ models: modelsCache });
      return;
    }
    console.log("[models] Fetching models list");

    let models: Array<{ id: string; displayName: string; contextWindow: number; maxOutput: number }>;
    try {
      const response = await client.models.list({ limit: 100 });
      models = response.data
        .filter((m: { type: string }) => m.type === "model")
        .map((m: any) => ({
          id: m.id,
          displayName: m.display_name ?? m.id,
          contextWindow: m.context_window ?? 200000,
          maxOutput: m.max_output ?? 64000,
        }))
        .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
    } catch {
      // Non-Anthropic backends (OpenRouter, etc.) may not support models.list.
      models = [];
    }

    // Fall back to built-in registry if API returned nothing useful
    if (models.length === 0) {
      const { MODEL_REGISTRY } = await import("../src/types/metadata.js");
      models = Object.values(MODEL_REGISTRY).map((m) => ({
        id: m.id,
        displayName: m.label,
        contextWindow: m.contextWindow,
        maxOutput: m.maxOutput,
      }));
      console.log(`[models] Using ${models.length} built-in models`);
    }

    modelsCache = models;
    console.log(`[models] Cached ${models.length} models`);
    res.json({ models });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[models] Error: ${message}`);
    res.status(status).json({ error: message });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { systemMessage, userMessage, temperature, topP, maxTokens, model, outputSchema } = req.body;

    const effectiveModel = model || DEFAULT_MODEL;
    const effectiveMaxTokens = maxTokens || 2000;
    console.log(`[generate] Starting: model=${effectiveModel}, max_tokens=${effectiveMaxTokens}`);

    // Anthropic API forbids sending both temperature and top_p together.
    // Prefer temperature; only use top_p when temperature is absent.
    const samplingParams: { temperature?: number; top_p?: number } =
      temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

    const response = await client.messages.create({
      model: effectiveModel,
      max_tokens: effectiveMaxTokens,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
      ...(outputSchema && {
        output_config: { format: { type: "json_schema" as const, schema: outputSchema } },
      }),
    });

    const contentTypes = response.content.map((b: { type: string }) => b.type);
    console.log(
      `[generate] Complete: stop_reason=${response.stop_reason}, ` +
        `content_types=[${contentTypes.join(",")}], usage=${JSON.stringify(response.usage)}`,
    );

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) {
      console.warn(
        `[generate] WARNING: No text block in response. content=${JSON.stringify(response.content).slice(0, 500)}`,
      );
      res.status(502).json({ error: "LLM response contained no text content" });
      return;
    }
    res.json({
      text: (textBlock as { text: string }).text,
      usage: response.usage,
      stopReason: response.stop_reason,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[generate] Error: ${message}`);
    res.status(status).json({ error: message });
  }
});

// Streaming endpoint — SSE (does not support outputSchema; use /api/generate for structured output)
app.post("/api/generate/stream", async (req, res) => {
  const { systemMessage, userMessage, temperature, topP, maxTokens, model } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const samplingParams: { temperature?: number; top_p?: number } =
    temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

  function safeWrite(data: string) {
    if (!res.writableEnded && !res.destroyed) res.write(data);
  }
  function safeEnd() {
    if (!res.writableEnded && !res.destroyed) res.end();
  }

  try {
    const effectiveModel = model || DEFAULT_MODEL;
    const effectiveMaxTokens = maxTokens || 2000;
    console.log(`[stream] Starting generation: model=${effectiveModel}, max_tokens=${effectiveMaxTokens}`);

    const stream = client.messages.stream({
      model: effectiveModel,
      max_tokens: effectiveMaxTokens,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
    });

    // Abort the upstream Anthropic stream when the client disconnects.
    // Use res "close" (not req "close") — req emits close when the request
    // body is consumed, which for POST happens immediately. res emits close
    // when the SSE connection is actually torn down by the client.
    res.on("close", () => {
      if (!res.writableEnded) {
        console.warn(`[stream] Client disconnected, aborting upstream stream (${textLength} chars sent so far)`);
        stream.abort();
      }
    });

    let textLength = 0;
    stream.on("text", (text: string) => {
      textLength += text.length;
      safeWrite(`data: ${JSON.stringify({ type: "delta", text })}\n\n`);
    });

    stream.on("error", (err: Error) => {
      console.error(`[stream] Stream error: ${err.message}`);
      safeWrite(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      safeEnd();
    });

    const finalMessage = await stream.finalMessage();
    const contentTypes = finalMessage.content.map((b: { type: string }) => b.type);
    console.log(
      `[stream] Complete: stop_reason=${finalMessage.stop_reason}, ` +
        `text_chars=${textLength}, content_types=[${contentTypes.join(",")}], ` +
        `usage=${JSON.stringify(finalMessage.usage)}`,
    );

    if (textLength === 0) {
      console.warn(
        `[stream] WARNING: Zero text received from API. ` +
          `stop_reason=${finalMessage.stop_reason}, content=${JSON.stringify(finalMessage.content).slice(0, 500)}`,
      );
    }

    safeWrite(
      `data: ${JSON.stringify({
        type: "done",
        usage: finalMessage.usage,
        stopReason: finalMessage.stop_reason,
      })}\n\n`,
    );
    safeEnd();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[stream] Unhandled error: ${message}`);
    safeWrite(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    safeEnd();
  }
});

// Error handler must be registered after all routes
app.use(errorHandler);

export { app };

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";
if (process.env.NODE_ENV !== "test") {
  process.on("uncaughtException", (err) => {
    console.error("[fatal] Uncaught exception:", err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[fatal] Unhandled rejection:", reason);
    process.exit(1);
  });

  app.listen(Number(PORT), HOST, () => {
    const displayHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
    console.log(`Proxy listening on http://${displayHost}:${PORT}`);
  });
}
