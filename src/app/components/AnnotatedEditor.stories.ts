import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeEditorialAnnotation } from "../stories/factories.js";
import AnnotatedEditor from "./AnnotatedEditor.svelte";

const SAMPLE_TEXT = [
  "The rain fell in sheets against the window, each drop a tiny percussion in the symphony of the storm.",
  "Elena pressed her forehead to the glass, watching the world dissolve into watercolor.",
  'She was very happy to see the garden still standing. "I told you it would survive," she said suddenly.',
  "Marcus stood at the far end of the room, his weathered hands resting on the back of the chair.",
].join("\n\n");

const meta: Meta<AnnotatedEditor> = {
  title: "Components/AnnotatedEditor",
  component: AnnotatedEditor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "TipTap-based prose editor with ProseMirror decoration overlays for editorial annotations. Shows squiggle underlines for flagged text with hover tooltips.",
      },
    },
  },
  args: {
    onTextChange: fn(),
    onAcceptSuggestion: fn(),
    onDismissAnnotation: fn(),
  },
};

export default meta;
type Story = StoryObj<AnnotatedEditor>;

export const Empty: Story = {
  args: {
    text: "",
    annotations: [],
  },
};

export const ReadOnly: Story = {
  args: {
    text: SAMPLE_TEXT,
    annotations: [],
    readonly: true,
  },
};

export const WithAnnotations: Story = {
  args: {
    text: SAMPLE_TEXT,
    annotations: [
      makeEditorialAnnotation({
        severity: "warning",
        category: "kill_list",
        message: '"very" — kill list violation',
        anchor: { prefix: "She was ", focus: "very", suffix: " happy to" },
        charRange: { start: 184, end: 188 },
      }),
      makeEditorialAnnotation({
        severity: "critical",
        category: "kill_list",
        message: '"suddenly" — kill list violation',
        anchor: { prefix: "she said ", focus: "suddenly", suffix: "." },
        charRange: { start: 262, end: 270 },
      }),
      makeEditorialAnnotation({
        severity: "info",
        category: "show_dont_tell",
        message: "Consider showing emotion through action rather than stating it",
        anchor: { prefix: "was ", focus: "very happy to see", suffix: " the garden" },
        charRange: { start: 184, end: 205 },
      }),
    ],
  },
};

export const WithSuggestion: Story = {
  args: {
    text: SAMPLE_TEXT,
    annotations: [
      makeEditorialAnnotation({
        severity: "warning",
        category: "vocabulary",
        message: '"very" — prefer stronger adjective',
        suggestion: "thrilled",
        anchor: { prefix: "She was ", focus: "very happy", suffix: " to see" },
        charRange: { start: 184, end: 194 },
      }),
    ],
  },
};
