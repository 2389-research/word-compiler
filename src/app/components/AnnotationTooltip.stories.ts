import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeEditorialAnnotation } from "../stories/factories.js";
import AnnotationTooltip from "./AnnotationTooltip.svelte";

const meta: Meta<AnnotationTooltip> = {
  title: "Components/AnnotationTooltip",
  component: AnnotationTooltip,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Floating tooltip for editorial annotations. Shows severity, category, message, optional suggestion with Apply button, and Dismiss button.",
      },
    },
  },
  args: {
    position: { top: 40, left: 20, anchorBottom: 36 },
    onAccept: fn(),
    onDismiss: fn(),
  },
};

export default meta;
type Story = StoryObj<AnnotationTooltip>;

export const Warning: Story = {
  args: {
    annotation: makeEditorialAnnotation({
      severity: "warning",
      category: "kill_list",
      message: '"very" — kill list violation, weakens prose',
    }),
  },
};

export const Critical: Story = {
  args: {
    annotation: makeEditorialAnnotation({
      severity: "critical",
      category: "voice",
      message: "Character voice breaks: Marcus uses vocabulary far outside his established register",
    }),
  },
};

export const Info: Story = {
  args: {
    annotation: makeEditorialAnnotation({
      severity: "info",
      category: "grammar",
      message: "Consider a comma before the coordinating conjunction in this compound sentence",
    }),
  },
};

export const WithSuggestion: Story = {
  args: {
    annotation: makeEditorialAnnotation({
      severity: "warning",
      category: "vocabulary",
      message: '"utilize" — prefer simpler alternative per style guide',
      suggestion: "use",
      anchor: { prefix: "They chose to ", focus: "utilize", suffix: " the old tool" },
    }),
  },
};

export const LongMessage: Story = {
  args: {
    annotation: makeEditorialAnnotation({
      severity: "warning",
      category: "show_dont_tell",
      message:
        "This passage tells the reader about Elena's emotional state rather than showing it through action, body language, or sensory detail. Consider replacing the abstract statement with a concrete physical manifestation of the emotion.",
      suggestion: "She pressed her nails into her palm until the half-moons went white.",
    }),
  },
};
