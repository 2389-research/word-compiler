import type { Meta, StoryObj } from "@storybook/svelte";
import BadgeStory from "./BadgeStory.svelte";

const meta: Meta<BadgeStory> = {
  title: "Primitives/Badge",
  component: BadgeStory,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "pending", "accepted", "edited", "rejected", "warning"],
    },
    text: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<BadgeStory>;

export const Default: Story = {
  args: { variant: "default", text: "default" },
};
export const Pending: Story = {
  args: { variant: "pending", text: "pending" },
};
export const Accepted: Story = {
  args: { variant: "accepted", text: "accepted" },
};
export const Edited: Story = {
  args: { variant: "edited", text: "edited" },
};
export const Rejected: Story = {
  args: { variant: "rejected", text: "rejected" },
};
export const Warning: Story = {
  args: { variant: "warning", text: "unverified" },
};
