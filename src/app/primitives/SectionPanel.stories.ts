import type { Meta, StoryObj } from "@storybook/svelte";
import SectionPanelStory from "./SectionPanelStory.svelte";

const meta: Meta<SectionPanelStory> = {
  title: "Primitives/SectionPanel",
  component: SectionPanelStory,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<SectionPanelStory>;

export const TitleOnly: Story = {
  args: { title: "System Message (Ring 1)", content: "You are a personal essay writer..." },
};

export const WithBadge: Story = {
  args: { title: "Lint", badgeText: "3E 2W 1I", content: "Ring 1 exceeds hard cap..." },
};

export const WithContent: Story = {
  args: { title: "Prose Metrics", content: "Words: 342, Sentences: 28, TTR: 0.68" },
};
