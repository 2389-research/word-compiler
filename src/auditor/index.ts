import { countWords } from "../tokens/index.js";
import type {
  AuditFlag,
  AuditStats,
  Bible,
  KillListEntry,
  NarrativeIR,
  ProseMetrics,
  ScenePlan,
} from "../types/index.js";
import { generateId } from "../types/index.js";
import { checkEpistemicLeaks } from "./epistemic.js";
import { checkSetupPayoff } from "./setupPayoff.js";

// ─── Kill List ──────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLineReference(prose: string, matchIndex: number): string {
  const upTo = prose.slice(0, matchIndex);
  const line = upTo.split("\n").length;
  return `line ${line}`;
}

export function checkKillList(prose: string, killList: KillListEntry[], sceneId: string): AuditFlag[] {
  const flags: AuditFlag[] = [];

  for (const entry of killList) {
    if (entry.type !== "exact") continue;

    const regex = new RegExp(escapeRegex(entry.pattern), "gi");
    const matches = [...prose.matchAll(regex)];

    for (const match of matches) {
      flags.push({
        id: generateId(),
        sceneId,
        severity: "critical",
        category: "kill_list",
        message: `Avoid list violation: "${entry.pattern}" found.`,
        lineReference: getLineReference(prose, match.index!),
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  return flags;
}

// ─── Sentence Splitting ─────────────────────────────────

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/Mr\./g, "Mr\u0000"],
  [/Mrs\./g, "Mrs\u0000"],
  [/Dr\./g, "Dr\u0000"],
  [/Ms\./g, "Ms\u0000"],
  [/St\./g, "St\u0000"],
  [/Jr\./g, "Jr\u0000"],
  [/Sr\./g, "Sr\u0000"],
];

export function splitSentences(text: string): string[] {
  if (text.trim().length === 0) return [];

  let cleaned = text;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  const raw = cleaned.split(/[.!?]\s+(?=[A-Z"])/);

  // Restore abbreviations and trim
  return raw.map((s) => s.replace(/\u0000/g, ".").trim()).filter((s) => s.length > 0);
}

// ─── Sentence Variance ─────────────────────────────────

export function checkSentenceVariance(prose: string, sceneId: string): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const sentences = splitSentences(prose);
  const lengths = sentences.map((s) => countWords(s));

  if (lengths.length < 5) return flags;

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const stddev = Math.sqrt(lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length);

  if (stddev < 3.0) {
    flags.push({
      id: generateId(),
      sceneId,
      severity: "warning",
      category: "rhythm_monotony",
      message: `Sentence length variance is ${stddev.toFixed(1)} (target: >3.0). Prose may feel rhythmically flat.`,
      lineReference: null,
      resolved: false,
      resolvedAction: null,
      wasActionable: null,
    });
  }

  // Check 4+ consecutive similar-length sentences (within ±3 words)
  const MAX_RHYTHM_FLAGS = 3;
  let rhythmFlagCount = 0;
  for (let i = 0; i < lengths.length - 3 && rhythmFlagCount < MAX_RHYTHM_FLAGS; i++) {
    const window = lengths.slice(i, i + 4);
    const minLen = Math.min(...window);
    const maxLen = Math.max(...window);
    if (maxLen - minLen <= 3) {
      flags.push({
        id: generateId(),
        sceneId,
        severity: "info",
        category: "rhythm_monotony",
        message: `4+ consecutive sentences of similar length (${window.join(", ")} words) near: "${sentences[i]!.slice(0, 50)}..."`,
        lineReference: getLineReference(prose, prose.indexOf(sentences[i]!)),
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
      rhythmFlagCount++;
      i += 3; // skip past this window to avoid overlapping flags
    }
  }

  return flags;
}

// ─── Paragraph Length ───────────────────────────────────

export function checkParagraphLength(prose: string, maxSentences: number | null, sceneId: string): AuditFlag[] {
  if (!maxSentences) return [];

  const flags: AuditFlag[] = [];
  const paragraphs = prose.split(/\n\n+/);

  for (const para of paragraphs) {
    const sentenceCount = splitSentences(para).length;
    if (sentenceCount > maxSentences) {
      const overBy = sentenceCount - maxSentences;
      flags.push({
        id: generateId(),
        sceneId,
        severity: overBy >= 2 ? "warning" : "info",
        category: "paragraph_length",
        message: `Paragraph has ${sentenceCount} sentences (max: ${maxSentences}): "${para.slice(0, 60)}..."`,
        lineReference: getLineReference(prose, prose.indexOf(para)),
        resolved: false,
        resolvedAction: null,
        wasActionable: null,
      });
    }
  }

  return flags;
}

// ─── Metrics ────────────────────────────────────────────

export function computeMetrics(prose: string): ProseMetrics {
  const words = countWords(prose);
  const sentences = splitSentences(prose);
  const allWords = prose.toLowerCase().match(/\b\w+\b/g) || [];
  const uniqueWords = new Set(allWords);
  const paragraphs = prose.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const sentenceLengths = sentences.map((s) => countWords(s));
  const mean = sentenceLengths.length > 0 ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
  const variance =
    sentenceLengths.length > 0
      ? Math.sqrt(sentenceLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / sentenceLengths.length)
      : 0;

  return {
    wordCount: words,
    sentenceCount: sentences.length,
    avgSentenceLength: sentences.length > 0 ? words / sentences.length : 0,
    sentenceLengthStdDev: variance,
    typeTokenRatio: allWords.length > 0 ? uniqueWords.size / allWords.length : 0,
    paragraphCount: paragraphs.length,
    avgParagraphLength: paragraphs.length > 0 ? sentences.length / paragraphs.length : 0,
  };
}

// ─── Audit Stats ───────────────────────────────────────

export function getAuditStats(flags: AuditFlag[]): AuditStats {
  const resolved = flags.filter((f) => f.resolved && f.wasActionable === true);
  const dismissed = flags.filter((f) => f.resolved && f.wasActionable === false);
  const pending = flags.filter((f) => !f.resolved);
  const actionable = resolved.length;
  const nonActionable = dismissed.length;
  const decided = actionable + nonActionable;
  const signalToNoiseRatio = decided > 0 ? actionable / decided : 1;

  const byCategory: Record<string, { total: number; actionable: number }> = {};
  for (const flag of flags) {
    if (!byCategory[flag.category]) {
      byCategory[flag.category] = { total: 0, actionable: 0 };
    }
    byCategory[flag.category]!.total++;
    if (flag.wasActionable === true) {
      byCategory[flag.category]!.actionable++;
    }
  }

  return {
    total: flags.length,
    resolved: resolved.length,
    dismissed: dismissed.length,
    pending: pending.length,
    actionable,
    nonActionable,
    signalToNoiseRatio,
    byCategory,
  };
}

// ─── IR Audit Options ───────────────────────────────────

export interface IRAuditContext {
  sceneIR: NarrativeIR;
  allPriorIRs: NarrativeIR[];
  plan: ScenePlan;
}

// ─── Convenience ────────────────────────────────────────

export function runAudit(
  prose: string,
  bible: Bible,
  sceneId: string,
  irContext?: IRAuditContext,
): { flags: AuditFlag[]; metrics: ProseMetrics } {
  const flags: AuditFlag[] = [
    ...checkKillList(prose, bible.styleGuide.killList, sceneId),
    ...checkSentenceVariance(prose, sceneId),
    ...checkParagraphLength(prose, bible.styleGuide.paragraphPolicy?.maxSentences ?? null, sceneId),
  ];

  // IR-driven checks (only when IR context is provided with verified IRs)
  if (irContext?.sceneIR?.verified) {
    flags.push(...checkEpistemicLeaks(irContext.sceneIR, irContext.allPriorIRs, bible));
    flags.push(...checkSetupPayoff(irContext.sceneIR, irContext.plan, bible));
  }

  const metrics = computeMetrics(prose);

  return { flags, metrics };
}
