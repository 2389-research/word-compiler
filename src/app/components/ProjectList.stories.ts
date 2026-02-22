import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeProject } from "../stories/factories.js";
import ProjectList from "./ProjectList.svelte";

const meta: Meta<ProjectList> = {
  title: "Components/ProjectList",
  component: ProjectList,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Multi-project selector — lists projects with status badges and provides create/delete actions.",
      },
    },
  },
  args: {
    projects: [],
    onSelectProject: fn(),
    onCreateProject: fn(),
    onDeleteProject: fn(),
  },
};

export default meta;
type Story = StoryObj<ProjectList>;

export const Empty: Story = {};

export const SingleProject: Story = {
  args: {
    projects: [makeProject({ title: "The Letter", status: "drafting" })],
  },
};

export const MixedStatuses: Story = {
  args: {
    projects: [
      makeProject({ title: "The Letter", status: "drafting" }),
      makeProject({ title: "Summer Noir", status: "planning" }),
      makeProject({ title: "First Light", status: "revising" }),
      makeProject({ title: "Untitled", status: "bootstrap" }),
    ],
  },
};

export const AllStatuses: Story = {
  args: {
    projects: [
      makeProject({ title: "The Letter", status: "drafting" }),
      makeProject({ title: "Summer Noir", status: "planning" }),
      makeProject({ title: "First Light", status: "revising" }),
      makeProject({ title: "Untitled Sketch", status: "bootstrap" }),
      makeProject({ title: "The Harbor", status: "bible" }),
      makeProject({ title: "Red Lantern", status: "drafting" }),
      makeProject({ title: "After the Storm", status: "revising" }),
      makeProject({ title: "New Idea", status: "bootstrap" }),
    ],
  },
};
