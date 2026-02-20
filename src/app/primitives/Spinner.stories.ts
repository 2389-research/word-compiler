import type { Meta, StoryObj } from "@storybook/svelte";
import Spinner from "./Spinner.svelte";

const meta: Meta<Spinner> = {
  title: "Primitives/Spinner",
  component: Spinner,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<Spinner>;

export const Medium: Story = { args: { size: "md" } };
export const Small: Story = { args: { size: "sm" } };
