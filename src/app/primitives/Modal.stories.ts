import type { Meta, StoryObj } from "@storybook/svelte";
import ModalStory from "./ModalStory.svelte";

const meta: Meta<ModalStory> = {
  title: "Primitives/Modal",
  component: ModalStory,
  parameters: {
    layout: "fullscreen",
    docs: { story: { height: "400px" } },
  },
  argTypes: {
    open: { control: "boolean" },
    width: { control: "select", options: ["default", "wide"] },
  },
};

export default meta;
type Story = StoryObj<ModalStory>;

export const Default: Story = {
  args: { open: true },
};

export const Wide: Story = {
  args: { open: true, width: "wide" },
};
