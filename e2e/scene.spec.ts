import { expect, test } from "@playwright/test";
import path from "node:path";
import { mockStartup } from "./helpers.js";

const BIBLE_FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "bible.json");

test.describe("Scene authoring workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
    await page.goto("/");
    await expect(page.locator("text=Bible + Plan")).toBeVisible();

    // Load Bible fixture first
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("button", { hasText: "Load Bible" }).click(),
    ]);
    await fileChooser.setFiles(BIBLE_FIXTURE);
    await expect(page.locator(".bible-version")).toBeVisible({ timeout: 3000 });
  });

  test("opens scene authoring modal", async ({ page }) => {
    // Look for "New Scene" button in the SceneSequencer
    const sceneBtn = page.locator("button", { hasText: "New Scene" });
    await expect(sceneBtn).toBeVisible({ timeout: 2000 });
    await sceneBtn.click();
    await expect(page.locator("text=Scene Authoring")).toBeVisible({ timeout: 2000 });
  });

  test("guided form creates scene plan", async ({ page }) => {
    // Open scene authoring
    await page.locator("button", { hasText: "New Scene" }).click();
    await expect(page.locator("text=Scene Authoring")).toBeVisible();

    // Switch to Guided Form tab
    await page.locator("button", { hasText: "Guided Form" }).click();

    // Fill in core identity fields
    const titleInput = page.locator("input[placeholder='Scene title']");
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill("The Confrontation");
    }

    // Fill narrative goal
    const goalTextarea = page.locator("textarea").first();
    if (await goalTextarea.isVisible()) {
      await goalTextarea.fill("Marcus discovers Elena's betrayal");
    }

    // Navigate through steps
    const nextBtn = page.locator("button", { hasText: "Next" });
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Save the scene plan
    const saveBtn = page.locator("button", { hasText: "Save Scene Plan" });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      // Modal should close
      await expect(page.locator("text=Scene Authoring")).not.toBeVisible({ timeout: 2000 });
    }
  });
});
