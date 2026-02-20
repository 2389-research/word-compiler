import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import Tabs from "./Tabs.svelte";

const meta: Meta<Tabs> = {
  title: "Primitives/Tabs",
  component: Tabs,
};

export default meta;
type Story = StoryObj<Tabs>;

export const Default: Story = {
  args: {
    items: [
      { id: "compiler", label: "Compiler" },
      { id: "ir", label: "IR Inspector" },
      { id: "simulator", label: "Forward Sim" },
      { id: "drift", label: "Style Drift" },
      { id: "voice", label: "Voice Sep" },
    ],
    active: "compiler",
    onSelect: fn(),
  },
};

export const ManyTabs: Story = {
  args: {
    items: [
      { id: "tab1", label: "Overview" },
      { id: "tab2", label: "Characters" },
      { id: "tab3", label: "Locations" },
      { id: "tab4", label: "Timeline" },
      { id: "tab5", label: "Themes" },
      { id: "tab6", label: "Arcs" },
      { id: "tab7", label: "Notes" },
      { id: "tab8", label: "Export" },
    ],
    active: "tab3",
    onSelect: fn(),
  },
};

export const SingleTab: Story = {
  args: {
    items: [{ id: "only", label: "Only Tab" }],
    active: "only",
    onSelect: fn(),
  },
};
