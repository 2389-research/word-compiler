import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeNarrativeIR, makeScenePlan } from "../stories/factories.js";
import ForwardSimulator from "./ForwardSimulator.svelte";

function makeNode(id: string, title: string, order: number, ir: ReturnType<typeof makeNarrativeIR> | null = null) {
  return {
    plan: makeScenePlan({ id, title }),
    ir,
    sceneOrder: order,
  };
}

const meta: Meta<ForwardSimulator> = {
  title: "Components/ForwardSimulator",
  component: ForwardSimulator,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Visual scene flow graph showing narrative IR propagation across scenes — facts revealed, tensions resolved/introduced, and character arcs.",
      },
    },
  },
  args: {
    onSelectScene: fn(),
  },
};

export default meta;
type Story = StoryObj<ForwardSimulator>;

export const LinearFlow: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Arrival",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          events: ["Elena arrived at the house"],
          factsRevealedToReader: ["The house has been empty for months"],
          unresolvedTensions: ["Why was Elena summoned?"],
        }),
      ),
      makeNode(
        "s2",
        "The Letter",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: true,
          events: ["Elena found the letter", "She read its contents"],
          factsRevealedToReader: ["Marcus wrote the letter", "The letter mentions a hidden room"],
          unresolvedTensions: ["Why was Elena summoned?", "Where is the hidden room?"],
        }),
      ),
      makeNode(
        "s3",
        "The Confrontation",
        2,
        makeNarrativeIR({
          sceneId: "s3",
          verified: true,
          events: ["Bob appeared at the window", "Elena confronted him"],
          factsRevealedToReader: ["Bob knew about the letter"],
          unresolvedTensions: ["Where is the hidden room?", "Is Bob dangerous?"],
        }),
      ),
      makeNode(
        "s4",
        "The Escape",
        3,
        makeNarrativeIR({
          sceneId: "s4",
          verified: true,
          events: ["Elena escaped through the garden"],
          factsRevealedToReader: ["The hidden room was behind the bookshelf"],
          unresolvedTensions: ["Is Bob dangerous?"],
        }),
      ),
    ],
    activeSceneIndex: 0,
  },
};

export const WithTensions: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Setup",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          factsRevealedToReader: ["Alice is investigating corruption"],
          unresolvedTensions: ["Who is the source?", "Can Alice trust her editor?"],
        }),
      ),
      makeNode(
        "s2",
        "The Twist",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: true,
          factsRevealedToReader: ["The editor is connected to the conspiracy"],
          unresolvedTensions: ["Can Alice trust her editor?", "Who else is involved?", "Will Alice be discovered?"],
        }),
      ),
      makeNode(
        "s3",
        "The Resolution",
        2,
        makeNarrativeIR({
          sceneId: "s3",
          verified: true,
          factsRevealedToReader: ["The conspiracy reaches the mayor's office"],
          unresolvedTensions: ["Will Alice be discovered?"],
        }),
      ),
    ],
    activeSceneIndex: 1,
  },
};

export const MixedIR: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Arrival",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          events: ["Elena arrived"],
          factsRevealedToReader: ["The house is abandoned"],
        }),
      ),
      makeNode(
        "s2",
        "The Discovery",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: false,
          events: ["She found clues"],
        }),
      ),
      makeNode("s3", "The Confrontation", 2),
      makeNode("s4", "The Escape", 3),
    ],
    activeSceneIndex: 2,
  },
};

export const SingleScene: Story = {
  args: {
    scenes: [makeNode("s1", "Opening", 0)],
    activeSceneIndex: 0,
  },
};

export const ActiveMiddle: Story = {
  args: {
    scenes: [
      makeNode("s1", "Act I: Setup", 0, makeNarrativeIR({ sceneId: "s1", verified: true })),
      makeNode("s2", "Act II: Confrontation", 1, makeNarrativeIR({ sceneId: "s2", verified: true })),
      makeNode("s3", "Act III: Climax", 2),
      makeNode("s4", "Act IV: Resolution", 3),
    ],
    activeSceneIndex: 2,
  },
};
