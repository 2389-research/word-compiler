import type { Meta, StoryObj } from "@storybook/svelte";
import SelectStory from "./SelectStory.svelte";

const meta: Meta<SelectStory> = {
  title: "Primitives/Select",
  component: SelectStory,
  argTypes: {
    value: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<SelectStory>;

export const Default: Story = {
  args: { value: "claude-sonnet-4" },
};

export const AlternateSelection: Story = {
  args: { value: "claude-opus-4" },
};
