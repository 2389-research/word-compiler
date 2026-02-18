import { describe, it, expect } from "vitest";

// The API client is a thin fetch wrapper — its correctness is tested via
// integration tests against the live server (Step 10). Here we validate
// that the module structure is sound and exports the expected functions.

import * as api from "../../src/api/client.js";

describe("api/client module exports", () => {
  it("exports project functions", () => {
    expect(typeof api.apiListProjects).toBe("function");
    expect(typeof api.apiGetProject).toBe("function");
    expect(typeof api.apiCreateProject).toBe("function");
    expect(typeof api.apiUpdateProject).toBe("function");
  });

  it("exports bible functions", () => {
    expect(typeof api.apiGetLatestBible).toBe("function");
    expect(typeof api.apiGetBibleVersion).toBe("function");
    expect(typeof api.apiListBibleVersions).toBe("function");
    expect(typeof api.apiSaveBible).toBe("function");
  });

  it("exports chapter arc functions", () => {
    expect(typeof api.apiListChapterArcs).toBe("function");
    expect(typeof api.apiGetChapterArc).toBe("function");
    expect(typeof api.apiSaveChapterArc).toBe("function");
    expect(typeof api.apiUpdateChapterArc).toBe("function");
  });

  it("exports scene plan functions", () => {
    expect(typeof api.apiListScenePlans).toBe("function");
    expect(typeof api.apiGetScenePlan).toBe("function");
    expect(typeof api.apiSaveScenePlan).toBe("function");
    expect(typeof api.apiUpdateScenePlan).toBe("function");
    expect(typeof api.apiUpdateSceneStatus).toBe("function");
  });

  it("exports chunk functions", () => {
    expect(typeof api.apiListChunks).toBe("function");
    expect(typeof api.apiSaveChunk).toBe("function");
    expect(typeof api.apiUpdateChunk).toBe("function");
  });

  it("exports audit flag functions", () => {
    expect(typeof api.apiListAuditFlags).toBe("function");
    expect(typeof api.apiSaveAuditFlags).toBe("function");
    expect(typeof api.apiResolveAuditFlag).toBe("function");
    expect(typeof api.apiGetAuditStats).toBe("function");
  });

  it("exports compilation log functions", () => {
    expect(typeof api.apiSaveCompilationLog).toBe("function");
  });
});
