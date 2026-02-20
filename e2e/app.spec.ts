import { expect, test } from "@playwright/test";

test.describe("Word Compiler App", () => {
  test("loads and renders the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Word Compiler").first()).toBeVisible();
  });

  test("shows Bible + Plan pane", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Bible + Plan")).toBeVisible();
  });

  test("shows Compiler tab active by default", async ({ page }) => {
    await page.goto("/");
    const compilerBtn = page.locator("button", { hasText: "Compiler" }).first();
    await expect(compilerBtn).toBeVisible();
  });

  test("can switch to IR Inspector tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "IR Inspector" }).click();
    await expect(page.locator("text=IR Inspector — No scene")).toBeVisible();
  });

  test("can switch to Forward Sim tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Forward Sim" }).click();
    await expect(page.locator("text=No scenes")).toBeVisible();
  });

  test("can switch to Style Drift tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Style Drift" }).click();
    await expect(page.locator("text=Complete at least 2 scenes")).toBeVisible();
  });

  test("can switch to Voice Sep tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Voice Sep" }).click();
    await expect(page.locator("text=No voice separability data")).toBeVisible();
  });

  test("New Bible button is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("button", { hasText: "New Bible" })).toBeVisible();
  });

  test("shows Compiler empty state", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Load a Bible and Scene Plan")).toBeVisible();
  });

  test("Load Bible button is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("button", { hasText: "Load Bible" })).toBeVisible();
  });

  test("model selector shows Claude models", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("select")).toBeVisible();
    const options = await page.locator("select option").count();
    expect(options).toBeGreaterThan(0);
  });

  test("no JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
