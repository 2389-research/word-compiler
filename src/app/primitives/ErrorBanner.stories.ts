import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import ErrorBanner from "./ErrorBanner.svelte";

const meta: Meta<ErrorBanner> = {
  title: "Primitives/ErrorBanner",
  component: ErrorBanner,
  argTypes: {
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<ErrorBanner>;

export const Default: Story = {
  args: { message: "Something went wrong. Please try again." },
};
export const Dismissible: Story = {
  args: { message: "Connection failed.", onDismiss: fn() },
};
