import type { Bible } from "../types/index.js";

// ─── Types ───────────────────────────────────────

export interface GenreTemplate {
  id: string;
  name: string;
  description: string;
  /** Partial Bible fields to merge. Only fills blank/default user values. */
  bible: GenreDefaults;
}

/** The subset of Bible fields that a genre template can pre-fill. */
export interface GenreDefaults {
  pov?: {
    default?: "first" | "close-third" | "distant-third" | "omniscient";
    distance?: "intimate" | "close" | "moderate" | "distant";
    interiority?: "stream" | "filtered" | "behavioral-only";
  };
  killList?: Array<{ pattern: string; type: "exact" | "structural" }>;
  metaphoricRegister?: {
    approvedDomains?: string[];
    prohibitedDomains?: string[];
  };
  sentenceArchitecture?: {
    targetVariance?: string;
    fragmentPolicy?: string;
    notes?: string;
  };
  paragraphPolicy?: {
    maxSentences?: number;
    singleSentenceFrequency?: string;
    notes?: string;
  };
  structuralBans?: string[];
  subtextPolicy?: string;
  expositionPolicy?: string;
}

// ─── Templates ───────────────────────────────────

export const LITERARY_FICTION: GenreTemplate = {
  id: "literary-fiction",
  name: "Literary Fiction",
  description: "Character-driven prose with emphasis on interiority, subtext, and precise language.",
  bible: {
    pov: {
      default: "close-third",
      distance: "intimate",
      interiority: "filtered",
    },
    killList: [
      { pattern: "suddenly", type: "exact" },
      { pattern: "a sense of", type: "exact" },
      { pattern: "couldn't help but", type: "exact" },
      { pattern: "in that moment", type: "exact" },
      { pattern: "it was as if", type: "structural" },
    ],
    metaphoricRegister: {
      approvedDomains: ["landscape", "weather", "body", "architecture"],
      prohibitedDomains: ["warfare", "machinery"],
    },
    sentenceArchitecture: {
      targetVariance: "high",
      fragmentPolicy: "occasional for emphasis",
      notes: "Vary sentence length deliberately. Long sentences for interiority, short for impact.",
    },
    paragraphPolicy: {
      maxSentences: 6,
      singleSentenceFrequency: "frequent",
      notes: "Single-sentence paragraphs for emotional beats.",
    },
    structuralBans: ["rhetorical questions in narration", "direct address to reader"],
    subtextPolicy: "Characters rarely say what they mean. Surface dialogue must differ from actual intent.",
    expositionPolicy: "Reveal through action and observation, never through narrator summary.",
  },
};

export const THRILLER: GenreTemplate = {
  id: "thriller",
  name: "Thriller",
  description: "Fast-paced, tension-driven prose with short chapters and cliffhanger scene endings.",
  bible: {
    pov: {
      default: "close-third",
      distance: "close",
      interiority: "behavioral-only",
    },
    killList: [
      { pattern: "little did they know", type: "structural" },
      { pattern: "unbeknownst to", type: "exact" },
      { pattern: "a chill ran down", type: "exact" },
      { pattern: "heart pounded", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["predator-prey", "machinery", "shadows"],
      prohibitedDomains: ["flowers", "gentle nature"],
    },
    sentenceArchitecture: {
      targetVariance: "extreme",
      fragmentPolicy: "frequent for tension",
      notes: "Short, punchy sentences in action. Fragments drive pace. Longer sentences only for setup.",
    },
    paragraphPolicy: {
      maxSentences: 4,
      singleSentenceFrequency: "very frequent",
      notes: "One-line paragraphs for shock moments.",
    },
    structuralBans: ["extended flashbacks mid-action", "philosophical digressions"],
    subtextPolicy: "Characters lie and conceal. Let the reader see the gap between words and behavior.",
    expositionPolicy: "Drip-feed only what the reader needs to follow the next beat.",
  },
};

export const ROMANCE: GenreTemplate = {
  id: "romance",
  name: "Romance",
  description: "Emotionally rich prose centered on relationship dynamics and internal conflict.",
  bible: {
    pov: {
      default: "close-third",
      distance: "intimate",
      interiority: "stream",
    },
    killList: [
      { pattern: "orbs", type: "exact" },
      { pattern: "ministrations", type: "exact" },
      { pattern: "member", type: "exact" },
      { pattern: "pooling heat", type: "exact" },
      { pattern: "couldn't help but", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["weather", "temperature", "music", "water"],
      prohibitedDomains: ["warfare", "clinical terminology"],
    },
    sentenceArchitecture: {
      targetVariance: "moderate",
      fragmentPolicy: "for emotional peaks only",
      notes: "Flowing sentences for emotional interiority. Clipped dialogue for tension between characters.",
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "moderate",
      notes: "Single-sentence paragraphs for emotional realizations.",
    },
    structuralBans: ["head-hopping within scenes", "telling emotions instead of showing physical responses"],
    subtextPolicy: "Characters say one thing but their body language and actions reveal true feelings.",
    expositionPolicy: "Backstory through dialogue and memory fragments, never narrator info-dump.",
  },
};

export const SCI_FI: GenreTemplate = {
  id: "sci-fi",
  name: "Science Fiction",
  description: "Speculative prose balancing world-building with character-driven narrative.",
  bible: {
    pov: {
      default: "close-third",
      distance: "moderate",
      interiority: "filtered",
    },
    killList: [
      { pattern: "it was unlike anything", type: "structural" },
      { pattern: "no words could describe", type: "structural" },
      { pattern: "futuristic", type: "exact" },
      { pattern: "high-tech", type: "exact" },
    ],
    metaphoricRegister: {
      approvedDomains: ["physics", "biology", "stellar phenomena", "architecture"],
      prohibitedDomains: ["anachronistic Earth references", "contemporary brand names"],
    },
    sentenceArchitecture: {
      targetVariance: "moderate",
      fragmentPolicy: "sparingly",
      notes: "Clean, precise sentences for exposition. More variety in character-driven passages.",
    },
    paragraphPolicy: {
      maxSentences: 5,
      singleSentenceFrequency: "occasional",
      notes: "Longer paragraphs acceptable for world-building, but break up with dialogue.",
    },
    structuralBans: ["As you know, Bob exposition", "footnotes or technical appendices in prose"],
    subtextPolicy: "Technology should be shown through use, not explained through lectures.",
    expositionPolicy:
      "World-build through character interaction with environment. Sensory details must have a narrative job — grounding unfamiliar technology or revealing how characters relate to their world. A detail without a purpose is clutter.",
  },
};

export const GENRE_TEMPLATES: GenreTemplate[] = [LITERARY_FICTION, THRILLER, ROMANCE, SCI_FI];

// ─── Apply ──────────────────────────────────────

/** Fill-blank POV fields: only overwrites values still at their factory defaults. */
function applyPovDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (!defaults.pov) return;
  const pov = updated.narrativeRules.pov;
  if (defaults.pov.default && pov.default === "close-third") pov.default = defaults.pov.default;
  if (defaults.pov.distance && pov.distance === "close") pov.distance = defaults.pov.distance;
  if (defaults.pov.interiority && pov.interiority === "filtered") pov.interiority = defaults.pov.interiority;
}

/** Fill-blank kill list: only if empty. */
function applyKillListDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.killList && updated.styleGuide.killList.length === 0) {
    updated.styleGuide.killList = [...defaults.killList];
  }
}

/** Fill-blank metaphoric register: only if null. */
function applyMetaphoricDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.metaphoricRegister && !updated.styleGuide.metaphoricRegister) {
    updated.styleGuide.metaphoricRegister = {
      approvedDomains: defaults.metaphoricRegister.approvedDomains ?? [],
      prohibitedDomains: defaults.metaphoricRegister.prohibitedDomains ?? [],
    };
  }
}

/** Fill-blank sentence architecture: only if null. */
function applySentenceDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.sentenceArchitecture && !updated.styleGuide.sentenceArchitecture) {
    updated.styleGuide.sentenceArchitecture = {
      targetVariance: defaults.sentenceArchitecture.targetVariance ?? null,
      fragmentPolicy: defaults.sentenceArchitecture.fragmentPolicy ?? null,
      notes: defaults.sentenceArchitecture.notes ?? null,
    };
  }
}

/** Fill-blank paragraph policy: only if null. */
function applyParagraphDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.paragraphPolicy && !updated.styleGuide.paragraphPolicy) {
    updated.styleGuide.paragraphPolicy = {
      maxSentences: defaults.paragraphPolicy.maxSentences ?? null,
      singleSentenceFrequency: defaults.paragraphPolicy.singleSentenceFrequency ?? null,
      notes: defaults.paragraphPolicy.notes ?? null,
    };
  }
}

/** Fill-blank structural bans: only if empty. */
function applyStructuralBanDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.structuralBans && updated.styleGuide.structuralBans.length === 0) {
    updated.styleGuide.structuralBans = [...defaults.structuralBans];
  }
}

/** Fill-blank narrative rules (subtext + exposition): only if null. */
function applyNarrativeRuleDefaults(updated: Bible, defaults: GenreDefaults): void {
  if (defaults.subtextPolicy && !updated.narrativeRules.subtextPolicy) {
    updated.narrativeRules.subtextPolicy = defaults.subtextPolicy;
  }
  if (defaults.expositionPolicy && !updated.narrativeRules.expositionPolicy) {
    updated.narrativeRules.expositionPolicy = defaults.expositionPolicy;
  }
}

/**
 * Merge genre template defaults into a bible.
 * Fill-blank strategy: only populates fields that are null, empty, or at default values.
 * Does not overwrite user-set values. Returns a new Bible (does not mutate).
 */
export function applyGenreTemplate(bible: Bible, template: GenreTemplate): Bible {
  const updated = structuredClone(bible);
  const d = template.bible;

  applyPovDefaults(updated, d);
  applyKillListDefaults(updated, d);
  applyMetaphoricDefaults(updated, d);
  applySentenceDefaults(updated, d);
  applyParagraphDefaults(updated, d);
  applyStructuralBanDefaults(updated, d);
  applyNarrativeRuleDefaults(updated, d);

  return updated;
}
