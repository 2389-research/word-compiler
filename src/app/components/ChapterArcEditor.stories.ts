import type { Meta, StoryObj } from "@storybook/svelte";
import ChapterArcEditorStory from "./ChapterArcEditorStory.svelte";

const meta: Meta<ChapterArcEditorStory> = {
  title: "Components/ChapterArcEditor",
  component: ChapterArcEditorStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "600px" },
      description: {
        component:
          "Modal editor for chapter arc metadata — title, narrative function, register, pacing, ending posture, and reader state entering/exiting. Requires a `ProjectStore` instance (mocked here via a wrapper).",
      },
    },
  },
  argTypes: {
    prefilled: {
      control: "boolean",
      description:
        "When true, pre-fills the arc with realistic data (title, function, reader states). When false, shows an empty arc form.",
    },
  },
};

export default meta;
type Story = StoryObj<ChapterArcEditorStory>;

export const NewArc: Story = {
  args: { prefilled: false },
};

export const EditExisting: Story = {
  args: { prefilled: true },
};
