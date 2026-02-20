import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeChunk, makeSceneEntry } from "../stories/factories.js";
import SceneSequencer from "./SceneSequencer.svelte";

const meta: Meta<SceneSequencer> = {
  title: "Components/SceneSequencer",
  component: SceneSequencer,
  parameters: { layout: "fullscreen" },
  args: {
    onSelectScene: fn(),
  },
};

export default meta;
type Story = StoryObj<SceneSequencer>;

export const MultipleScenes: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "The Arrival", "complete"),
      makeSceneEntry("s2", "The Confrontation", "drafting"),
      makeSceneEntry("s3", "The Revelation", "planned"),
      makeSceneEntry("s4", "The Escape", "planned"),
    ],
    activeSceneIndex: 1,
    sceneChunks: {
      s1: [makeChunk({ sceneId: "s1", status: "accepted" })],
      s2: [makeChunk({ sceneId: "s2" })],
    },
  },
};

export const SingleScene: Story = {
  args: {
    scenes: [makeSceneEntry("s1", "Opening", "drafting")],
    activeSceneIndex: 0,
    sceneChunks: {},
  },
};

export const AllComplete: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "Act I", "complete"),
      makeSceneEntry("s2", "Act II", "complete"),
      makeSceneEntry("s3", "Act III", "complete"),
    ],
    activeSceneIndex: 2,
    sceneChunks: {},
  },
};

export const EmptyProject: Story = {
  args: {
    scenes: [],
    activeSceneIndex: 0,
    sceneChunks: {},
  },
};

export const ManyScenes: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "The Departure", "complete"),
      makeSceneEntry("s2", "The Journey", "complete"),
      makeSceneEntry("s3", "The Arrival", "complete"),
      makeSceneEntry("s4", "The Discovery", "drafting"),
      makeSceneEntry("s5", "The Confrontation", "planned"),
      makeSceneEntry("s6", "The Betrayal", "planned"),
      makeSceneEntry("s7", "The Escape", "planned"),
      makeSceneEntry("s8", "The Return", "planned"),
    ],
    activeSceneIndex: 3,
    sceneChunks: {
      s1: [makeChunk({ sceneId: "s1", status: "accepted" }), makeChunk({ sceneId: "s1", status: "accepted" })],
      s4: [makeChunk({ sceneId: "s4" })],
    },
  },
};
