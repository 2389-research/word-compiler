import type { Meta, StoryObj } from "@storybook/svelte";
import TableStory from "./TableStory.svelte";

const meta: Meta<TableStory> = {
  title: "Primitives/Table",
  component: TableStory,
};

export default meta;
type Story = StoryObj<TableStory>;

export const Default: Story = {};
