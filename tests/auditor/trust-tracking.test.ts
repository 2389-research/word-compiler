import { describe, it, expect } from "vitest";
import { getAuditStats } from "../../src/auditor/index.js";
import type { AuditFlag, AuditStats } from "../../src/types/index.js";

function makeFlag(overrides: Partial<AuditFlag> = {}): AuditFlag {
  return {
    id: "f1",
    sceneId: "s1",
    severity: "warning",
    category: "kill_list",
    message: "Found banned phrase",
    lineReference: null,
    resolved: false,
    resolvedAction: null,
    wasActionable: null,
    ...overrides,
  };
}

describe("getAuditStats", () => {
  it("returns zero stats for empty flags", () => {
    const stats = getAuditStats([]);
    expect(stats.total).toBe(0);
    expect(stats.resolved).toBe(0);
    expect(stats.dismissed).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.actionable).toBe(0);
    expect(stats.nonActionable).toBe(0);
    expect(stats.signalToNoiseRatio).toBe(1); // no data defaults to 1
    expect(Object.keys(stats.byCategory)).toHaveLength(0);
  });

  it("counts pending flags", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: false }),
      makeFlag({ id: "f2", resolved: false }),
    ]);
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.resolved).toBe(0);
  });

  it("counts resolved (actionable) flags", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: true, wasActionable: true, resolvedAction: "Fixed it" }),
      makeFlag({ id: "f2", resolved: true, wasActionable: true, resolvedAction: "Rewrote" }),
    ]);
    expect(stats.resolved).toBe(2);
    expect(stats.actionable).toBe(2);
    expect(stats.signalToNoiseRatio).toBe(1);
  });

  it("counts dismissed (non-actionable) flags", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: true, wasActionable: false }),
    ]);
    expect(stats.dismissed).toBe(1);
    expect(stats.nonActionable).toBe(1);
    expect(stats.signalToNoiseRatio).toBe(0);
  });

  it("computes signal-to-noise ratio correctly", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: true, wasActionable: true, resolvedAction: "Fix" }),
      makeFlag({ id: "f2", resolved: true, wasActionable: true, resolvedAction: "Fix" }),
      makeFlag({ id: "f3", resolved: true, wasActionable: false }),
    ]);
    // 2 actionable, 1 noise → 2/3 ≈ 0.667
    expect(stats.signalToNoiseRatio).toBeCloseTo(0.667, 2);
  });

  it("tracks by-category breakdown", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", category: "kill_list", resolved: true, wasActionable: true, resolvedAction: "Fix" }),
      makeFlag({ id: "f2", category: "kill_list", resolved: true, wasActionable: false }),
      makeFlag({ id: "f3", category: "rhythm_monotony", resolved: true, wasActionable: true, resolvedAction: "Fix" }),
    ]);
    expect(stats.byCategory["kill_list"]).toEqual({ total: 2, actionable: 1 });
    expect(stats.byCategory["rhythm_monotony"]).toEqual({ total: 1, actionable: 1 });
  });

  it("mixes pending and resolved flags", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: false }),
      makeFlag({ id: "f2", resolved: true, wasActionable: true, resolvedAction: "Fixed" }),
      makeFlag({ id: "f3", resolved: true, wasActionable: false }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.resolved).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.signalToNoiseRatio).toBe(0.5);
  });

  it("signal-to-noise ignores pending flags", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", resolved: false }),
      makeFlag({ id: "f2", resolved: false }),
      makeFlag({ id: "f3", resolved: true, wasActionable: true, resolvedAction: "Fix" }),
    ]);
    // Only 1 decided flag (actionable), ratio = 1/1 = 1.0
    expect(stats.signalToNoiseRatio).toBe(1);
  });

  it("handles all severities in category breakdown", () => {
    const stats = getAuditStats([
      makeFlag({ id: "f1", severity: "critical", category: "voice_drift" }),
      makeFlag({ id: "f2", severity: "warning", category: "voice_drift" }),
      makeFlag({ id: "f3", severity: "info", category: "rhythm_monotony" }),
    ]);
    expect(stats.byCategory["voice_drift"]!.total).toBe(2);
    expect(stats.byCategory["rhythm_monotony"]!.total).toBe(1);
  });
});
