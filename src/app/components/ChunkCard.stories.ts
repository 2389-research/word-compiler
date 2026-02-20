import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeChunk } from "../stories/factories.js";
import ChunkCard from "./ChunkCard.svelte";

const meta: Meta<ChunkCard> = {
  title: "Components/ChunkCard",
  component: ChunkCard,
  args: {
    index: 0,
    isLast: true,
    onUpdate: fn(),
    onRemove: fn(),
  },
  argTypes: {
    index: { control: "number" },
    isLast: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<ChunkCard>;

export const Pending: Story = {
  args: { chunk: makeChunk() },
};

export const Accepted: Story = {
  args: { chunk: makeChunk({ status: "accepted" }) },
};

export const Edited: Story = {
  args: {
    chunk: makeChunk({
      status: "edited",
      editedText: "The rain fell softly against the window. Elena pressed her forehead to the cool glass.",
    }),
  },
};

export const Rejected: Story = {
  args: { chunk: makeChunk({ status: "rejected" }), isLast: true },
};

export const WithNotes: Story = {
  args: {
    chunk: makeChunk({ humanNotes: "Make the next chunk more atmospheric. Focus on sound." }),
  },
};

export const NotLast: Story = {
  args: { chunk: makeChunk(), isLast: false },
};

export const LongText: Story = {
  args: {
    chunk: makeChunk({
      generatedText: [
        "The rain fell in sheets against the window, each drop a tiny percussion in the symphony of the storm.",
        "Elena pressed her forehead to the glass, watching the world dissolve into watercolor.",
        "The old house groaned around her, its timbers shifting in the wind like the hull of a ship at sea.",
        "She could hear the water rushing through the gutters, a continuous murmur that seemed to rise from the foundations themselves.",
        "In the study below, her father's desk lamp still burned, casting a warm rectangle of light across the garden path.",
        "She wondered if he was still reading, or if he'd fallen asleep in his chair again, his glasses sliding down his nose,",
        "the book open on his chest like a small tent pitched over his heart.",
        "The thought made her smile, and then the smile faded, because she remembered that the study was empty now.",
        "It had been empty for three months. The lamp was on a timer.",
      ].join(" "),
    }),
  },
};

export const EditMode: Story = {
  args: {
    chunk: makeChunk({
      status: "edited",
      editedText:
        "The rain fell softly. Elena touched the cold glass. Outside, the world was dissolving — not slowly, but in great sheets of grey that swallowed the garden, the street, the horizon.",
      humanNotes: "Tightened the opening, added specificity to the dissolving image.",
    }),
  },
};
