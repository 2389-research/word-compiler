import type { Meta, StoryObj } from "@storybook/svelte";
import PaneStory from "./PaneStory.svelte";

const meta: Meta<PaneStory> = {
  title: "Primitives/Pane",
  component: PaneStory,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<PaneStory>;

export const Basic: Story = {
  args: { title: "Compiler View", content: "Compiled payload output goes here..." },
};

export const WithHeaderRight: Story = {
  args: { title: "Drafting Desk", content: "Chunk cards go here...", showHeaderRight: true },
};

export const WithExtraClass: Story = {
  args: { title: "IR Inspector", content: "IR data goes here...", extraClass: "ir-inspector" },
};
