import { expect, test } from "@playwright/test";
import { mockStartupAtEdit, navigateToStage } from "./helpers.js";

test.describe("Edit Stage", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartupAtEdit(page);
    await page.goto("/");
  });

  test("can navigate to Edit stage", async ({ page }) => {
    await navigateToStage(page, "Edit");
    await expect(page.locator(".edit-scene-title")).toBeVisible({ timeout: 5000 });
  });

  test("shows scene title in toolbar", async ({ page }) => {
    await navigateToStage(page, "Edit");
    await expect(page.locator(".edit-scene-title")).toHaveText("The Quiet Bar", { timeout: 5000 });
  });

  test("shows word count in toolbar", async ({ page }) => {
    await navigateToStage(page, "Edit");
    const wordCount = page.locator(".edit-word-count");
    await expect(wordCount).toBeVisible({ timeout: 5000 });
    await expect(wordCount).toContainText("words");
  });

  test("shows Select text to refine hint", async ({ page }) => {
    await navigateToStage(page, "Edit");
    await expect(page.locator(".edit-hint")).toHaveText("Select text to refine", { timeout: 5000 });
  });

  test("renders prose content from chunks", async ({ page }) => {
    await navigateToStage(page, "Edit");
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toContainText("Marcus sat at the bar");
  });

  test("no JavaScript errors during Edit stage load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await navigateToStage(page, "Edit");
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });
});
