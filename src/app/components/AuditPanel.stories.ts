import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeAuditFlag } from "../stories/factories.js";
import AuditPanel from "./AuditPanel.svelte";

const meta: Meta<AuditPanel> = {
  title: "Components/AuditPanel",
  component: AuditPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Displays prose audit flags (kill-list violations, sentence variance, paragraph length, epistemic, subtext) with severity badges and resolve/dismiss actions.",
      },
    },
  },
  args: {
    onResolve: fn(),
    onDismiss: fn(),
  },
};

export default meta;
type Story = StoryObj<AuditPanel>;

export const NoFlags: Story = {
  args: { flags: [] },
};

export const MixedFlags: Story = {
  args: {
    flags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: '"A shiver ran down her spine" — avoid list violation',
        lineReference: "P2",
      }),
      makeAuditFlag({
        severity: "warning",
        category: "sentence-variance",
        message: "Low sentence length variance (1.2) — prose may feel monotonous",
      }),
      makeAuditFlag({
        severity: "info",
        category: "paragraph-length",
        message: "Paragraph 4 has 8 sentences — consider splitting",
      }),
    ],
  },
};

export const AllResolved: Story = {
  args: {
    flags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: '"suddenly" removed from paragraph 3',
        resolved: true,
        resolvedAction: "Replaced with specific sensory detail",
        wasActionable: true,
      }),
      makeAuditFlag({
        severity: "warning",
        category: "sentence-variance",
        message: "Variance improved to 4.8 after rewrite",
        resolved: true,
        resolvedAction: "Added two short sentences to break rhythm",
        wasActionable: true,
      }),
      makeAuditFlag({
        severity: "info",
        category: "paragraph-length",
        message: "Paragraph split into two",
        resolved: true,
        resolvedAction: "",
        wasActionable: false,
      }),
    ],
  },
};

export const ManyFlags: Story = {
  args: {
    flags: [
      makeAuditFlag({ severity: "critical", category: "kill-list", message: '"suddenly" in paragraph 1' }),
      makeAuditFlag({ severity: "critical", category: "kill-list", message: '"couldn\'t help but" in paragraph 3' }),
      makeAuditFlag({
        severity: "warning",
        category: "sentence-variance",
        message: "Low variance (1.4) in section body",
      }),
      makeAuditFlag({
        severity: "warning",
        category: "epistemic",
        message: "Unreliable narrator but no contradictory signals",
      }),
      makeAuditFlag({ severity: "warning", category: "subtext", message: "Writing too on-the-nose in paragraph 5" }),
      makeAuditFlag({ severity: "info", category: "paragraph-length", message: "Paragraph 2 has 7 sentences" }),
      makeAuditFlag({ severity: "info", category: "paragraph-length", message: "Paragraph 6 has 9 sentences" }),
      makeAuditFlag({ severity: "info", category: "setup-payoff", message: "Dangling setup: garden shed key" }),
      makeAuditFlag({
        severity: "warning",
        category: "kill-list",
        message: '"a wave of" in paragraph 7',
        resolved: true,
        resolvedAction: "Replaced with concrete sensory detail",
        wasActionable: true,
      }),
      makeAuditFlag({
        severity: "info",
        category: "paragraph-length",
        message: "Paragraph 4 has 6 sentences",
        resolved: true,
        resolvedAction: "",
        wasActionable: false,
      }),
    ],
  },
};

export const SingleCritical: Story = {
  args: {
    flags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: '"eyes widened in shock" — cliché avoid list violation',
        lineReference: "P1 S3",
      }),
    ],
  },
};
