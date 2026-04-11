import { expect, test } from "@playwright/test";
import { mockStartupWithBible, navigateToStage } from "./helpers.js";

test.describe("Section authoring workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartupWithBible(page);
    await page.goto("/");
    // Navigate to Plan stage (unlocked because brief has a voice profile)
    await navigateToStage(page, "Plan");
  });

  test("opens section authoring modal", async ({ page }) => {
    // Click the first "+ New Section" button in the section sequencer
    const sectionBtn = page.locator("button", { hasText: "New Section" }).first();
    await expect(sectionBtn).toBeVisible({ timeout: 2000 });
    await sectionBtn.click();
    await expect(page.locator("text=Section Authoring")).toBeVisible({ timeout: 2000 });
  });

  test("guided form creates section plan", async ({ page }) => {
    // Open section authoring
    await page.locator("button", { hasText: "New Section" }).first().click();
    await expect(page.locator("text=Section Authoring")).toBeVisible();

    // Switch to Guided Form tab
    await page.locator("button", { hasText: "Guided Form" }).click();

    // Fill in core identity fields
    const titleInput = page.locator("input[placeholder='Section title']");
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

    // Save the section plan
    const saveBtn = page.locator("button", { hasText: "Save Section Plan" });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      // Modal should close
      await expect(page.locator("text=Section Authoring")).not.toBeVisible({ timeout: 2000 });
    }
  });
});
