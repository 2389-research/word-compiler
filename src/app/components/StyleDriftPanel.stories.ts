import type { Meta, StoryObj } from "@storybook/svelte";
import { makeStyleDriftReport } from "../stories/factories.js";
import StyleDriftPanel from "./StyleDriftPanel.svelte";

const sceneTitles: Record<string, string> = {
  "scene-2": "Pattern Recognition",
  "scene-3": "Echo Location",
  "scene-4": "The Response",
};

const meta: Meta<StyleDriftPanel> = {
  title: "Components/StyleDriftPanel",
  component: StyleDriftPanel,
  parameters: { layout: "fullscreen" },
  args: { sceneTitles },
};

export default meta;
type Story = StoryObj<StyleDriftPanel>;

export const Empty: Story = {
  args: { reports: [], baselineSceneTitle: "First Contact Protocol" },
};

export const AllConsistent: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", false, { avgSentenceLength: 0.03, typeTokenRatio: 0.02 }),
      makeStyleDriftReport("scene-3", false, { avgSentenceLength: 0.05, sentenceLengthStdDev: 0.04 }),
    ],
    baselineSceneTitle: "First Contact Protocol",
  },
};

export const OneDrifting: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", false),
      makeStyleDriftReport("scene-3", true, { avgSentenceLength: 0.25, avgParagraphLength: 0.18 }),
    ],
    baselineSceneTitle: "First Contact Protocol",
  },
};

export const AllDrifting: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", true, {
        avgSentenceLength: 0.22,
        sentenceLengthStdDev: 0.18,
        typeTokenRatio: 0.15,
        avgParagraphLength: 0.31,
      }),
      makeStyleDriftReport("scene-3", true, {
        avgSentenceLength: 0.35,
        sentenceLengthStdDev: 0.28,
        typeTokenRatio: 0.12,
        avgParagraphLength: 0.25,
      }),
    ],
    baselineSceneTitle: "First Contact Protocol",
  },
};

export const ManyScenes: Story = {
  args: {
    reports: [
      makeStyleDriftReport("scene-2", false, { avgSentenceLength: 0.04 }),
      makeStyleDriftReport("scene-3", true, { avgSentenceLength: 0.18 }),
      makeStyleDriftReport("scene-4", false, { avgSentenceLength: 0.07 }),
    ],
    baselineSceneTitle: "First Contact Protocol",
  },
};
