import type { Meta, StoryObj } from "@storybook/svelte";
import AtlasPaneStory from "./AtlasPaneStory.svelte";

const meta: Meta<AtlasPaneStory> = {
  title: "Components/AtlasPane",
  component: AtlasPaneStory,
  parameters: {
    docs: {
      description: {
        component:
          "Editor pane for Bible, Scene Plan, and Chapter Arc JSON with CodeMirror integration, file load/save buttons, and bootstrap trigger. Requires a `ProjectStore` instance (mocked here via a wrapper).",
      },
    },
  },
  argTypes: {
    hasBible: {
      control: "boolean",
      description:
        "When true, initializes the mock store with an empty Bible (shows JSON editor). When false, Bible editor is blank.",
    },
    hasScenes: {
      control: "boolean",
      description: "When true, initializes the mock store with an empty scene plan (shows Scene Plan JSON editor).",
    },
    hasArc: {
      control: "boolean",
      description: "When true, initializes the mock store with a filled Chapter Arc (shows Chapter Arc JSON editor).",
    },
  },
};

export default meta;
type Story = StoryObj<AtlasPaneStory>;

export const NoBible: Story = {
  args: { hasBible: false, hasScenes: false },
};

export const WithBible: Story = {
  args: { hasBible: true, hasScenes: false },
};

export const WithScenes: Story = {
  args: { hasBible: true, hasScenes: true },
};

export const WithArc: Story = {
  args: { hasBible: true, hasScenes: true, hasArc: true },
};
