import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

test.describe("Genre Templates", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("style template selector visible in Brief Authoring Guided Form", async ({ page }) => {
    await page.goto("/");
    // Bootstrap stage — click "Build Manually" to open BriefAuthoringModal (guided form directly)
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Style template selector should be visible
    await expect(page.locator("text=Style Template")).toBeVisible();
  });

  test("style template selector shows all 4 style options", async ({ page }) => {
    await page.goto("/");
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Check all 4 style template names are present as options
    await expect(page.locator("option", { hasText: "Personal Essay" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Analytical Essay" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Op-Ed / Persuasive" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Narrative Nonfiction" })).toBeAttached();
  });

  test("guided form shows stepper and foundations step", async ({ page }) => {
    await page.goto("/");
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Stepper steps within the modal are visible
    const modal = page.locator(".modal-overlay");
    await expect(modal.getByRole("button", { name: "Voice & Perspective" })).toBeVisible();
    await expect(modal.locator(".stepper-step", { hasText: "Author Voice" })).toBeVisible();
    await expect(modal.locator(".stepper-step", { hasText: "Review" })).toBeVisible();
    // Can navigate with Next button
    await modal.locator("button", { hasText: "Next" }).click();
    await expect(modal.locator("text=Add Voice Profile")).toBeVisible();
  });
});
