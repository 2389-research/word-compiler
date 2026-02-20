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

    // Open bootstrap modal
    await page.locator("button", { hasText: "New Bible" }).click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("A test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Bible" }).click();

    // Should show some error state — either error banner or the button re-enables
    // Give it a moment to fail
    await page.waitForTimeout(2000);

    // The UI should not be stuck — either shows an error or returns to input state
    const hasError = await page.locator("text=failed").isVisible().catch(() => false);
    const hasButton = await page
      .locator("button", { hasText: "Bootstrap Bible" })
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

    await page.locator("button", { hasText: "New Bible" }).click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Another test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Bible" }).click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should show parse failure or return to usable state
    const hasParseError = await page.locator("text=Parse failed").isVisible().catch(() => false);
    const hasError = await page.locator("text=failed").isVisible().catch(() => false);
    const isUsable = await page
      .locator("button", { hasText: "Bootstrap Bible" })
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

    await page.locator("button", { hasText: "New Bible" }).click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Yet another test synopsis.");
    await page.locator("button", { hasText: "Bootstrap Bible" }).click();

    // Should show error
    await expect(page.locator("text=failed").first()).toBeVisible({ timeout: 5000 });
  });

  test("no JavaScript errors during normal navigation", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page.locator("text=Bible + Plan")).toBeVisible();

    // Navigate through all tabs
    for (const tab of ["IR Inspector", "Forward Sim", "Style Drift", "Voice Sep", "Compiler"]) {
      await page.locator("button", { hasText: tab }).click();
      await page.waitForTimeout(200);
    }

    expect(errors).toHaveLength(0);
  });
});
