import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeAuditFlag, makeChunk, makeNarrativeIR, makeScenePlan } from "../stories/factories.js";
import DraftingDesk from "./DraftingDesk.svelte";

const meta: Meta<DraftingDesk> = {
  title: "Components/DraftingDesk",
  component: DraftingDesk,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Main drafting workspace — displays chunks, section plan, generation controls, audit flags, and IR extraction. Orchestrates the per-section writing workflow.",
      },
    },
  },
  args: {
    scenePlan: makeScenePlan(),
    sceneStatus: "drafting",
    isGenerating: false,
    canGenerate: true,
    gateMessages: [],
    auditFlags: [],
    sceneIR: null,
    isExtractingIR: false,
    onGenerate: fn(),
    onUpdateChunk: fn(),
    onRemoveChunk: fn(),
    onRunAudit: fn(),
    onCompleteScene: fn(),
    onAutopilot: fn(),
    onCancelAutopilot: fn(),
    onOpenIRInspector: fn(),
    onExtractIR: fn(),
    isAutopilot: false,
  },
};

export default meta;
type Story = StoryObj<DraftingDesk>;

export const EmptyScene: Story = {
  args: { chunks: [] },
};

export const WithChunks: Story = {
  args: {
    chunks: [
      makeChunk({ sequenceNumber: 0, status: "accepted" }),
      makeChunk({
        sequenceNumber: 1,
        status: "edited",
        editedText: "The rain fell softly. Elena pressed her forehead to the cool glass.",
      }),
      makeChunk({ sequenceNumber: 2, status: "pending" }),
    ],
  },
};

export const Generating: Story = {
  args: {
    chunks: [makeChunk({ sequenceNumber: 0, status: "accepted" })],
    isGenerating: true,
  },
};

export const GateFailed: Story = {
  args: {
    chunks: [makeChunk({ sequenceNumber: 0, status: "accepted" })],
    gateMessages: [
      "Section plan is missing — load or create a section plan before generating",
      "Brief is not loaded — load a Brief JSON file first",
    ],
    canGenerate: false,
  },
};

export const CompleteScene: Story = {
  args: {
    chunks: [
      makeChunk({ sequenceNumber: 0, status: "accepted" }),
      makeChunk({ sequenceNumber: 1, status: "accepted" }),
      makeChunk({ sequenceNumber: 2, status: "accepted" }),
    ],
    sceneStatus: "complete",
    sceneIR: makeNarrativeIR({ verified: true }),
  },
};

export const WithAuditFlags: Story = {
  args: {
    chunks: [makeChunk({ sequenceNumber: 0, status: "accepted" }), makeChunk({ sequenceNumber: 1, status: "pending" })],
    auditFlags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: '"suddenly" in paragraph 1',
      }),
      makeAuditFlag({
        severity: "warning",
        category: "sentence-variance",
        message: "Low variance (1.3)",
      }),
    ],
  },
};
