import type { Meta, StoryObj } from "@storybook/svelte";
import { makeStyleDriftReport } from "../stories/factories.js";
import StyleDriftPanel from "./StyleDriftPanel.svelte";

const meta: Meta<StyleDriftPanel> = {
  title: "Components/StyleDriftPanel",
  component: StyleDriftPanel,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<StyleDriftPanel>;

export const Empty: Story = {
  args: { reports: [], baselineSceneTitle: "Scene 1" },
};

export const AllOK: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", false, { avgSentenceLength: 0.03, typeTokenRatio: 0.02 }),
      makeStyleDriftReport("scene-3", false, { avgSentenceLength: 0.05, sentenceLengthVariance: 0.04 }),
    ],
    baselineSceneTitle: "The Arrival",
  },
};

export const WithFlagged: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", false),
      makeStyleDriftReport("scene-3", true, { avgSentenceLength: 0.25, avgParagraphLength: 0.18 }),
    ],
    baselineSceneTitle: "The Arrival",
  },
};

export const AllFlagged: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", true, {
        avgSentenceLength: 0.22,
        sentenceLengthVariance: 0.18,
        typeTokenRatio: 0.15,
        avgParagraphLength: 0.31,
      }),
      makeStyleDriftReport("scene-3", true, {
        avgSentenceLength: 0.35,
        sentenceLengthVariance: 0.28,
        typeTokenRatio: 0.12,
        avgParagraphLength: 0.25,
      }),
    ],
    baselineSceneTitle: "The Arrival",
  },
};

export const SingleScene: Story = {
  args: {
    reports: [makeStyleDriftReport("scene-2", true, { avgSentenceLength: 0.14, typeTokenRatio: 0.11 })],
    baselineSceneTitle: "The Arrival",
  },
};
