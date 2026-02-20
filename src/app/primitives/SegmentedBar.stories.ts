import type { Meta, StoryObj } from "@storybook/svelte";
import SegmentedBar from "./SegmentedBar.svelte";

const meta: Meta<SegmentedBar> = {
  title: "Primitives/SegmentedBar",
  component: SegmentedBar,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<SegmentedBar>;

export const RingBreakdown: Story = {
  args: {
    segments: [
      { label: "R1 1,200", flex: 27, variant: "r1" },
      { label: "R2 800", flex: 18, variant: "r2" },
      { label: "R3 2,400", flex: 55, variant: "r3" },
    ],
  },
};

export const SignalNoise: Story = {
  args: {
    segments: [
      { label: "3 actionable", flex: 3, variant: "actionable" },
      { label: "2 noise", flex: 2, variant: "noise" },
    ],
    height: 8,
  },
};

export const Flagged: Story = {
  args: {
    segments: [
      { label: "R1 2,400", flex: 44, variant: "r1", flagged: true },
      { label: "R2 800", flex: 15, variant: "r2" },
      { label: "R3 2,200", flex: 41, variant: "r3", starved: true },
    ],
  },
};
