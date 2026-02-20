import type { Meta, StoryObj } from "@storybook/svelte";
import Input from "./Input.svelte";

const meta: Meta<Input> = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "centered" },
  argTypes: {
    placeholder: { control: "text" },
    value: { control: "text" },
    type: { control: "select", options: ["text", "number", "password"] },
  },
};

export default meta;
type Story = StoryObj<Input>;

export const Default: Story = {
  args: { placeholder: "Enter text..." },
};
export const WithValue: Story = {
  args: { value: "Hello world" },
};
export const WithPlaceholder: Story = {
  args: { placeholder: "Scene title..." },
};
