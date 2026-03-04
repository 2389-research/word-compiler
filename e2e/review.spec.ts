import { expect, test } from "@playwright/test";
import { mockStartupAtDraft, navigateToStage } from "./helpers.js";

test.describe("Editorial Review", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartupAtDraft(page);
    await page.goto("/");
    await navigateToStage(page, "Draft");
    // Wait for the review debounce (1000ms) + rendering
    await page.waitForTimeout(2000);
  });

  test("squiggle underlines appear on kill list violations", async ({ page }) => {
    // The chunk contains "very" (3x) and "suddenly" (1x) — all kill list words.
    // Local checks produce annotations that render as .editorial-squiggle decorations.
    const squiggles = page.locator(".editorial-squiggle");
    await expect(squiggles.first()).toBeVisible({ timeout: 5000 });
    const count = await squiggles.count();
    // At least 3 "very" + 1 "suddenly" = 4 kill list violations
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("tooltip shows on squiggle hover", async ({ page }) => {
    const squiggle = page.locator(".editorial-squiggle").first();
    await expect(squiggle).toBeVisible({ timeout: 5000 });
    await squiggle.hover();
    // Tooltip should appear with annotation details
    const tooltip = page.locator(".annotation-tooltip");
    await expect(tooltip).toBeVisible({ timeout: 3000 });
  });

  test("tooltip has Dismiss button", async ({ page }) => {
    const squiggle = page.locator(".editorial-squiggle").first();
    await expect(squiggle).toBeVisible({ timeout: 5000 });
    await squiggle.hover();
    const tooltip = page.locator(".annotation-tooltip");
    await expect(tooltip).toBeVisible({ timeout: 3000 });
    await expect(tooltip.locator("button", { hasText: "Dismiss" })).toBeVisible();
  });

  test("dismiss removes the annotation squiggle", async ({ page }) => {
    const squiggles = page.locator(".editorial-squiggle");
    await expect(squiggles.first()).toBeVisible({ timeout: 5000 });
    const countBefore = await squiggles.count();

    // Hover squiggle to show tooltip
    await squiggles.first().hover();
    const dismissBtn = page.locator(".annotation-tooltip button", { hasText: "Dismiss" });
    await expect(dismissBtn).toBeVisible({ timeout: 3000 });

    // The tooltip auto-hides on mouseleave from the squiggle (200ms timeout),
    // so use dispatchEvent to click without moving the mouse pointer.
    await dismissBtn.dispatchEvent("click");

    // After dismiss + re-review debounce, annotations matching the fingerprint
    // should be removed. Wait for the review cycle to complete.
    await page.waitForTimeout(2500);
    const countAfter = await squiggles.count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("tooltip shows feedback textarea for annotations without suggestion", async ({ page }) => {
    // Kill list annotations have suggestion=null, so the tooltip should
    // show the feedback textarea and "Get Suggestion" button.
    const squiggle = page.locator(".editorial-squiggle").first();
    await expect(squiggle).toBeVisible({ timeout: 5000 });
    await squiggle.hover();
    const tooltip = page.locator(".annotation-tooltip");
    await expect(tooltip).toBeVisible({ timeout: 3000 });

    // Feedback textarea should be visible (no suggestion → request UI)
    const textarea = tooltip.locator(".feedback-textarea");
    await expect(textarea).toBeVisible();

    // "Get Suggestion" button should be present but disabled (empty feedback)
    const getBtn = tooltip.locator("button", { hasText: "Get Suggestion" });
    await expect(getBtn).toBeVisible();
    await expect(getBtn).toBeDisabled();
  });

  test("Get Suggestion button enables when feedback is typed", async ({ page }) => {
    const squiggle = page.locator(".editorial-squiggle").first();
    await expect(squiggle).toBeVisible({ timeout: 5000 });
    await squiggle.hover();
    const tooltip = page.locator(".annotation-tooltip");
    await expect(tooltip).toBeVisible({ timeout: 3000 });

    const textarea = tooltip.locator(".feedback-textarea");
    await textarea.fill("make it more subtle");

    const getBtn = tooltip.locator("button", { hasText: "Get Suggestion" });
    await expect(getBtn).toBeEnabled();
  });

  test("no JavaScript errors during review interaction", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Wait for squiggles to appear
    const squiggle = page.locator(".editorial-squiggle").first();
    await expect(squiggle).toBeVisible({ timeout: 5000 });

    // Hover to trigger tooltip
    await squiggle.hover();
    await page.waitForTimeout(500);

    // Move away to dismiss tooltip
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});
