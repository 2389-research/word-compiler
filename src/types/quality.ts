// ─── Lint ───────────────────────────────────────────────

export interface LintIssue {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
}

// ─── Audit ──────────────────────────────────────────────

export interface AuditFlag {
  id: string;
  sceneId: string;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  lineReference: string | null;
  resolved: boolean;
  resolvedAction: string | null;
  wasActionable: boolean | null;
}

export interface AuditStats {
  total: number;
  resolved: number;
  dismissed: number;
  pending: number;
  actionable: number;
  nonActionable: number;
  signalToNoiseRatio: number;
  byCategory: Record<string, { total: number; actionable: number }>;
}

// ─── Prose Metrics ──────────────────────────────────────

export interface ProseMetrics {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  typeTokenRatio: number;
  paragraphCount: number;
  avgParagraphLength: number;
}
