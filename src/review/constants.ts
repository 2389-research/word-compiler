import type { Severity } from "./types.js";

// ─── Severity Colors ────────────────────────────
// Single source of truth for severity → hex color mapping.
// Used by AnnotationTooltip.svelte (JS) and referenced by
// AnnotatedEditor.svelte (static CSS squiggle SVGs).

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

// CSS custom property fallbacks for component usage
export const SEVERITY_CSS_COLORS: Record<Severity, string> = {
  critical: `var(--color-error, ${SEVERITY_COLORS.critical})`,
  warning: `var(--color-warning, ${SEVERITY_COLORS.warning})`,
  info: `var(--color-info, ${SEVERITY_COLORS.info})`,
};

/**
 * Generate an encoded SVG data URL for a squiggle underline.
 * Useful for programmatic use; the AnnotatedEditor CSS uses
 * static equivalents for ProseMirror compatibility.
 */
export function squiggleSvgUrl(hex: string): string {
  const encoded = encodeURIComponent(hex);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='${encoded}' stroke-width='0.7'/%3E%3C/svg%3E")`;
}
