import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import * as writingSampleRepo from "../../../server/db/repositories/writing-samples.js";
import { makeApiTestApp } from "../../helpers/apiTestApp.js";
import { makeWritingSample } from "../../helpers/serverFactories.js";
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

describe("GET /api/writing-samples", () => {
  it("returns [] when no samples exist", async () => {
    const res = await request(app).get("/api/writing-samples");
    expect(res.status).toBe(200);
    const body = unwrap<unknown[]>(res);
    expect(body).toEqual([]);
  });

  it("lists stored writing samples", async () => {
    const sample = makeWritingSample({ id: "s1" });
    writingSampleRepo.createWritingSampleRecord(db, sample);

    const res = await request(app).get("/api/writing-samples");
    expect(res.status).toBe(200);
    const body = unwrap<Array<{ id: string }>>(res);
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe("s1");
  });
});
