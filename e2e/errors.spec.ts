import { expect, test } from "@playwright/test";
import { mockStartup } from "./helpers.js";

test.describe("Error handling", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("handles API timeout gracefully", async ({ page }) => {
    // Mock the streaming endpoint to timeout (never respond)
    await page.route("**/api/generate/stream", (route) => {
      // Abort after 100ms to simulate timeout
      setTimeout(() => route.abort("timedout"), 100);
    });

    await page.goto("/");

    // Bootstrap stage — click "Start from Synopsis"
    await page.locator("text=Start from Synopsis").click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("A test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Brief" }).click();

    // Should show some error state — either error banner or the button re-enables
    await page.waitForTimeout(2000);

    const hasError = await page.locator("text=failed").isVisible().catch(() => false);
    const hasButton = await page
      .locator("button", { hasText: "Bootstrap Brief" })
      .isEnabled()
      .catch(() => false);
    expect(hasError || hasButton).toBe(true);
  });

  test("handles malformed SSE response", async ({ page }) => {
    // Mock endpoint returning malformed SSE
    await page.route("**/api/generate/stream", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: "data: {invalid json\n\ndata: also broken\n\n",
      });
    });

    await page.goto("/");

    await page.locator("text=Start from Synopsis").click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Another test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Brief" }).click();

    await page.waitForTimeout(2000);

    const hasParseError = await page.locator("text=Parse failed").isVisible().catch(() => false);
    const hasError = await page.locator("text=failed").isVisible().catch(() => false);
    const isUsable = await page
      .locator("button", { hasText: "Bootstrap Brief" })
      .isEnabled()
      .catch(() => false);
    expect(hasParseError || hasError || isUsable).toBe(true);
  });

  test("handles HTTP error from API", async ({ page }) => {
    // Mock endpoint returning 500
    await page.route("**/api/generate/stream", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto("/");

    await page.locator("text=Start from Synopsis").click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Yet another test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Brief" }).click();

    // Should show error
    await expect(page.locator("text=failed").first()).toBeVisible({ timeout: 5000 });
  });

  test("no JavaScript errors during stage navigation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page.locator("text=Create Your Essay Brief")).toBeVisible();

    // Navigate through all stage buttons
    const stageLabels = ["Plan", "Draft", "Audit", "Edit", "Complete", "Export", "Bootstrap"];
    for (const label of stageLabels) {
      await page.locator('[aria-label="Progress"] button', { hasText: label }).click();
      await page.waitForTimeout(200);
    }

    expect(errors).toHaveLength(0);
  });
});
