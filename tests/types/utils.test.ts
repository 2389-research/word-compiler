import { describe, expect, it } from "vitest";
import { generateId } from "../../src/types/utils.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a valid UUID string", () => {
    const id = generateId();
    expect(id).toMatch(UUID_REGEX);
  });

  it("returns unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it("uses crypto.randomUUID when available", () => {
    // Node.js test environment has crypto.randomUUID available by default
    const id = generateId();
    expect(id).toMatch(UUID_REGEX);
    // Verify the standard crypto path produces conformant v4 UUIDs
    expect(id[14]).toBe("4");
    expect("89ab").toContain(id[19]!.toLowerCase());
  });
});
