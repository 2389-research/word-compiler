import Database from "better-sqlite3";
import express from "express";
import { createApiRouter } from "../../server/api/routes.js";
import { createSchema } from "../../server/db/schema.js";

export function makeApiTestApp() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createSchema(db);

  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(db));

  return { app, db };
}
