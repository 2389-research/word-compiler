import { expect, test } from "@playwright/test";
import { mockStartup, switchToJsonTab } from "./helpers.js";

test.describe("Word Compiler App", () => {
  test.beforeEach(async ({ page }) => {
    await mockStartup(page);
  });

  test("loads and renders the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Word Compiler").first()).toBeVisible();
  });

  test("shows Project Atlas pane", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Project Atlas")).toBeVisible();
  });

  test("shows Draft Engine tab active by default", async ({ page }) => {
    await page.goto("/");
    const compilerBtn = page.locator("button", { hasText: "Draft Engine" }).first();
    await expect(compilerBtn).toBeVisible();
  });

  test("can switch to Scene Blueprint tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Scene Blueprint" }).click();
    await expect(page.locator("text=Scene Blueprint — No scene")).toBeVisible();
  });

  test("can switch to Reader Journey tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Reader Journey" }).click();
    await expect(page.locator("text=No scenes")).toBeVisible();
  });

  test("can switch to Voice Consistency tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Voice Consistency" }).click();
    await expect(page.locator("text=Complete at least 2 scenes")).toBeVisible();
  });

  test("can switch to Character Voices tab", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Character Voices" }).click();
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

  test("Load Bible button is present in JSON tab", async ({ page }) => {
    await page.goto("/");
    await switchToJsonTab(page);
    await expect(page.locator("button", { hasText: "Load Bible" })).toBeVisible();
  });

  test("model selector shows Claude models", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("select")).toBeVisible();
    const options = await page.locator("select option").count();
    expect(options).toBeGreaterThan(0);
  });

  test("Learner tab shows empty state", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "Learner" }).click();
    await expect(page.locator("text=No edit patterns yet")).toBeVisible();
  });

  test("no JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
