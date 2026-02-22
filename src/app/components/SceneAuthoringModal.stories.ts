import type { Meta, StoryObj } from "@storybook/svelte";
import SceneAuthoringModalStory from "./SceneAuthoringModalStory.svelte";

const meta: Meta<SceneAuthoringModalStory> = {
  title: "Components/SceneAuthoringModal",
  component: SceneAuthoringModalStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "600px" },
      description: {
        component:
          "Scene authoring modal — plan new scenes with POV, narrative goals, and chunk breakdowns. Requires a Bible for character/location selectors.",
      },
    },
  },
  argTypes: {
    withBible: {
      control: "boolean",
      description: "Whether to populate Bible data (characters + locations).",
    },
    richData: {
      control: "boolean",
      description: "Whether to add extra characters/locations with filled voice and sensory data.",
    },
    initialTab: {
      control: "select",
      options: ["bootstrap", "form"],
      description: "Which tab to open on (bootstrap or guided form).",
    },
  },
};

export default meta;
type Story = StoryObj<SceneAuthoringModalStory>;

export const Empty: Story = {
  args: { withBible: false },
};

export const WithBible: Story = {
  args: { withBible: true },
};

export const WithRichBible: Story = {
  args: { withBible: true, richData: true },
};

export const GuidedFormEmpty: Story = {
  args: { withBible: false, initialTab: "form" },
};

export const GuidedFormWithBible: Story = {
  args: { withBible: true, initialTab: "form" },
};
