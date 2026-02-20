import type { Meta, StoryObj } from "@storybook/svelte";
import CollapsibleSectionStory from "./CollapsibleSectionStory.svelte";

const meta: Meta<CollapsibleSectionStory> = {
  title: "Primitives/CollapsibleSection",
  component: CollapsibleSectionStory,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<CollapsibleSectionStory>;

export const Closed: Story = {
  args: { summary: "3 resolved", content: "Resolved flag details here...", open: false },
};

export const DefaultOpen: Story = {
  args: { summary: "Category breakdown", content: "kill-list: 2 total, 2 actionable", open: true },
};
