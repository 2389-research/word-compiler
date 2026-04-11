import type { Meta, StoryObj } from "@storybook/svelte";
import { makeNarrativeIR } from "../stories/factories.js";
import SetupPayoffPanel from "./SetupPayoffPanel.svelte";

const meta: Meta<SetupPayoffPanel> = {
  title: "Components/SetupPayoffPanel",
  component: SetupPayoffPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Tracks narrative setups and their payoffs across sections, highlighting dangling setups that lack resolution.",
      },
    },
  },
  args: {
    sceneIRs: {},
    sceneTitles: {},
    sceneOrders: {},
  },
};

export default meta;
type Story = StoryObj<SetupPayoffPanel>;

export const Empty: Story = {};

export const AllDangling: Story = {
  args: {
    sceneIRs: {
      s1: makeNarrativeIR({
        sceneId: "s1",
        verified: true,
        setupsPlanted: ["The locked drawer in Marcus's desk", "Elena's missing photograph"],
        payoffsExecuted: [],
      }),
    },
    sceneTitles: { s1: "The Discovery" },
    sceneOrders: { s1: 0 },
  },
};

export const AllResolved: Story = {
  args: {
    sceneIRs: {
      s1: makeNarrativeIR({
        sceneId: "s1",
        verified: true,
        setupsPlanted: ["The locked drawer in Marcus's desk"],
        payoffsExecuted: [],
      }),
      s2: makeNarrativeIR({
        sceneId: "s2",
        verified: true,
        setupsPlanted: [],
        payoffsExecuted: ["The locked drawer in Marcus's desk"],
      }),
    },
    sceneTitles: { s1: "The Discovery", s2: "The Confrontation" },
    sceneOrders: { s1: 0, s2: 1 },
  },
};

export const Mixed: Story = {
  args: {
    sceneIRs: {
      s1: makeNarrativeIR({
        sceneId: "s1",
        verified: true,
        setupsPlanted: ["The locked drawer", "Elena's missing photograph", "The unsigned letter"],
        payoffsExecuted: [],
      }),
      s2: makeNarrativeIR({
        sceneId: "s2",
        verified: true,
        setupsPlanted: ["Bob's alibi"],
        payoffsExecuted: ["The locked drawer"],
      }),
      s3: makeNarrativeIR({
        sceneId: "s3",
        verified: true,
        setupsPlanted: [],
        payoffsExecuted: ["The unsigned letter"],
      }),
    },
    sceneTitles: { s1: "The Discovery", s2: "The Confrontation", s3: "The Reckoning" },
    sceneOrders: { s1: 0, s2: 1, s3: 2 },
  },
};

export const FiveSceneEpic: Story = {
  args: {
    sceneIRs: {
      s1: makeNarrativeIR({
        sceneId: "s1",
        verified: true,
        setupsPlanted: [
          "The locked drawer in Marcus's desk",
          "Elena's missing photograph",
          "The unsigned letter",
          "Tomás's press badge",
        ],
        payoffsExecuted: [],
      }),
      s2: makeNarrativeIR({
        sceneId: "s2",
        verified: true,
        setupsPlanted: ["Bob's alibi", "The second key"],
        payoffsExecuted: ["The locked drawer in Marcus's desk"],
      }),
      s3: makeNarrativeIR({
        sceneId: "s3",
        verified: true,
        setupsPlanted: ["The harbor meeting"],
        payoffsExecuted: ["The unsigned letter", "Tomás's press badge"],
      }),
      s4: makeNarrativeIR({
        sceneId: "s4",
        verified: true,
        setupsPlanted: [],
        payoffsExecuted: ["Bob's alibi", "The second key"],
      }),
      s5: makeNarrativeIR({
        sceneId: "s5",
        verified: true,
        setupsPlanted: [],
        payoffsExecuted: ["The harbor meeting"],
      }),
    },
    sceneTitles: {
      s1: "The Discovery",
      s2: "The Confrontation",
      s3: "The Harbor",
      s4: "The Reckoning",
      s5: "The Aftermath",
    },
    sceneOrders: { s1: 0, s2: 1, s3: 2, s4: 3, s5: 4 },
  },
};
