import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import type { Project } from "../../types/index.js";
import { generateId } from "../../types/index.js";
import ProjectList from "./ProjectList.svelte";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: generateId(),
    title: "Untitled Project",
    status: "bootstrap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

export const MultipleProjects: Story = {
  args: {
    projects: [
      makeProject({ title: "The Letter", status: "drafting" }),
      makeProject({ title: "Summer Noir", status: "planning" }),
      makeProject({ title: "First Light", status: "revising" }),
      makeProject({ title: "Untitled", status: "bootstrap" }),
    ],
  },
};

export const WithDelete: Story = {
  args: {
    projects: [
      makeProject({ title: "Active Story", status: "drafting" }),
      makeProject({ title: "Old Draft", status: "bible" }),
    ],
  },
};
