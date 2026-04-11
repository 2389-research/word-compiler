import type { Meta, StoryObj } from "@storybook/svelte";
import BibleGuidedFormTabStory from "./BibleGuidedFormTabStory.svelte";

const meta: Meta<BibleGuidedFormTabStory> = {
  title: "Components/BibleGuidedFormTab",
  component: BibleGuidedFormTabStory,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "5-step guided form for building an essay brief: Foundations, Voice Profiles, References, Style Guide, and Review. " +
          "Includes style template selector, expand/collapse controls, and ExamplesDrawer integration for voice, metaphor, and kill list fields.",
      },
    },
  },
  argTypes: {
    prePopulated: {
      control: "boolean",
      description: "Pre-populate with sample voice profiles, references, and style guide entries.",
    },
    withGenre: {
      control: "boolean",
      description: "Apply Personal Essay style template defaults.",
    },
    initialStep: {
      control: "select",
      options: ["foundations", "characters", "locations", "style", "review"],
      description: "Which wizard step to show initially.",
    },
  },
};

export default meta;
type Story = StoryObj<BibleGuidedFormTabStory>;

export const FoundationsEmpty: Story = {
  args: { prePopulated: false, withGenre: false, initialStep: "foundations" },
};

export const FoundationsWithGenre: Story = {
  args: { prePopulated: false, withGenre: true, initialStep: "foundations" },
};

export const CharactersEmpty: Story = {
  args: { prePopulated: false, initialStep: "characters" },
};

export const CharactersPrePopulated: Story = {
  args: { prePopulated: true, initialStep: "characters" },
};

export const LocationsPrePopulated: Story = {
  args: { prePopulated: true, initialStep: "locations" },
};

export const StyleGuidePrePopulated: Story = {
  args: { prePopulated: true, initialStep: "style" },
};

export const ReviewPrePopulated: Story = {
  args: { prePopulated: true, initialStep: "review" },
};

export const FullPrePopulatedWithGenre: Story = {
  args: { prePopulated: true, withGenre: true, initialStep: "review" },
};
