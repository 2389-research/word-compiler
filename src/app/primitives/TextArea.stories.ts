import type { Meta, StoryObj } from "@storybook/svelte";
import TextArea from "./TextArea.svelte";

const meta: Meta<TextArea> = {
  title: "Primitives/TextArea",
  component: TextArea,
  argTypes: {
    variant: { control: "select", options: ["default", "compact"] },
    placeholder: { control: "text" },
    rows: { control: "number" },
    resize: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<TextArea>;

export const Default: Story = {
  args: { placeholder: "Write something..." },
};
export const Compact: Story = {
  args: { variant: "compact", placeholder: "Short note..." },
};
export const WithValue: Story = {
  args: { value: "The rain fell in sheets against the window, each drop a tiny percussion." },
};
export const Resizable: Story = {
  args: { placeholder: "Resize me...", resize: true },
};
