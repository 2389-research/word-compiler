import { countTokens, lastNTokens, truncateToTokens } from "../tokens/index.js";
import type { DocumentChunk, PipelineConfig, WritingSample } from "./types.js";

const TRANSCRIPT_BLOCK_SIZE = 30;

/**
 * Split text on double newlines. If no double newlines are found
 * (transcript-style text), group into blocks of ~30 lines.
 */
export function splitParagraphs(text: string): string[] {
  const doubleNewlineSplit = text.split(/\n\s*\n/);
  const paragraphs = doubleNewlineSplit.map((p) => p.trim()).filter((p) => p.length > 0);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  // Transcript-style fallback: split on single newlines, group into blocks
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length <= TRANSCRIPT_BLOCK_SIZE) {
    return [lines.join("\n")];
  }

  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i += TRANSCRIPT_BLOCK_SIZE) {
    const block = lines.slice(i, i + TRANSCRIPT_BLOCK_SIZE).join("\n");
    if (block.length > 0) {
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * Split text on sentence-ending punctuation followed by whitespace.
 */
export function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Split a long paragraph into sentence-based chunks that fit within the token target.
 */
function splitLongParagraph(para: string, targetTokens: number): string[] {
  const result: string[] = [];
  const sentences = splitSentences(para);
  let sentBuf: string[] = [];
  let sentTokens = 0;

  for (const sent of sentences) {
    const st = countTokens(sent);
    if (sentTokens + st > targetTokens && sentBuf.length > 0) {
      result.push(sentBuf.join(" "));
      sentBuf = [];
      sentTokens = 0;
    }
    sentBuf.push(sent);
    sentTokens += st;
  }
  if (sentBuf.length > 0) {
    result.push(sentBuf.join(" "));
  }
  return result;
}

/**
 * Accumulate paragraphs into raw text chunks respecting the token target.
 */
function accumulateParagraphs(paragraphs: string[], targetTokens: number): string[] {
  const rawChunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    // Single paragraph exceeds target — split on sentences
    if (paraTokens > targetTokens) {
      if (current.length > 0) {
        rawChunks.push(current.join("\n\n"));
        current = [];
        currentTokens = 0;
      }
      rawChunks.push(...splitLongParagraph(para, targetTokens));
      continue;
    }

    if (currentTokens + paraTokens > targetTokens && current.length > 0) {
      rawChunks.push(current.join("\n\n"));
      current = [];
      currentTokens = 0;
    }

    current.push(para);
    currentTokens += paraTokens;
  }

  if (current.length > 0) {
    rawChunks.push(current.join("\n\n"));
  }
  return rawChunks;
}

/**
 * Convert raw text chunks into DocumentChunk objects with overlap and position metadata.
 */
function buildChunkObjects(rawChunks: string[], overlapTokens: number): DocumentChunk[] {
  const total = rawChunks.length;
  return rawChunks.map((chunkText, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;

    return {
      text: chunkText,
      index: i,
      total,
      isFirst,
      isLast,
      overlapPrev: isFirst ? null : lastNTokens(rawChunks[i - 1]!, overlapTokens),
      overlapNext: isLast ? null : truncateToTokens(rawChunks[i + 1]!, overlapTokens),
      tokenCount: countTokens(chunkText),
    };
  });
}

/**
 * Split a writing sample into overlapping chunks for analysis.
 */
export function chunkDocument(sample: WritingSample, config: PipelineConfig): DocumentChunk[] {
  const text = sample.text.trim();
  const totalTokens = countTokens(text);

  // Short document — single chunk
  if (totalTokens <= config.chunkTargetTokens) {
    return [
      {
        text,
        index: 0,
        total: 1,
        isFirst: true,
        isLast: true,
        overlapPrev: null,
        overlapNext: null,
        tokenCount: totalTokens,
      },
    ];
  }

  const paragraphs = splitParagraphs(text);
  const rawChunks = accumulateParagraphs(paragraphs, config.chunkTargetTokens);
  return buildChunkObjects(rawChunks, config.chunkOverlapTokens);
}
