import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";
import { unwrap } from "../../helpers/unwrap.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  silenceConsole();
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("POST /api/writing-samples", () => {
  it("creates a writing sample and returns 201 with the persisted row", async () => {
    const res = await request(app)
      .post("/api/writing-samples")
      .send({ filename: "story.md", domain: "fiction", text: "One two three four." });

    expect(res.status).toBe(201);
    const body = unwrap<{ id: string; domain: string; filename: string; wordCount: number }>(res);
    expect(body.id).toBeDefined();
    expect(body.domain).toBe("fiction");
    expect(body.filename).toBe("story.md");
    // Known input "One two three four." -> 4 words.
    expect(body.wordCount).toBe(4);

    const stored = writingSampleRepo.listWritingSamples(db);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(body.id);
  });

  it("accepts a missing filename (defaults to null)", async () => {
    const res = await request(app)
      .post("/api/writing-samples")
      .send({ domain: "nonfiction", text: "A body of text." });

    expect(res.status).toBe(201);
    const body = unwrap<{ filename: string | null }>(res);
    expect(body.filename).toBeNull();
  });
});
