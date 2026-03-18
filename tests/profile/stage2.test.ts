import { describe, expect, it } from "vitest";
import { computeDriftRatio } from "../../server/profile/stage2.js";

describe("computeDriftRatio", () => {
  it("returns 0 when all chunks have zero drift", () => {
    expect(computeDriftRatio([{ contentDriftScore: 0 }, { contentDriftScore: 0 }])).toBe(0);
  });
  it("returns the average of drift scores", () => {
    expect(
      computeDriftRatio([
        { contentDriftScore: 0.8 },
        { contentDriftScore: 0.0 },
        { contentDriftScore: 0.0 },
        { contentDriftScore: 0.2 },
      ]),
    ).toBe(0.25);
  });
  it("returns 0 for empty array", () => {
    expect(computeDriftRatio([])).toBe(0);
  });
  it("handles low drift scores from CMS boilerplate", () => {
    const ratio = computeDriftRatio([
      { contentDriftScore: 0.1 },
      { contentDriftScore: 0.2 },
      { contentDriftScore: 0.1 },
      { contentDriftScore: 0.0 },
      { contentDriftScore: 0.15 },
    ]);
    expect(ratio).toBeCloseTo(0.11);
  });
});
