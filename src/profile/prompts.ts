import type { DocumentChunk } from "./types.js";

// ─── System Prompts ──────────────────────────────────────

export const STAGE1_SYSTEM =
  "You are a writing style analyst. Analyze HOW the writer writes, not WHAT they write about. Return structured JSON.";

export const STAGE2_SYSTEM =
  "You are synthesizing style analyses from document chunks into a coherent per-document style profile. Return structured JSON.";

export const STAGE3_SYSTEM =
  "You are identifying stable style patterns across a writer's body of work. Assess transferability for each pattern. Return structured JSON.";

export const STAGE4_SYSTEM =
  "You are advising on cross-domain style transfer. For each feature, decide whether to keep, filter, or flag for shedding. Return structured JSON.";

export const STAGE5_SYSTEM =
  "You are writing a comprehensive voice guide for a writer. Write in clear, direct prose. The guide should be pleasant to read. Follow the exact section structure requested.";

// ─── Stage 1: Per-Chunk Analysis ─────────────────────────

export function buildStage1Prompt(chunk: DocumentChunk): string {
  const parts: string[] = [];

  parts.push(`<position>
Chunk ${chunk.index + 1} of ${chunk.total}
isFirst: ${chunk.isFirst}
isLast: ${chunk.isLast}
</position>`);

  if (chunk.overlapPrev !== null) {
    parts.push(`<overlap_prev>
FOR CONTEXT ONLY, NOT PRIMARY EVIDENCE
${chunk.overlapPrev}
</overlap_prev>`);
  }

  parts.push(`<chunk>
${chunk.text}
</chunk>`);

  if (chunk.overlapNext !== null) {
    parts.push(`<overlap_next>
FOR CONTEXT ONLY, NOT PRIMARY EVIDENCE
${chunk.overlapNext}
</overlap_next>`);
  }

  parts.push(`Analyze HOW this writer writes, not WHAT they write about.

Rules:
- Use paraphrased evidence only — never quote directly.
- Focus on craft choices: sentence rhythm, complexity handling, emotional strategy, voice personality.
- Rate how much this chunk drifts from the author's own voice using contentDriftScore (0.0 to 1.0):
  * 0.0 = pure author voice, no drift
  * 0.1-0.3 = mostly author voice with CMS boilerplate, brief embedded quotes, photo credits, structural elements, or minor non-author content
  * 0.4-0.6 = significant mixed content — extended quotes, embedded documents, or substantial non-author material alongside author voice
  * 0.7-0.9 = predominantly non-author content with some author framing
  * 1.0 = entirely non-author content (e.g., a fully quoted press release or republished document)
- Identify features that would transfer across domains (domain-agnostic features).

Return a JSON object with these fields:
- readerRelationship: string — How does the writer position themselves relative to the reader?
- complexityHandling: string — How does the writer handle complex ideas or information?
- emotionalTexture: string — How does the writer create and manage emotional resonance?
- openPattern: string | null — If this is the first chunk, how does the piece open? Null if not first chunk.
- closePattern: string | null — If this is the last chunk, how does the piece close? Null if not last chunk.
- personalityLeakage: string — What personality traits leak through the prose style?
- violationTest: string — What would feel WRONG if you changed it? What is the writer's signature?
- avoidancePatterns: string[] — What does this writer conspicuously avoid or refuse to do?
- domainAgnosticFeatures: string[] — Style features that would transfer to any genre or format.
- contentDriftScore: number — Rate content drift from 0.0 (pure author voice) to 1.0 (entirely non-author content). CMS boilerplate, brief embedded quotes, and structural elements in an otherwise author-voiced piece should score 0.1-0.3, not 1.0.
- contentDriftNote: string | null — If contentDriftScore > 0.0, explain what non-author content is present and why you scored it as you did.`);

  return parts.join("\n\n");
}

// ─── Stage 2: Document Synthesis ─────────────────────────

export function buildStage2Prompt(
  analysesJson: string,
  driftedIndices: number[],
  format: string | null,
  domain: string | null,
  wordCount: number | null,
  totalChunks: number,
): string {
  const parts: string[] = [];

  parts.push(`Here are the per-chunk style analyses for a single document:

<analyses>
${analysesJson}
</analyses>

Total chunks analyzed: ${totalChunks}`);

  if (driftedIndices.length > 0) {
    parts.push(
      `The following chunk indices were flagged for content drift and should be downweighted: ${driftedIndices.join(", ")}`,
    );
  }

  const metaParts: string[] = [];
  if (format !== null) metaParts.push(`Format: ${format}`);
  if (domain !== null) metaParts.push(`Domain: ${domain}`);
  if (wordCount !== null) metaParts.push(`Word count: ${wordCount}`);
  if (metaParts.length > 0) {
    parts.push(`Document metadata:\n${metaParts.join("\n")}`);
  }

  parts.push(`Synthesize these chunk analyses into a coherent document-level style profile.

Position weighting: The first and last chunks of a document carry 1.5x weight — openings and closings are where a writer's voice is most deliberate.

Instructions:
- Identify features that are CONSISTENT across chunks (these are core style features).
- Identify features that VARY across chunks, noting what conditions trigger the variation.
- Extract dominant voice markers — the handful of features that most define this writer.
- Identify structural patterns — how the writer organizes and sequences.
- Consolidate avoidance patterns — what the writer conspicuously refuses to do.
- Do NOT assign transferability scores — that comes later in cross-document analysis.

Return a JSON object with these fields:
- consistentFeatures: Array<{ name: string, description: string, evidence: string, confidence: "high" | "medium" | "low" }>
- variableFeatures: Array<{ name: string, description: string, formatCondition: string, evidence: string, confidence: "high" | "medium" | "low" }>
- dominantVoiceMarkers: string[]
- structuralPatterns: string[]
- avoidancePatterns: string[]
- rawSummary: string — A brief narrative summary of this writer's style in this document.`);

  return parts.join("\n\n");
}

// ─── Stage 3: Cross-Document Clustering ──────────────────

export function buildStage3Prompt(docAnalysesJson: string, nDocuments: number): string {
  return `Here are style analyses from ${nDocuments} documents by the same writer:

<document_analyses>
${docAnalysesJson}
</document_analyses>

Identify stable patterns across this body of work.

Instructions:
- Cluster similar features across documents. Features that appear in multiple documents with consistent descriptions are likely stable traits.
- For each cluster, assess transferability using this framework:
  * "transferable" — Feature appears across multiple formats/domains, or is clearly a personal voice trait (sentence rhythm, emotional strategy, complexity handling).
  * "domain_specific" — Feature is tied to the conventions of one domain/format (e.g., newsletter sign-offs, academic hedging, genre-specific structures).
  * "uncertain" — Not enough evidence to determine. Appears in only one document, or could be either personal or conventional.
- Identify format-variant features: things the writer does differently depending on format/context.
- Identify domain artifacts: things that look like style but are actually domain conventions.
- Note any evolution signals: has the writer's style shifted across documents (if temporal ordering is evident)?

Transferability heuristics:
- Multiple formats with same feature → personal trait → "transferable"
- One format only → might be format variant → "uncertain" or "domain_specific"
- Matches known genre conventions → "domain_specific"
- Avoidance patterns are presumed "transferable" unless clearly domain-linked
- Sentence-level rhythm and complexity handling are almost always "transferable"

Return a JSON object with these fields:
- stableFeatures: Array<{ featureName: string, description: string, documentCount: number, totalDocuments: number, evidenceExamples: string[], confidence: "high" | "medium" | "low", transferability: "transferable" | "domain_specific" | "uncertain", transferabilityRationale: string, isAvoidancePattern: boolean }>
- formatVariantFeatures: Array<{ name: string, description: string, formatCondition: string, evidence: string, confidence: "high" | "medium" | "low" }>
- domainArtifacts: Array<{ name: string, description: string, evidence: string }>
- evolutionNotes: string | null`;
}

// ─── Stage 4: Domain Filtering ───────────────────────────

export function buildStage4Prompt(featuresJson: string, sourceDomain: string, targetDomain: string): string {
  return `You are filtering style features for cross-domain transfer.

Source domain: ${sourceDomain}
Target domain: ${targetDomain}

<features>
${featuresJson}
</features>

For each feature, decide:
- "keep" — This feature transfers well to the target domain. Use it directly.
- "filter" — This feature is domain-specific and should NOT be transferred. Remove it.
- "flag_for_shedding" — This feature might transfer but needs adaptation. The writer should consciously decide.

Guidelines:
- Humor often needs new foils in a new domain. If a feature involves humor, consider whether the humor mechanism (timing, deflection, juxtaposition) transfers even if specific references don't.
- Avoidance patterns are presumed "keep" unless they are clearly tied to the source domain's conventions.
- Sentence rhythm, complexity handling, and emotional strategy almost always transfer.
- Structural patterns may or may not transfer depending on format constraints.
- If a feature would transfer but needs new concrete examples/objects in the target domain, set needsNewObject = true and explain in newObjectNote.

Return a JSON object with:
- filteredFeatures: Array of the input features, each augmented with:
  - domainFilterDecision: "keep" | "filter" | "flag_for_shedding"
  - filterRationale: string
  - needsNewObject: boolean
  - newObjectNote: string | null`;
}

// ─── Stage 5: Voice Guide Generation ─────────────────────

export function buildStage5Prompt(
  featuresJson: string,
  nDocuments: number,
  sourceDomain: string,
  targetDomain: string,
  highCount: number,
  mediumCount: number,
  lowCount: number,
  needsNewObjectNames: string[],
): string {
  const parts: string[] = [];

  parts.push(`Write a comprehensive voice guide for this writer.

Based on analysis of ${nDocuments} documents.
Source domain: ${sourceDomain}
Target domain: ${targetDomain}

Confidence breakdown: ${highCount} high, ${mediumCount} medium, ${lowCount} low confidence features.

<features>
${featuresJson}
</features>`);

  if (needsNewObjectNames.length > 0) {
    parts.push(
      `The following features need new concrete objects/examples for the target domain: ${needsNewObjectNames.join(", ")}`,
    );
  }

  parts.push(`Write the guide in 7 sections, in this exact order:

1. **Core Sensibility** — What is the writer's fundamental approach to prose? What drives their choices? Write this as a brief, vivid portrait (2-3 paragraphs).

2. **What They Do** — Concrete positive patterns. For each pattern:
   - Name it
   - Describe it clearly
   - Give a paraphrased example of what it looks like in practice

3. **What They Don't Do** — Avoidance patterns and deliberate omissions. These are as important as positive patterns. For each:
   - Name the avoidance
   - Describe what the writer refuses or sidesteps
   - Explain why this matters for their voice

4. **Emotional Register** — How the writer handles emotion, vulnerability, humor, tension. What's their range? Where do they live most comfortably?

5. **What Might Not Transfer** — Features that are domain-specific or uncertain. Be honest about the limits of the analysis. For features flagged for shedding, explain the tension.

6. **How to Use This Guide** — Practical instructions split into two parts:

   Generation instructions (for creating new text in this voice):
   - A primer: one paragraph describing the voice as if briefing a ghostwriter
   - 3 most important positive patterns to hit
   - 3 most important avoidance patterns to respect
   - A "start here" heuristic: what to focus on first

   Editing instructions (for revising text toward this voice):
   - 4-6 red flags that signal "this doesn't sound like the writer"
   - An "on-voice" question to ask of each paragraph
   - 3 warming signals that suggest the text is getting closer

7. **Confidence Notes** — What we're sure about, what we're guessing, and what would need more data. Be specific about which features have thin evidence.`);

  return parts.join("\n\n");
}
