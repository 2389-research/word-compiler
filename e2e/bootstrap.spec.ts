import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

const MOCK_BOOTSTRAP_RESPONSE = JSON.stringify({
  characters: [
    {
      name: "Marcus Cole",
      role: "protagonist",
      physicalDescription: "Weathered hands, crooked nose from an old break",
      backstory: "Former homicide detective turned bar owner",
      voiceNotes: "Short clipped sentences, never uses adjectives",
      emotionPhysicality: "Jaw tightens, hands go to pockets",
    },
  ],
  locations: [
    {
      name: "The Velvet",
      sensoryPalette: {
        sounds: ["ice clinking", "low jazz"],
        smells: ["old wood", "bourbon"],
        textures: ["sticky bar top", "cracked leather"],
        lightQuality: "amber neon glow",
        prohibitedDefaults: ["dim lighting"],
      },
    },
  ],
  suggestedTone: {
    metaphoricDomains: ["machinery", "water"],
    prohibitedDomains: ["flowers"],
    pacingNotes: "Slow burn",
    interiority: "filtered",
  },
  suggestedKillList: ["a sense of", "palpable tension"],
});

test.describe("Bootstrap workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("open bootstrap modal, mock SSE stream, verify bible populated", async ({ page }) => {
    // Mock the streaming endpoint
    await page.route("**/api/generate/stream", (route) => {
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: [
          `data: ${JSON.stringify({ type: "delta", text: MOCK_BOOTSTRAP_RESPONSE })}\n\n`,
          `data: ${JSON.stringify({ type: "done", usage: { input_tokens: 100, output_tokens: 200 }, stopReason: "end_turn" })}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/");

    // Open bootstrap modal via New Bible -> AI Bootstrap tab
    await page.locator("button", { hasText: "New Bible" }).click();
    await expect(page.locator("text=Bible Authoring")).toBeVisible();

    // Should be on AI Bootstrap tab by default — look for the synopsis textarea
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();

    // Type a synopsis
    await textarea.fill("Marcus Cole runs a jazz bar called The Velvet in a decaying waterfront district.");

    // Click Bootstrap Bible
    await page.locator("button", { hasText: "Bootstrap Bible" }).click();

    // Wait for the modal to close (bootstrap completes and closes after 600ms)
    await expect(page.locator("text=Bible Authoring")).not.toBeVisible({ timeout: 5000 });

    // Bible should be loaded — check version badge
    await expect(page.locator(".bible-version")).toBeVisible({ timeout: 3000 });

    // CodeMirror should contain the character name
    await expect(page.locator(".cm-content").first()).toContainText("Marcus Cole", { timeout: 3000 });
  });

  test("shows error banner on parse failure", async ({ page }) => {
    // Mock endpoint returning non-JSON garbage
    await page.route("**/api/generate/stream", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: [
          `data: ${JSON.stringify({ type: "delta", text: "I cannot help with that request." })}\n\n`,
          `data: ${JSON.stringify({ type: "done", usage: { input_tokens: 10, output_tokens: 5 }, stopReason: "end_turn" })}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/");

    await page.locator("button", { hasText: "New Bible" }).click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("A story about nothing parseable.");
    await page.locator("button", { hasText: "Bootstrap Bible" }).click();

    // Should show error banner with parse failure
    await expect(page.locator("text=Parse failed")).toBeVisible({ timeout: 5000 });
  });
});
