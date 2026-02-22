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
        component:
          "Bible authoring modal — create or edit the story bible via direct form entry or LLM bootstrap from a synopsis.",
      },
    },
  },
  argTypes: {
    mode: {
      control: "select",
      options: ["bootstrap", "form"],
      description: "Which authoring mode to start in.",
    },
    prePopulated: {
      control: "boolean",
      description: "Whether to pre-populate with sample Bible data.",
    },
  },
};

export default meta;
type Story = StoryObj<BibleAuthoringModalStory>;

export const EmptyBootstrap: Story = {
  args: { mode: "bootstrap", prePopulated: false },
};

export const EmptyForm: Story = {
  args: { mode: "form", prePopulated: false },
};

export const PrePopulatedForm: Story = {
  args: { mode: "form", prePopulated: true },
};
