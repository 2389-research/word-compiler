import { beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../../src/api/client.js";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { initializeApp } from "../../src/app/store/startup.js";
import { makeChapterArc, makeChunk } from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyScenePlan } from "../../src/types/index.js";

vi.mock("../../src/api/client.js");

const mockedApi = vi.mocked(apiClient);

/** Wrap an array in a Page envelope for mocked list helpers. */
function page<T>(data: T[]) {
  return { data, nextPageToken: null };
}

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

    mockedApi.apiListProjects.mockResolvedValue(page([project]));
    mockedApi.apiGetProject.mockResolvedValue(project);
    mockedApi.apiGetLatestBible.mockResolvedValue(bible);
    mockedApi.apiListBibleVersions.mockResolvedValue(page([{ version: 1, createdAt: "" }]));
    mockedApi.apiListChapterArcs.mockResolvedValue(page([arc]));
    mockedApi.apiListScenePlans.mockResolvedValue(page([{ plan, status: "drafting" as const, sceneOrder: 0 }]));
    mockedApi.apiListChunks.mockResolvedValue(page([chunk]));

    const result = await initializeApp(store);

    expect(result).toBe("loaded");
    expect(store.project).toEqual(project);
    expect(store.bible).toEqual(bible);
    expect(store.chapterArc).toEqual(arc);
    expect(store.scenes).toHaveLength(1);
    expect(store.sceneChunks[plan.id]).toHaveLength(1);
  });

  it("returns 'no-projects' when project list is empty", async () => {
    mockedApi.apiListProjects.mockResolvedValue(page([]));

    const result = await initializeApp(store);

    expect(result).toBe("no-projects");
    expect(store.project).toBeNull();
  });

  it("returns 'multiple-projects' when more than one project", async () => {
    const p1 = { id: "proj-1", title: "A", status: "drafting" as const, createdAt: "", updatedAt: "" };
    const p2 = { id: "proj-2", title: "B", status: "drafting" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue(page([p1, p2]));

    const result = await initializeApp(store);

    expect(result).toBe("multiple-projects");
  });

  it("handles missing bible gracefully", async () => {
    const project = { id: "proj-1", title: "Novel", status: "bootstrap" as const, createdAt: "", updatedAt: "" };
    mockedApi.apiListProjects.mockResolvedValue(page([project]));
    mockedApi.apiGetProject.mockResolvedValue(project);
    mockedApi.apiGetLatestBible.mockRejectedValue(new Error("No bible found"));
    mockedApi.apiListBibleVersions.mockResolvedValue(page([]));
    mockedApi.apiListChapterArcs.mockResolvedValue(page([]));

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
