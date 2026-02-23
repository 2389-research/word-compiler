import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

test.describe("Genre Templates", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("genre selector visible in Bible Authoring Guided Form", async ({ page }) => {
    await page.goto("/");
    // Open Bible Authoring modal
    await page.locator("button", { hasText: "New Bible" }).click();
    // Switch to Guided Form tab
    await page.locator("button", { hasText: "Guided Form" }).click();
    // Genre template selector should be visible
    await expect(page.locator("text=Genre Template")).toBeVisible();
  });

  test("genre selector shows all 4 genre options", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "New Bible" }).click();
    await page.locator("button", { hasText: "Guided Form" }).click();
    // Check all 4 genre names are present as options
    await expect(page.locator("option", { hasText: "Literary Fiction" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Thriller" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Romance" })).toBeAttached();
    await expect(page.locator("option", { hasText: "Science Fiction" })).toBeAttached();
  });

  test("guided form shows stepper and foundations step", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "New Bible" }).click();
    await page.locator("button", { hasText: "Guided Form" }).click();
    // Stepper steps are visible (use role locators to avoid matching hidden tab text)
    await expect(page.getByRole("button", { name: "Foundations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Characters" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
    // Can navigate with Next button
    await page.locator("button", { hasText: "Next" }).click();
    await expect(page.locator("text=Add Character")).toBeVisible();
  });
});
