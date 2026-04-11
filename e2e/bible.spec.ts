import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

test.describe("Brief workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("opens BriefAuthoringModal via Build Manually card", async ({ page }) => {
    await page.goto("/");

    // Bootstrap stage shows "Build Manually" card
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    // Modal should open with "Essay Brief Editor" header and guided form directly
    await expect(page.locator("text=Essay Brief Editor")).toBeVisible({ timeout: 2000 });
    // Should show guided form stepper (no tabs — guided form is the only mode)
    await expect(page.locator("text=POV Default")).toBeVisible({ timeout: 2000 });
  });

  test("Brief Authoring modal stepper navigation", async ({ page }) => {
    await page.goto("/");

    // Open modal via "Build Manually" — goes straight to guided form
    await page.locator(".bootstrap-card", { hasText: "Build Manually" }).click();
    await expect(page.locator("text=Essay Brief Editor")).toBeVisible();

    // Should see Foundations step (first step)
    await expect(page.locator("text=POV Default")).toBeVisible({ timeout: 2000 });

    // Navigate to Author Voice step
    await page.locator("button", { hasText: "Next" }).click();
    await expect(page.locator("text=Add Voice Profile")).toBeVisible({ timeout: 2000 });

    // Navigate to Locations step
    await page.locator("button", { hasText: "Next" }).click();
    await expect(page.locator("text=Add Location")).toBeVisible({ timeout: 2000 });
  });
});
