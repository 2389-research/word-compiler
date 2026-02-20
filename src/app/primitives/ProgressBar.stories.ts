import type { Meta, StoryObj } from "@storybook/svelte";
import ProgressBar from "./ProgressBar.svelte";

const meta: Meta<ProgressBar> = {
  title: "Primitives/ProgressBar",
  component: ProgressBar,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<ProgressBar>;

export const Default: Story = {
  args: { value: 55, label: "55% of budget (4,400 / 8,000 tokens)" },
};

export const NearFull: Story = {
  args: { value: 92, label: "92% of budget" },
};

export const OverBudget: Story = {
  args: { value: 100, variant: "error", label: "118% of budget", showOverflow: true, overflowPct: 18 },
};

export const Empty: Story = {
  args: { value: 0 },
};
