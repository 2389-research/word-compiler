import { describe, expect, it } from "vitest";
import { checkAuditToEditGate, checkEditToCompleteGate } from "../../src/gates/index.js";
import type { AuditFlag } from "../../src/types/index.js";

function makeFlag(severity: "critical" | "warning" | "info", resolved = false): AuditFlag {
  return {
    id: `flag-${Math.random()}`,
    sceneId: "scene-1",
    severity,
    category: "kill_list",
    message: "test flag",
    lineReference: null,
    resolved,
    resolvedAction: resolved ? "fixed" : null,
    wasActionable: resolved ? true : null,
  };
}

describe("checkAuditToEditGate", () => {
  it("passes with no flags", () => {
    const result = checkAuditToEditGate([]);
    expect(result.passed).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it("passes when all critical flags are resolved", () => {
    const flags = [makeFlag("critical", true), makeFlag("critical", true)];
    const result = checkAuditToEditGate(flags);
    expect(result.passed).toBe(true);
  });

  it("fails when unresolved critical flags exist", () => {
    const flags = [makeFlag("critical", false), makeFlag("warning", false)];
    const result = checkAuditToEditGate(flags);
    expect(result.passed).toBe(false);
    expect(result.messages[0]).toContain("1 unresolved critical");
  });

  it("passes with only unresolved warnings", () => {
    const flags = [makeFlag("warning", false), makeFlag("info", false)];
    const result = checkAuditToEditGate(flags);
    expect(result.passed).toBe(true);
  });
});

describe("checkEditToCompleteGate", () => {
  it("always passes (soft gate)", () => {
    const result = checkEditToCompleteGate();
    expect(result.passed).toBe(true);
    expect(result.messages).toHaveLength(0);
  });
});
