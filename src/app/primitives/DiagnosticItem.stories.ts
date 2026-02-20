import type { Meta, StoryObj } from "@storybook/svelte";
import DiagnosticItemStory from "./DiagnosticItemStory.svelte";

const meta: Meta<DiagnosticItemStory> = {
  title: "Primitives/DiagnosticItem",
  component: DiagnosticItemStory,
  parameters: { layout: "padded" },
  argTypes: {
    severity: { control: "select", options: ["critical", "error", "warning", "info"] },
  },
};

export default meta;
type Story = StoryObj<DiagnosticItemStory>;

export const ErrorSeverity: Story = {
  args: { severity: "error", code: "R1_OVER_CAP", message: "Ring 1 exceeds hard cap of 2000 tokens (actual: 2340)" },
};

export const Warning: Story = {
  args: { severity: "warning", code: "R3_STARVED", message: "Ring 3 has only 54% of budget; target is 60%+" },
};

export const Info: Story = {
  args: { severity: "info", code: "CHUNK_COUNT", message: "Scene has 3 chunks — within expected range" },
};

export const Critical: Story = {
  args: { severity: "critical", message: 'Kill list violation: "a shiver ran down her spine" in paragraph 2' },
};

export const WithCode: Story = {
  args: { severity: "error", code: "MISSING_SCENE_PLAN", message: "Ring 3 is missing required SCENE_PLAN section" },
};

export const WithActions: Story = {
  args: {
    severity: "warning",
    message: "Low sentence length variance (1.2) — prose may feel monotonous",
    showActions: true,
  },
};
