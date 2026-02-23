// ─── Utility Functions ──────────────────────────────────

export function generateId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for Node <19 — try CJS require, then UUID v4 polyfill for ESM
  try {
    const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
    return randomUUID();
  } catch {
    // ESM context where require is unavailable and globalThis.crypto is missing
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
