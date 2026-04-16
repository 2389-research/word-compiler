import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeWritingSample } from "../../helpers/serverFactories.js";
import { silenceConsole } from "../../helpers/silenceConsole.js";

let app: ReturnType<typeof makeApiTestApp>["app"];
let db: ReturnType<typeof makeApiTestApp>["db"];

beforeEach(() => {
  silenceConsole();
  const testApp = makeApiTestApp();
  app = testApp.app;
  db = testApp.db;
});

describe("DELETE /api/writing-samples/:id", () => {
  it("returns 204 and removes the sample on success", async () => {
    const sample = makeWritingSample({ id: "to-delete" });
    writingSampleRepo.createWritingSampleRecord(db, sample);

    const res = await request(app).delete("/api/writing-samples/to-delete");
    expect(res.status).toBe(204);
    // RFC 7230: 204 responses MUST have an empty body.
    expect(res.text).toBe("");
    expect(writingSampleRepo.getWritingSample(db, "to-delete")).toBeNull();
  });

  it("returns 404 when the sample does not exist", async () => {
    const res = await request(app).delete("/api/writing-samples/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});
