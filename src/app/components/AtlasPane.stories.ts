import type { Meta, StoryObj } from "@storybook/svelte";
import AtlasPaneStory from "./AtlasPaneStory.svelte";

const meta: Meta<AtlasPaneStory> = {
  title: "Components/AtlasPane",
  component: AtlasPaneStory,
  parameters: {
    docs: {
      description: {
        component:
          "Tabbed reference panel with Brief (voice profiles, references, style, narrative rules), Section Plan, Essay Arc, and raw JSON editor tabs.",
      },
    },
  },
  argTypes: {
    hasBible: { control: "boolean", description: "Seed store with an empty brief" },
    hasBibleRich: {
      control: "boolean",
      description: "Seed store with a rich brief (voice profiles, references, style guide, narrative rules)",
    },
    hasScenes: { control: "boolean", description: "Seed store with a section plan" },
    hasArc: { control: "boolean", description: "Seed store with an essay arc" },
    initialTab: {
      control: "select",
      options: ["bible", "scene", "arc", "json"],
      description: "Which tab to show initially",
    },
  },
};

export default meta;
type Story = StoryObj<AtlasPaneStory>;

export const EmptyProject: Story = {
  args: { hasBible: false, hasScenes: false, hasArc: false },
};

export const BibleTabEmpty: Story = {
  args: { hasBible: true, hasScenes: false },
};

export const BibleTabRich: Story = {
  args: { hasBibleRich: true, hasScenes: false },
};

export const SceneTab: Story = {
  args: { hasBibleRich: true, hasScenes: true, initialTab: "scene" },
};

export const ArcTab: Story = {
  args: { hasBibleRich: true, hasScenes: true, hasArc: true, initialTab: "arc" },
};

export const JsonTab: Story = {
  args: { hasBibleRich: true, hasScenes: true, hasArc: true, initialTab: "json" },
};
