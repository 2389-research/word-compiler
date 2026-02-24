import { expect, test } from "@playwright/test";
import path from "node:path";
import { mockStartup, switchToJsonTab } from "./helpers.js";

const BIBLE_FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "bible.json");

test.describe("Bible workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("loads Bible from fixture JSON via file chooser", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Project Atlas")).toBeVisible();
    await switchToJsonTab(page);

    // Trigger file chooser and load fixture
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Load Bible" }).click(),
    ]);
    await fileChooser.setFiles(BIBLE_FIXTURE);

    // Bible should now be loaded — version badge should appear
    await expect(page.locator(".bible-version")).toBeVisible({ timeout: 3000 });
  });

  test("shows Bible JSON in editor after load", async ({ page }) => {
    await page.goto("/");
    await switchToJsonTab(page);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Load Bible" }).click(),
    ]);
    await fileChooser.setFiles(BIBLE_FIXTURE);

    // Editor should contain Bible content
    await expect(page.locator("text=Bible JSON")).toBeVisible();
    // The CodeMirror editor should have content (look for character names from fixture)
    await expect(page.locator(".cm-content").first()).toContainText("Marcus", { timeout: 3000 });
  });

  test("Save Bible button becomes enabled after loading Bible", async ({ page }) => {
    await page.goto("/");
    await switchToJsonTab(page);

    // Before load — Save Bible should be disabled
    const saveBtn = page.locator("button", { hasText: "Save Bible" });
    await expect(saveBtn).toBeDisabled();

    // Load Bible
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Load Bible" }).click(),
    ]);
    await fileChooser.setFiles(BIBLE_FIXTURE);

    // After load — Save Bible should be enabled
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  });

  test("opens BibleAuthoringModal via New Bible button", async ({ page }) => {
    await page.goto("/");

    await page.locator("button", { hasText: "New Bible" }).click();
    // Modal should open with "Bible Authoring" header
    await expect(page.locator("text=Bible Authoring")).toBeVisible({ timeout: 2000 });
    // Should show tabs
    await expect(page.locator("button", { hasText: "AI Bootstrap" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Guided Form" })).toBeVisible();
  });

  test("Bible Authoring modal stepper navigation", async ({ page }) => {
    await page.goto("/");

    // Open modal and switch to Guided Form
    await page.locator("button", { hasText: "New Bible" }).click();
    await expect(page.locator("text=Bible Authoring")).toBeVisible();
    await page.locator("button", { hasText: "Guided Form" }).click();

    // Should see Foundations step (first step)
    await expect(page.locator("text=POV Default")).toBeVisible({ timeout: 2000 });

    // Navigate to Characters step
    await page.locator("button", { hasText: "Next" }).click();
    await expect(page.locator("text=Add Character")).toBeVisible({ timeout: 2000 });

    // Navigate to Locations step
    await page.locator("button", { hasText: "Next" }).click();
    await expect(page.locator("text=Add Location")).toBeVisible({ timeout: 2000 });
  });
});
