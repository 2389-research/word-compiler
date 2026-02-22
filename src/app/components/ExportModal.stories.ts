import type { Meta, StoryObj } from "@storybook/svelte";
import ExportModalStory from "./ExportModalStory.svelte";

const meta: Meta<ExportModalStory> = {
  title: "Components/ExportModal",
  component: ExportModalStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "500px" },
      description: {
        component:
          "Export modal — renders chapter prose as Markdown or Plain Text with preview, word count, copy, and download.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<ExportModalStory>;

export const EmptyProject: Story = {
  args: { withProse: false },
};

export const MarkdownFormat: Story = {
  args: { withProse: true, multiScene: true },
};

export const PlainTextFormat: Story = {
  args: { withProse: true },
};
