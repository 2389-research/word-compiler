import type { AnchorMatch } from "./types.js";

const ADJACENCY_SLACK = 5;

interface AnchorCtx {
  doc: string;
  prefix: string;
  suffix: string;
  focus: string;
  hasPrefix: boolean;
  hasSuffix: boolean;
  center: number;
}

function scoreCandidate(ctx: AnchorCtx, i: number): { conf: "exact" | "fuzzy"; score: number } | null {
  const { doc, prefix, suffix, focus, hasPrefix, hasSuffix, center } = ctx;
  const before = hasPrefix ? doc.slice(Math.max(0, i - prefix.length - ADJACENCY_SLACK), i) : "";
  const after = hasSuffix
    ? doc.slice(i + focus.length, Math.min(doc.length, i + focus.length + suffix.length + ADJACENCY_SLACK))
    : "";
  const prefixAdj = hasPrefix ? before.includes(prefix) : true;
  const suffixAdj = hasSuffix ? after.includes(suffix) : true;
  if (!prefixAdj && !suffixAdj && (hasPrefix || hasSuffix)) return null;
  const exact = prefixAdj && suffixAdj;
  const base = exact ? 1000 : 500;
  return { conf: exact ? "exact" : "fuzzy", score: base - Math.abs(i - center) };
}

function findBestFocusMatch(ctx: AnchorCtx): AnchorMatch | null {
  const { doc, focus } = ctx;
  let best: { i: number; conf: "exact" | "fuzzy"; score: number } | null = null;
  for (let i = doc.indexOf(focus, 0); i !== -1; i = doc.indexOf(focus, i + 1)) {
    const s = scoreCandidate(ctx, i);
    if (s && (!best || s.score > best.score)) {
      best = { i, conf: s.conf, score: s.score };
    }
  }
  if (!best) return null;
  return { start: best.i, end: best.i + focus.length, confidence: best.conf };
}

function findFuzzyFrame(ctx: AnchorCtx): AnchorMatch | null {
  const { doc, prefix, suffix, center } = ctx;
  const margin = Math.max(400, prefix.length + suffix.length + 200);
  const wStart = Math.max(0, center - margin);
  const win = doc.slice(wStart, Math.min(doc.length, center + margin));
  let best: { start: number; end: number; score: number } | null = null;
  for (let p = win.indexOf(prefix); p !== -1; p = win.indexOf(prefix, p + 1)) {
    const s = win.indexOf(suffix, p + prefix.length);
    if (s === -1) continue;
    const focusStart = wStart + p + prefix.length;
    const focusEnd = wStart + s;
    const sc = -(focusEnd - focusStart + Math.abs(focusStart - center) / 10);
    if (!best || sc > best.score) {
      best = { start: focusStart, end: focusEnd, score: sc };
    }
  }
  if (!best) return null;
  return { start: best.start, end: best.end, confidence: "fuzzy" };
}

export function resolveAnchor(
  doc: string,
  anchor: { prefix: string; focus: string; suffix: string },
  charRangeHint: { start: number; end: number },
): AnchorMatch {
  const { prefix, focus, suffix } = anchor;
  const ctx: AnchorCtx = {
    doc,
    prefix,
    suffix,
    focus,
    hasPrefix: !!prefix && prefix.length >= 2,
    hasSuffix: !!suffix && suffix.length >= 2,
    center: Math.max(0, Math.min(Math.floor((charRangeHint.start + charRangeHint.end) / 2), doc.length)),
  };
  const caret = Math.max(0, Math.min(charRangeHint.start, doc.length));

  // Path 1: Scan ALL focus occurrences, pick best scored candidate
  if (focus) {
    const match = findBestFocusMatch(ctx);
    if (match) return match;
  }

  // Path 2: Fuzzy frame (prefix...suffix) — dynamic window
  if (ctx.hasPrefix && ctx.hasSuffix) {
    const match = findFuzzyFrame(ctx);
    if (match) return match;
  }

  // Path 3: Zero-width caret — never highlight wrong text
  return { start: caret, end: caret, confidence: "failed" };
}
