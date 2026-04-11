import type { Meta, StoryObj } from "@storybook/svelte";
import BibleAuthoringModalStory from "./BibleAuthoringModalStory.svelte";

const meta: Meta<BibleAuthoringModalStory> = {
  title: "Components/BibleAuthoringModal",
  component: BibleAuthoringModalStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "600px" },
      description: {
        component: "Brief authoring modal — create or edit the essay brief via guided form entry.",
      },
    },
  },
  argTypes: {
    prePopulated: {
      control: "boolean",
      description: "Whether to pre-populate with sample Brief data.",
    },
    withGenre: {
      control: "boolean",
      description: "Whether to apply Personal Essay style template defaults.",
    },
  },
};

export default meta;
type Story = StoryObj<BibleAuthoringModalStory>;

export const Empty: Story = {
  args: { prePopulated: false },
};

export const PrePopulated: Story = {
  args: { prePopulated: true },
};

export const WithGenrePresets: Story = {
  args: { prePopulated: true, withGenre: true },
};
