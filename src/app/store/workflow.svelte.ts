import {
  checkAuditToEditGate,
  checkBootstrapToPlanGate,
  checkCompleteToExportGate,
  checkDraftToAuditGate,
  checkEditToCompleteGate,
  checkPlanToDraftGate,
} from "../../gates/index.js";
import type { ProjectStore } from "./project.svelte.js";

export type WorkflowStageId = "bootstrap" | "plan" | "draft" | "audit" | "edit" | "complete" | "export";
export type StageStatus = "locked" | "available" | "active" | "completed";

export interface StageDefinition {
  id: WorkflowStageId;
  label: string;
  prereqDescription: string;
}

export const STAGES: StageDefinition[] = [
  { id: "bootstrap", label: "Bootstrap", prereqDescription: "Start here" },
  { id: "plan", label: "Plan", prereqDescription: "Brief with author voice defined" },
  { id: "draft", label: "Draft", prereqDescription: "At least 1 section plan" },
  { id: "audit", label: "Audit", prereqDescription: "At least 1 chunk generated" },
  { id: "edit", label: "Edit", prereqDescription: "All critical flags resolved" },
  { id: "complete", label: "Complete", prereqDescription: "Editing complete" },
  { id: "export", label: "Export", prereqDescription: "At least 1 section complete" },
];

export class WorkflowStore {
  activeStage: WorkflowStageId = $state("bootstrap");

  private project: ProjectStore;

  constructor(project: ProjectStore) {
    this.project = project;
  }

  /** Check whether the gate to enter a given stage is passed */
  private isGatePassed(stageId: WorkflowStageId): boolean {
    const p = this.project;
    switch (stageId) {
      case "bootstrap":
        return true;
      case "plan":
        return checkBootstrapToPlanGate(p.bible).passed;
      case "draft":
        return checkPlanToDraftGate(p.scenes.map((s) => s.plan)).passed;
      case "audit":
        return checkDraftToAuditGate(p.sceneChunks).passed;
      case "edit":
        return checkAuditToEditGate(p.auditFlags).passed;
      case "complete":
        return checkEditToCompleteGate().passed;
      case "export":
        return checkCompleteToExportGate(p.scenes).passed;
    }
  }

  getStageStatus(stageId: WorkflowStageId): StageStatus {
    if (stageId === this.activeStage) return "active";

    const stageIndex = STAGES.findIndex((s) => s.id === stageId);
    const activeIndex = STAGES.findIndex((s) => s.id === this.activeStage);

    // Stages before the active one that have their gate passed are "completed"
    if (stageIndex < activeIndex && this.isGatePassed(stageId)) return "completed";

    // Stages after the active one are "available" if their gate is passed, otherwise "locked"
    if (this.isGatePassed(stageId)) return "available";
    return "locked";
  }

  goToStage(id: WorkflowStageId): boolean {
    const status = this.getStageStatus(id);
    if (status === "locked") return false;
    this.activeStage = id;
    return true;
  }

  get nextStageCTA(): StageDefinition | null {
    const activeIndex = STAGES.findIndex((s) => s.id === this.activeStage);
    const next = STAGES[activeIndex + 1];
    if (!next) return null;
    return this.isGatePassed(next.id) ? next : null;
  }

  get completedStages(): WorkflowStageId[] {
    return STAGES.filter((s) => this.getStageStatus(s.id) === "completed").map((s) => s.id);
  }
}
