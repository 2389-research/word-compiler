import type { KillListEntry, StyleGuide, VocabPreference } from "../types/bible.js";

// ─── Canonical Const Arrays ─────────────────────
// Single source of truth: runtime arrays + derived union types.

export const LLM_REVIEW_CATEGORIES = [
  "tone",
  "grammar",
  "voice",
  "punctuation",
  "show_dont_tell",
  "pov",
  "dialogue",
  "metaphor",
  "vocabulary",
  "continuity",
] as const;

export const LOCAL_REVIEW_CATEGORIES = ["kill_list", "rhythm_monotony", "paragraph_length"] as const;

export const SEVERITIES = ["critical", "warning", "info"] as const;

export const ANNOTATION_SCOPES = ["dialogue", "narration", "both"] as const;

// ─── Derived Types ──────────────────────────────

export type LLMReviewCategory = (typeof LLM_REVIEW_CATEGORIES)[number];

export type LocalReviewCategory = (typeof LOCAL_REVIEW_CATEGORIES)[number];

export type ReviewCategory = LLMReviewCategory | LocalReviewCategory;

export type Severity = (typeof SEVERITIES)[number];

export type AnnotationScope = (typeof ANNOTATION_SCOPES)[number];

// ─── Core Annotation ───────────────────────────

export interface EditorialAnnotation {
  id: string;
  category: ReviewCategory;
  severity: Severity;
  scope: AnnotationScope;
  message: string;
  suggestion: string | null;
  anchor: { prefix: string; focus: string; suffix: string };
  charRange: { start: number; end: number };
  spans?: Array<{ start: number; end: number }>;
  fingerprint: string;
}

// ─── Anchor Resolution ─────────────────────────

export interface AnchorMatch {
  start: number;
  end: number;
  confidence: "exact" | "fuzzy" | "failed";
}

// ─── Review Context (pre-filtered bible) ────────

export interface ReviewContext {
  styleRules: {
    killList: KillListEntry[];
    metaphoricRegister: StyleGuide["metaphoricRegister"];
    vocabularyPreferences: VocabPreference[];
    sentenceArchitecture: StyleGuide["sentenceArchitecture"];
    paragraphPolicy: StyleGuide["paragraphPolicy"];
    structuralBans: string[];
  };
  activeVoices: Array<{ name: string; fingerprint: string }>;
  povRules: { distance: string; interiority: string; reliability: string } | null;
  subtextPolicy: string;
  editingInstructions: string;
}

// ─── Review Result ──────────────────────────────

export interface ReviewResult {
  chunkIndex: number;
  annotations: EditorialAnnotation[];
  modelUsed: string;
  reviewedAt: string;
}

// ─── Chunk View (visible chunk for review) ──────

export interface ChunkView {
  index: number;
  text: string;
  sceneId: string;
}

// ─── Suppression ────────────────────────────────

export interface DismissedAnnotation {
  fingerprint: string;
  dismissedAt: string;
  reason?: string;
}

// ─── Orchestrator Interface ─────────────────────

export interface ReviewOrchestrator {
  requestReview(chunks: ChunkView[], force?: boolean): void;
  cancelAll(): void;
  annotations: Map<number, EditorialAnnotation[]>;
  reviewing: Set<number>;
}
