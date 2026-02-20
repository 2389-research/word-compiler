import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { initializeApp } from "../../src/app/store/startup.js";
import { makeChapterArc, makeChunk } from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

describe("initializeApp", () => {
  let store: ProjectStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProjectStore();
  });

  it("loads single project with all data", async () => {
    const project = { id: "proj-1", title: "Novel", status: "drafting" as const, createdAt: "", updatedAt: "" };
    const bible = createEmptyBible("proj-1");
    const arc = makeChapterArc({ id: "ch-1", projectId: "proj-1" });
    const plan = createEmptyScenePlan("proj-1");
    plan.chapterId = "ch-1";
    const chunk = makeChunk({ sceneId: plan.id });

    mockedApi.apiListProjects.mockResolvedValue([project]);
    mockedApi.apiGetProject.mockResolvedValue(project);
    mockedApi.apiGetLatestBible.mockResolvedValue(bible);
    mockedApi.apiListBibleVersions.mockResolvedValue([{ version: 1, createdAt: "" }]);
    mockedApi.apiListChapterArcs.mockResolvedValue([arc]);
    mockedApi.apiListScenePlans.mockResolvedValue([{ plan, status: "drafting" as const, sceneOrder: 0 }]);
    mockedApi.apiListChunks.mockResolvedValue([chunk]);

    const result = await initializeApp(store);

    expect(result).toBe("loaded");
    expect(store.project).toEqual(project);
    expect(store.bible).toEqual(bible);
    expect(store.chapterArc).toEqual(arc);
    expect(store.scenes).toHaveLength(1);
    expect(store.sceneChunks[plan.id]).toHaveLength(1);
  });

  it("returns 'no-projects' when project list is empty", async () => {
    mockedApi.apiListProjects.mockResolvedValue([]);

    const result = await initializeApp(store);

    expect(result).toBe("no-projects");
    expect(store.project).toBeNull();
  });

  it("returns 'multiple-projects' when more than one project", async () => {
    const p1 = { id: "proj-1", title: "A", status: "drafting" as const, createdAt: "", updatedAt: "" };
    const p2 = { id: "proj-2", title: "B", status: "drafting" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue([p1, p2]);

    const result = await initializeApp(store);

    expect(result).toBe("multiple-projects");
  });

  it("handles missing bible gracefully", async () => {
    const project = { id: "proj-1", title: "Novel", status: "bootstrap" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue([project]);
    mockedApi.apiGetProject.mockResolvedValue(project);
    mockedApi.apiGetLatestBible.mockRejectedValue(new Error("No bible found"));
    mockedApi.apiListBibleVersions.mockResolvedValue([]);
    mockedApi.apiListChapterArcs.mockResolvedValue([]);

    const result = await initializeApp(store);

    expect(result).toBe("loaded");
    expect(store.project).toEqual(project);
    expect(store.bible).toBeNull();
  });

  it("sets error on unexpected failure", async () => {
    mockedApi.apiListProjects.mockRejectedValue(new Error("Network down"));

    const result = await initializeApp(store);

    expect(result).toBe("error");
    expect(store.error).toBe("Network down");
  });
});
