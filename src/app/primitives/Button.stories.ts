import type { Meta, StoryObj } from "@storybook/svelte";
import ButtonStory from "./ButtonStory.svelte";

const meta: Meta<ButtonStory> = {
  title: "Primitives/Button",
  component: ButtonStory,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "danger", "ghost"],
    },
    size: { control: "select", options: ["sm", "md"] },
    disabled: { control: "boolean" },
    text: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<ButtonStory>;

export const Default: Story = {
  args: { text: "Click me" },
};
export const Primary: Story = {
  args: { variant: "primary", text: "Generate" },
};
export const Danger: Story = {
  args: { variant: "danger", text: "Reject" },
};
export const Ghost: Story = {
  args: { variant: "ghost", text: "Tab" },
};
export const Small: Story = {
  args: { size: "sm", text: "Small" },
};
export const Disabled: Story = {
  args: { disabled: true, text: "Disabled" },
};
export const Loading: Story = {
  args: { variant: "primary", disabled: true, text: "Generating..." },
};
