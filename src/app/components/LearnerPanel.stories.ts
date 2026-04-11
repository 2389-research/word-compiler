import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeEditPattern, makeTuningProposal } from "../stories/factories.js";
import LearnerPanel from "./LearnerPanel.svelte";

const meta: Meta<LearnerPanel> = {
  title: "Components/LearnerPanel",
  component: LearnerPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Displays edit pattern analysis, brief proposals, and tuning suggestions from the revision learner.",
      },
    },
  },
  args: {
    editPatterns: [],
    sceneOrder: new Map(),
    projectId: "p1",
    tuningProposals: [],
    onAcceptProposal: fn(),
    onRejectProposal: fn(),
    onAcceptTuning: fn(),
    onRejectTuning: fn(),
  },
};

export default meta;
type Story = StoryObj<LearnerPanel>;

export const Empty: Story = {};

export const NotEnoughPatterns: Story = {
  args: {
    editPatterns: [makeEditPattern(), makeEditPattern()],
    sceneOrder: new Map([["s1", 0]]),
  },
};

export const WithProposals: Story = {
  args: {
    editPatterns: Array.from({ length: 10 }, () => makeEditPattern()),
    sceneOrder: new Map([["s1", 0]]),
  },
};

export const WithTuning: Story = {
  args: {
    editPatterns: Array.from({ length: 10 }, () => makeEditPattern()),
    sceneOrder: new Map([["s1", 0]]),
    tuningProposals: [
      makeTuningProposal(),
      makeTuningProposal({
        parameter: "reservedForOutput",
        currentValue: 4096,
        suggestedValue: 3481,
        rationale:
          "Edited chunks are on average 22% shorter than generated text. Reducing output reservation may produce more concise chunks.",
        confidence: 0.6,
      }),
    ],
  },
};

export const RichPatterns: Story = {
  args: {
    editPatterns: [
      ...Array.from({ length: 5 }, (_, i) =>
        makeEditPattern({
          sceneId: "s1",
          originalText: ["well", "just", "really", "very", "quite"][i],
          editedText: "",
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeEditPattern({
          sceneId: "s2",
          editType: "SUBSTITUTION",
          subType: "TONE_SHIFT",
          originalText: ["He was angry", "She felt sad", "It was scary", "They were happy"][i],
          editedText: [
            "His jaw clenched",
            "Her shoulders dropped",
            "The floorboards groaned",
            "Laughter broke across the table",
          ][i],
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeEditPattern({
          sceneId: "s3",
          editType: "SUBSTITUTION",
          subType: "SHOW_DONT_TELL",
          originalText: ["She was nervous", "He looked tired", "The room was cold"][i],
          editedText: [
            "She twisted the ring on her finger",
            "Shadows pooled beneath his eyes",
            "Frost crept along the window frame",
          ][i],
        }),
      ),
    ],
    sceneOrder: new Map([
      ["s1", 0],
      ["s2", 1],
      ["s3", 2],
    ]),
    tuningProposals: [
      makeTuningProposal({ confidence: 0.82 }),
      makeTuningProposal({
        parameter: "reservedForOutput",
        currentValue: 4096,
        suggestedValue: 3481,
        rationale:
          "Edited chunks are on average 22% shorter than generated text. Reducing output reservation may produce more concise chunks.",
        confidence: 0.6,
      }),
      makeTuningProposal({
        parameter: "topP",
        currentValue: 1.0,
        suggestedValue: 0.92,
        rationale:
          "Frequent tone-shift edits suggest the model explores too-wide a probability space. Slight nucleus trimming should reduce off-voice outputs.",
        confidence: 0.71,
      }),
    ],
  },
};
