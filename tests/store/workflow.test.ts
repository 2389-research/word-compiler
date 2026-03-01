import { beforeEach, describe, expect, it } from "vitest";
import { ProjectStore } from "../../src/app/store/project.svelte.js";
import { STAGES, WorkflowStore } from "../../src/app/store/workflow.svelte.js";
import { makeChunk, makeScenePlan } from "../../src/app/stories/factories.js";
import { createEmptyBible, createEmptyCharacterDossier } from "../../src/types/index.js";

describe("WorkflowStore", () => {
  let project: ProjectStore;
  let workflow: WorkflowStore;

  beforeEach(() => {
    project = new ProjectStore();
    workflow = new WorkflowStore(project);
  });

  // ─── Initial state ────────────────────────────────

  it("starts at bootstrap stage", () => {
    expect(workflow.activeStage).toBe("bootstrap");
  });

  it("bootstrap is active, all others locked initially", () => {
    expect(workflow.getStageStatus("bootstrap")).toBe("active");
    expect(workflow.getStageStatus("plan")).toBe("locked");
    expect(workflow.getStageStatus("draft")).toBe("locked");
    expect(workflow.getStageStatus("audit")).toBe("locked");
    // "edit" gate passes with no flags, so it's "available" not "locked"
    expect(workflow.getStageStatus("edit")).toBe("available");
    // "complete" soft gate always passes, so it's "available" not "locked"
    expect(workflow.getStageStatus("complete")).toBe("available");
    expect(workflow.getStageStatus("export")).toBe("locked");
  });

  // ─── Stage transitions ───────────────────────────

  it("rejects navigation to locked stages", () => {
    expect(workflow.goToStage("plan")).toBe(false);
    expect(workflow.activeStage).toBe("bootstrap");
  });

  it("unlocks plan when bible has a character", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);

    expect(workflow.getStageStatus("plan")).toBe("available");
    expect(workflow.goToStage("plan")).toBe(true);
    expect(workflow.activeStage).toBe("plan");
  });

  it("marks bootstrap as completed when navigating to plan", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    workflow.goToStage("plan");

    expect(workflow.getStageStatus("bootstrap")).toBe("completed");
  });

  it("unlocks draft when a scene plan with title + narrativeGoal exists", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    workflow.goToStage("plan");

    const plan = makeScenePlan({ title: "Opening", narrativeGoal: "Establish world" });
    project.setScenes([{ plan, status: "planned", sceneOrder: 0 }]);

    expect(workflow.getStageStatus("draft")).toBe("available");
    expect(workflow.goToStage("draft")).toBe(true);
  });

  it("unlocks audit when chunks exist", () => {
    // Set up through draft
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    const plan = makeScenePlan({ title: "Opening", narrativeGoal: "Establish world" });
    project.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
    project.setSceneChunks(plan.id, [makeChunk({ sceneId: plan.id })]);
    workflow.goToStage("draft");

    expect(workflow.getStageStatus("audit")).toBe("available");
  });

  it("unlocks edit when no critical unresolved flags", () => {
    // With no flags at all, the audit→edit gate passes
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    const plan = makeScenePlan({ title: "Opening", narrativeGoal: "Establish world" });
    project.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
    project.setSceneChunks(plan.id, [makeChunk({ sceneId: plan.id })]);
    workflow.goToStage("audit");

    expect(workflow.getStageStatus("edit")).toBe("available");
  });

  it("unlocks complete (soft gate — always passes)", () => {
    // edit→complete gate always passes
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    const plan = makeScenePlan({ title: "Opening", narrativeGoal: "Establish world" });
    project.setScenes([{ plan, status: "drafting", sceneOrder: 0 }]);
    project.setSceneChunks(plan.id, [makeChunk({ sceneId: plan.id })]);
    workflow.goToStage("edit");

    expect(workflow.getStageStatus("complete")).toBe("available");
  });

  it("unlocks export when a scene is complete", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    const plan = makeScenePlan({ title: "Opening", narrativeGoal: "Establish world" });
    project.setScenes([{ plan, status: "complete", sceneOrder: 0 }]);
    project.setSceneChunks(plan.id, [makeChunk({ sceneId: plan.id })]);
    workflow.goToStage("complete");

    expect(workflow.getStageStatus("export")).toBe("available");
  });

  // ─── nextStageCTA ─────────────────────────────────

  it("returns null CTA when next stage is locked", () => {
    expect(workflow.nextStageCTA).toBeNull();
  });

  it("returns next stage CTA when prerequisites met", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);

    expect(workflow.nextStageCTA).not.toBeNull();
    expect(workflow.nextStageCTA!.id).toBe("plan");
  });

  it("returns null CTA at export stage (no next stage)", () => {
    workflow.activeStage = "export";
    expect(workflow.nextStageCTA).toBeNull();
  });

  // ─── completedStages ──────────────────────────────

  it("returns empty completed stages initially", () => {
    expect(workflow.completedStages).toEqual([]);
  });

  it("includes passed stages before active as completed", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    workflow.goToStage("plan");

    expect(workflow.completedStages).toContain("bootstrap");
  });

  // ─── Free navigation to earlier stages ─────────────

  it("allows navigating back to earlier stages", () => {
    const bible = createEmptyBible("test");
    bible.characters.push(createEmptyCharacterDossier("Marcus"));
    project.setBible(bible);
    workflow.goToStage("plan");

    expect(workflow.goToStage("bootstrap")).toBe(true);
    expect(workflow.activeStage).toBe("bootstrap");
  });

  // ─── STAGES constant ─────────────────────────────

  it("has 7 stages in correct order", () => {
    expect(STAGES).toHaveLength(7);
    expect(STAGES.map((s) => s.id)).toEqual(["bootstrap", "plan", "draft", "audit", "edit", "complete", "export"]);
  });
});
