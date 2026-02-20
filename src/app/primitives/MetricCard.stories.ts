import type { Meta, StoryObj } from "@storybook/svelte";
import MetricCard from "./MetricCard.svelte";

const meta: Meta<MetricCard> = {
  title: "Primitives/MetricCard",
  component: MetricCard,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<MetricCard>;

export const Default: Story = {
  args: { label: "Words", value: 342 },
};

export const WithColor: Story = {
  args: { label: "Variance", value: "4.8", valueColor: "var(--success)" },
};

export const LongLabel: Story = {
  args: { label: "Avg Sentence Length", value: "12.2w" },
};

export const NumericValue: Story = {
  args: { label: "Paragraphs", value: 6 },
};
