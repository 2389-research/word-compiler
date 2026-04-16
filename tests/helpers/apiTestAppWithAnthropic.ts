// TODO(#36/A follow-up): If Package A lands and adds runMigrations(db) to
// apiTestApp.ts schema boot, mirror that call here.
import Database from "better-sqlite3";
import express from "express";
import { createApiRouter } from "../../server/api/routes.js";
import { createSchema } from "../../server/db/schema.js";

/**
 * Minimal Anthropic client stub accepted by server/api/routes.ts.
 *
 * The route code only checks `anthropicClient` for truthiness before
 * delegating to server/profile/* functions. Those functions are mocked
 * at the test-file level via vi.mock(), so this object never actually
 * receives a call — it only needs to exist and be typed loosely.
 */
export function makeAnthropicStub(): unknown {
  return {
    // Shape is irrelevant; real calls are vi.mocked at the importer.
    messages: { create: async () => ({}) },
  };
}

export function makeApiTestAppWithAnthropic() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);

  const app = express();
  app.use(express.json());
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  app.use("/api", createApiRouter(db, makeAnthropicStub() as any));

  return { app, db };
}
