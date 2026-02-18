import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { getDatabase } from "./db/connection.js";
import { createApiRouter } from "./api/routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database and mount REST API
const db = getDatabase();
app.use("/api/data", createApiRouter(db));

const client = new Anthropic();

// Cache models list — it doesn't change during a session
let modelsCache: Array<{ id: string; displayName: string; contextWindow: number; maxOutput: number }> | null = null;

app.get("/api/models", async (_req, res) => {
  try {
    if (modelsCache) {
      res.json({ models: modelsCache });
      return;
    }

    const response = await client.models.list({ limit: 100 });
    const models = response.data
      .filter((m: { type: string }) => m.type === "model")
      .map((m: any) => ({
        id: m.id,
        displayName: m.display_name ?? m.id,
        contextWindow: m.context_window ?? 200000,
        maxOutput: m.max_output ?? 64000,
      }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

    modelsCache = models;
    res.json({ models });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(status).json({ error: message });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { systemMessage, userMessage, temperature, topP, maxTokens, model } = req.body;

    // Anthropic API forbids sending both temperature and top_p together.
    // Prefer temperature; only use top_p when temperature is absent.
    const samplingParams: { temperature?: number; top_p?: number } =
      temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

    const response = await client.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens || 2000,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    res.json({
      text: textBlock ? (textBlock as { text: string }).text : "",
      usage: response.usage,
      stopReason: response.stop_reason,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(status).json({ error: message });
  }
});

// Streaming endpoint — SSE
app.post("/api/generate/stream", async (req, res) => {
  const { systemMessage, userMessage, temperature, topP, maxTokens, model } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const samplingParams: { temperature?: number; top_p?: number } =
    temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

  try {
    const stream = client.messages.stream({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens || 2000,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
    });

    stream.on("text", (text: string) => {
      res.write(`data: ${JSON.stringify({ type: "delta", text })}\n\n`);
    });

    stream.on("error", (err: Error) => {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      res.end();
    });

    const finalMessage = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({
      type: "done",
      usage: finalMessage.usage,
      stopReason: finalMessage.stop_reason,
    })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
});
