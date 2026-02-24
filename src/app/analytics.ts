/// <reference types="vite/client" />

/**
 * Lightweight analytics instrumentation for UX feature tracking.
 *
 * Currently logs to console in dev mode. Replace the `emit` function
 * with a real analytics service (Plausible, PostHog, etc.) when ready.
 */

function emit(event: string, properties: Record<string, string | number>) {
  if (import.meta.env?.DEV) {
    console.debug(`[analytics] ${event}`, properties);
  }
}

export function trackExampleView(fieldId: string) {
  emit("example_drawer_opened", { fieldId });
}

export function trackExampleApply(fieldId: string, exampleTitle: string) {
  emit("example_template_applied", { fieldId, exampleTitle });
}

export function trackGenreFilter(fieldId: string, genre: string) {
  emit("example_genre_filtered", { fieldId, genre });
}
