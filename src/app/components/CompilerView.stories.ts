import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import {
  makeAuditFlag,
  makeCompilationLog,
  makeCompiledPayload,
  makeLintResult,
  makeProseMetrics,
} from "../stories/factories.js";
import CompilerView from "./CompilerView.svelte";

const meta: Meta<CompilerView> = {
  title: "Components/CompilerView",
  component: CompilerView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Displays the compiled context payload, token budget breakdown across rings, lint diagnostics, prose metrics, and audit flags. The three-ring budget system allocates tokens: Ring 1 (system message), Ring 2 (chapter context), Ring 3 (scene context).",
      },
    },
  },
  args: {
    auditFlags: [],
    metrics: null,
    onResolveFlag: fn(),
    onDismissFlag: fn(),
  },
};

export default meta;
type Story = StoryObj<CompilerView>;

export const Empty: Story = {
  args: { payload: null, log: null, lintResult: null },
  parameters: {
    docs: {
      description: { story: "No compilation has run yet — the view is in its initial empty state." },
    },
  },
};

export const PayloadOnly: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult(),
  },
  parameters: {
    docs: {
      description: {
        story: "Minimal compilation — payload and budget log present with clean lint, no prose metrics or audit flags.",
      },
    },
  },
};

export const WithPayload: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult([
      { code: "R3_STARVED", severity: "warning", message: "Ring 3 has only 54% of budget; target is 60%+" },
    ]),
    metrics: makeProseMetrics(),
  },
};

export const WithLintErrors: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult([
      { code: "R1_OVER_CAP", severity: "error", message: "Ring 1 exceeds hard cap of 2000 tokens (actual: 2340)" },
      { code: "R3_STARVED", severity: "warning", message: "Ring 3 has only 48% of budget; target is 60%+" },
      { code: "MISSING_SCENE_PLAN", severity: "error", message: "Ring 3 is missing required SCENE_PLAN section" },
    ]),
    metrics: makeProseMetrics(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple lint diagnostics including two errors (R1_OVER_CAP, MISSING_SCENE_PLAN) and one warning (R3_STARVED). Look for red error badges in the lint results section — errors block generation while warnings are advisory.",
      },
    },
  },
};

export const BudgetStarved: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog({
      ring1Tokens: 1800,
      ring2Tokens: 1200,
      ring3Tokens: 1400,
      totalTokens: 4400,
      availableBudget: 8000,
    }),
    lintResult: makeLintResult([
      { code: "R3_STARVED", severity: "warning", message: "Ring 3 has only 32% of budget; target is 60%+" },
      { code: "R2_OVER_CAP", severity: "warning", message: "Ring 2 uses 27% of budget; cap is 25%" },
    ]),
    metrics: makeProseMetrics({ wordCount: 120, sentenceCount: 8 }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Ring 3 (scene context — the most important ring) is severely under-budget at only 32% of available tokens (target is 60%+). Ring 2 (chapter context) is also over its 25% cap at 27%. Look for the R3_STARVED and R2_OVER_CAP lint warnings, and notice how the budget breakdown shows a disproportionately small Ring 3 allocation. This scenario indicates the system/chapter context is crowding out scene-level detail.",
      },
    },
  },
};

export const BudgetOverflow: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog({
      ring1Tokens: 2400,
      ring2Tokens: 800,
      ring3Tokens: 2200,
      totalTokens: 5400,
      availableBudget: 8000,
    }),
    lintResult: makeLintResult([
      { code: "R1_OVER_CAP", severity: "error", message: "Ring 1 exceeds hard cap of 2000 tokens (actual: 2400)" },
    ]),
    metrics: makeProseMetrics(),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Ring 1 (system message) exceeds its hard cap of 2000 tokens at 2400 — this is a blocking error. Look for the R1_OVER_CAP error badge in the lint results. Unlike warnings, this error prevents generation because the system prompt is too large to leave room for the model's response.",
      },
    },
  },
};

export const WithAuditFlags: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult(),
    metrics: makeProseMetrics(),
    auditFlags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: 'Kill list violation: "a shiver ran down her spine" in paragraph 2',
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
  parameters: {
    docs: {
      description: {
        story:
          "Three audit flags of different severities: a critical kill-list violation (cliché phrase), a warning about monotonous sentence rhythm, and an informational note about paragraph length. Look for the colored severity badges and resolve/dismiss actions.",
      },
    },
  },
};

export const AllClear: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog({
      ring1Tokens: 1100,
      ring2Tokens: 700,
      ring3Tokens: 3200,
      totalTokens: 5000,
      availableBudget: 8000,
    }),
    lintResult: makeLintResult(),
    metrics: makeProseMetrics({
      wordCount: 850,
      sentenceCount: 62,
      avgSentenceLength: 13.7,
      sentenceLengthVariance: 5.2,
      typeTokenRatio: 0.71,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Happy path — all systems green. Budget is well-distributed (Ring 3 at 64%), no lint issues, healthy prose metrics with good sentence variance (5.2) and vocabulary diversity (TTR 0.71). This is what a well-tuned compilation looks like.",
      },
    },
  },
};

export const FullWorkload: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult([
      { code: "R3_STARVED", severity: "warning", message: "Ring 3 has only 54% of budget; target is 60%+" },
    ]),
    metrics: makeProseMetrics(),
    auditFlags: [
      makeAuditFlag({
        severity: "critical",
        category: "kill-list",
        message: 'Kill list violation: "suddenly" in paragraph 3',
      }),
      makeAuditFlag({
        severity: "warning",
        category: "epistemic",
        message: "Unreliable narrator POV but no contradictory signals detected",
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Everything populated: compiled payload, budget log, a lint warning (R3 slightly under target), prose metrics, and two audit flags (a critical kill-list violation plus an epistemic warning). Represents a typical mid-draft compilation with issues to address.",
      },
    },
  },
};

export const NoMetrics: Story = {
  args: {
    payload: makeCompiledPayload(),
    log: makeCompilationLog(),
    lintResult: makeLintResult(),
    metrics: null,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Compilation complete with clean lint, but prose metrics haven't been computed yet (no chunks to analyze). The metrics section should be absent or show an empty state.",
      },
    },
  },
};
