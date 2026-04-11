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
          "Export modal — renders essay prose as Markdown or Plain Text with preview, word count, copy, and download.",
      },
    },
  },
  argTypes: {
    withProse: {
      control: "boolean",
      description: "Whether to populate the project with sample prose.",
    },
    multiScene: {
      control: "boolean",
      description: "Whether to add a second section for multi-section export.",
    },
    initialFormat: {
      control: "select",
      options: ["markdown", "plaintext"],
      description: "Which export format to select initially.",
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
  args: { withProse: true, initialFormat: "plaintext" },
};
