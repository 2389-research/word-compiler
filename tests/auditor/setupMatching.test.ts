import { describe, expect, it } from "vitest";
import { findPayoffForSetup, matchesSetupDescription } from "../../src/auditor/setupMatching.js";

describe("matchesSetupDescription", () => {
  it("matches exact text", () => {
    expect(matchesSetupDescription("The hidden key", "The hidden key")).toBe(true);
  });

  it("matches when candidate contains setup (forward substring)", () => {
    expect(matchesSetupDescription("hidden key", "The hidden key under the mat was found")).toBe(true);
  });

  it("matches when setup contains candidate (reverse substring)", () => {
    expect(matchesSetupDescription("The hidden key under the mat", "hidden key")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesSetupDescription("The Hidden Key", "the hidden key")).toBe(true);
    expect(matchesSetupDescription("the hidden key", "THE HIDDEN KEY")).toBe(true);
  });

  it("matches dash-separator format (prefix match)", () => {
    expect(matchesSetupDescription("The hidden key", "The hidden key \u2014 found by Alice under the doormat")).toBe(
      true,
    );
  });

  it("matches dash-separator format when prefix is substring of setup", () => {
    expect(matchesSetupDescription("The hidden key under the mat", "hidden key \u2014 found by Alice")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesSetupDescription("The hidden key", "The locked drawer was opened")).toBe(false);
  });

  it("does not match partial word overlaps", () => {
    // "key" appears in "keyboard" but "The hidden key" does not match "keyboard malfunction"
    expect(matchesSetupDescription("The hidden key", "keyboard malfunction")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(matchesSetupDescription("The hidden key", "")).toBe(false);
    expect(matchesSetupDescription("", "some text")).toBe(false);
    expect(matchesSetupDescription("", "")).toBe(false);
  });

  it("rejects whitespace-only strings", () => {
    expect(matchesSetupDescription("The hidden key", "   ")).toBe(false);
    expect(matchesSetupDescription("   ", "some text")).toBe(false);
  });

  it("rejects short-string false positives via minimum length guard", () => {
    // "key" is <5 chars — should NOT substring-match "keyboard"
    expect(matchesSetupDescription("key", "keyboard malfunction")).toBe(false);
    // "gun" is <5 chars — should NOT substring-match "gunpowder"
    expect(matchesSetupDescription("gun", "the gunpowder exploded")).toBe(false);
    // Short strings still match via exact equality
    expect(matchesSetupDescription("key", "key")).toBe(true);
    expect(matchesSetupDescription("gun", "gun")).toBe(true);
  });

  it("allows substring matching when needle is >= 5 chars", () => {
    // "knife" is 5 chars — should substring-match
    expect(matchesSetupDescription("knife", "the knife was found")).toBe(true);
    expect(matchesSetupDescription("the knife was found", "knife")).toBe(true);
  });
});

describe("findPayoffForSetup", () => {
  it("returns the first matching payoff", () => {
    const payoffs = ["unrelated thing", "The hidden key was found", "another thing"];
    expect(findPayoffForSetup("The hidden key", payoffs)).toBe("The hidden key was found");
  });

  it("returns null when no payoffs match", () => {
    const payoffs = ["locked drawer opened", "letter delivered"];
    expect(findPayoffForSetup("The hidden key", payoffs)).toBeNull();
  });

  it("returns null for empty payoff list", () => {
    expect(findPayoffForSetup("The hidden key", [])).toBeNull();
  });

  it("matches dash-separator format payoffs", () => {
    const payoffs = ["The hidden key \u2014 Alice found it under the mat"];
    expect(findPayoffForSetup("The hidden key", payoffs)).toBe(payoffs[0]);
  });

  it("returns first match when multiple match", () => {
    const payoffs = ["The hidden key was found", "The hidden key \u2014 used to open door"];
    expect(findPayoffForSetup("The hidden key", payoffs)).toBe("The hidden key was found");
  });
});
