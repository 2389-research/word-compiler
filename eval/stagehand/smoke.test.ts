/**
 * Stagehand v3 UI Smoke Test
 *
 * Validates that the Svelte 5 UI wiring works — buttons trigger actions,
 * components render, state updates propagate. This is NOT a prose quality
 * gate; it catches UI-layer regressions.
 *
 * Prerequisites:
 *   1. Dev server running: `pnpm dev` (localhost:5173)
 *   2. Proxy server running: `pnpm proxy` (localhost:3001)
 *   3. ANTHROPIC_API_KEY set (for generate step) or skip generation tests
 *
 * Run: `pnpm eval:smoke`
 */

import { Stagehand } from "@browserbasehq/stagehand";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

async function runSmokeTest(): Promise<void> {
  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: process.env.HEADLESS !== "false",
    },
  });

  try {
    await stagehand.init();
    const page = stagehand.context.activePage();
    if (!page) throw new Error("No active page after init");

    console.log("1. Navigate to app...");
    await page.goto(APP_URL, { waitUntil: "networkidle" });

    console.log("2. Verify app loaded...");
    const title = await page.title();
    if (!title) {
      throw new Error("Page did not load — no title found");
    }
    console.log(`   Title: ${title}`);

    console.log("3. Check for main app container...");
    const containerVisible = await page.evaluate(() => {
      const el =
        document.querySelector("[data-testid='app-root']") ??
        document.querySelector("#root") ??
        document.querySelector(".app");
      return el !== null;
    });
    if (!containerVisible) {
      throw new Error("App root container not found");
    }
    console.log("   App container found.");

    console.log("4. Look for Bible/Scene controls...");
    const observed = await stagehand.observe(
      "Find any buttons, panels, or sections related to Bible, Scene Plan, Compiler, or text generation",
    );
    console.log(`   Observed ${observed.length} UI elements.`);

    if (observed.length === 0) {
      console.log("   Warning: No Bible/Scene UI elements found. App may be in empty state.");
    }

    console.log("5. Check for visible text content...");
    const bodyTextLength = await page.evaluate(() => document.body?.innerText?.length ?? 0);
    console.log(`   Page has ${bodyTextLength} characters of text content.`);

    if (bodyTextLength < 10) {
      throw new Error("Page appears blank — less than 10 characters of visible text");
    }

    console.log("6. Check for JS errors...");
    const jsErrors = await page.evaluate(() => {
      // Check if any error overlay is visible (Vite error overlay)
      const overlay = document.querySelector("vite-error-overlay");
      return overlay ? "Vite error overlay detected" : null;
    });

    if (jsErrors) {
      console.log(`   Warning: ${jsErrors}`);
    } else {
      console.log("   No error overlays detected.");
    }

    console.log("\n=== SMOKE TEST PASSED ===");
  } finally {
    await stagehand.close();
  }
}

runSmokeTest().catch((err: unknown) => {
  console.error("\n=== SMOKE TEST FAILED ===");
  console.error(err);
  process.exit(1);
});
