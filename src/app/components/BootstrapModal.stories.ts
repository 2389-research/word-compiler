import type { Meta, StoryObj } from "@storybook/svelte";
import BootstrapModalStory from "./BootstrapModalStory.svelte";

const meta: Meta<BootstrapModalStory> = {
  title: "Components/BootstrapModal",
  component: BootstrapModalStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "500px" },
      description: {
        component:
          "Modal for bootstrapping a Bible from a story synopsis. Streams LLM output with progress tracking. Requires a `ProjectStore` instance (mocked here via a wrapper).",
      },
    },
  },
  argTypes: {
    initialOpen: {
      control: "boolean",
      description: "Whether the modal starts in the open state.",
    },
  },
};

export default meta;
type Story = StoryObj<BootstrapModalStory>;

export const Initial: Story = {
  args: { initialOpen: true },
};
