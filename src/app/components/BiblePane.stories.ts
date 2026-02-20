import type { Meta, StoryObj } from "@storybook/svelte";
import BiblePaneStory from "./BiblePaneStory.svelte";

const meta: Meta<BiblePaneStory> = {
  title: "Components/BiblePane",
  component: BiblePaneStory,
  parameters: {
    docs: {
      description: {
        component:
          "Editor pane for Bible and Scene Plan JSON with CodeMirror integration, file load/save buttons, and bootstrap trigger. Requires a `ProjectStore` instance (mocked here via a wrapper).",
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
  },
};

export default meta;
type Story = StoryObj<BiblePaneStory>;

export const NoBible: Story = {
  args: { hasBible: false, hasScenes: false },
};

export const WithBible: Story = {
  args: { hasBible: true, hasScenes: false },
};

export const WithScenes: Story = {
  args: { hasBible: true, hasScenes: true },
};
