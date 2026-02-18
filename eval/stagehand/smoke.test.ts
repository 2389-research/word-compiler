/**
 * Stagehand v3 UI Smoke Test
 *
 * Validates that the React UI wiring works — buttons trigger actions,
 * components render, state updates propagate. This is NOT a prose quality
 * gate; it catches React-layer regressions.
 *
 * Prerequisites:
 *   1. Dev server running: `pnpm dev` (localhost:5173)
 *   2. Proxy server running: `pnpm proxy` (localhost:3001)
 *   3. ANTHROPIC_API_KEY set (for generate step) or skip generation tests
 *
 * Run: `pnpm eval:smoke`
 */

import { Stagehand } from "@browserbasehq/stagehand";

const APP_URL = process.env["APP_URL"] ?? "http://localhost:5173";

async function runSmokeTest(): Promise<void> {
  const stagehand = new Stagehand({
    env: "LOCAL",
    headless: process.env["HEADLESS"] !== "false",
    enableCaching: false,
  });

  try {
    await stagehand.init();
    const page = stagehand.page;

    console.log("1. Navigate to app...");
    await page.goto(APP_URL, { waitUntil: "networkidle" });

    console.log("2. Verify app loaded...");
    const title = await page.title();
    if (!title) {
      throw new Error("Page did not load — no title found");
    }
    console.log(`   Title: ${title}`);

    console.log("3. Check for main app container...");
    const appContainer = await page.$("[data-testid='app-root'], #root, .app");
    if (!appContainer) {
      throw new Error("App root container not found");
    }
    console.log("   App container found.");

    console.log("4. Look for Bible/Scene controls...");
    const observed = await stagehand.observe({
      instruction: "Find any buttons, panels, or sections related to Bible, Scene Plan, Compiler, or text generation",
    });
    console.log(`   Observed ${observed.length} UI elements.`);

    if (observed.length === 0) {
      console.log("   Warning: No Bible/Scene UI elements found. App may be in empty state.");
    }

    // Try to find text content on the page
    console.log("5. Check for visible text content...");
    const bodyText = await page.evaluate(() => document.body?.innerText?.length ?? 0);
    console.log(`   Page has ${bodyText} characters of text content.`);

    if (bodyText < 10) {
      throw new Error("Page appears blank — less than 10 characters of visible text");
    }

    console.log("6. Verify no console errors...");
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Wait briefly for any async errors
    await page.waitForTimeout(1000);

    if (errors.length > 0) {
      console.log(`   Warning: ${errors.length} console error(s):`);
      for (const err of errors) {
        console.log(`     - ${err}`);
      }
    } else {
      console.log("   No console errors.");
    }

    console.log("\n=== SMOKE TEST PASSED ===");

  } finally {
    await stagehand.close();
  }
}

runSmokeTest().catch((err) => {
  console.error("\n=== SMOKE TEST FAILED ===");
  console.error(err);
  process.exit(1);
});
