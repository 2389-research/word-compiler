import { expect, test } from "@playwright/test";
import { mockStartup, navigateToStage } from "./helpers.js";

test.describe("Word Compiler App", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("loads and renders the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Word Compiler").first()).toBeVisible();
  });

  test("shows WorkflowRail with all 7 stages", async ({ page }) => {
    await page.goto("/");
    const rail = page.locator('[aria-label="Progress"]');
    await expect(rail).toBeVisible();
    await expect(rail.locator("button", { hasText: "Bootstrap" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Plan" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Draft" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Audit" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Edit" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Complete" })).toBeVisible();
    await expect(rail.locator("button", { hasText: "Export" })).toBeVisible();
  });

  test("starts on Bootstrap stage", async ({ page }) => {
    await page.goto("/");
    // Bootstrap stage shows "Create Your Essay Brief" when no brief exists
    await expect(page.locator("text=Create Your Essay Brief")).toBeVisible();
  });

  test("shows two entry cards on Bootstrap stage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Start from Synopsis")).toBeVisible();
    await expect(page.locator("text=Build Manually")).toBeVisible();
  });

  test("no JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("no JavaScript errors during stage navigation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForTimeout(500);

    // Try clicking each stage button (some may be locked but shouldn't cause errors)
    const stageLabels = ["Bootstrap", "Plan", "Draft", "Audit", "Edit", "Complete", "Export"];
    for (const label of stageLabels) {
      await page.locator('[aria-label="Progress"] button', { hasText: label }).click();
      await page.waitForTimeout(200);
    }

    expect(errors).toHaveLength(0);
  });
});
