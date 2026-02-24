import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const PROJECT_ID = "proj-e2e-test";

const MOCK_PROJECT = {
  id: PROJECT_ID,
  title: "E2E Test Project",
  status: "drafting",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

/**
 * Mocks the startup API calls so the app boots into the main UI
 * with a single empty project (no bible, no scenes).
 * Call BEFORE page.goto("/").
 */
export async function mockStartup(page: Page) {
  // List projects → single project
  await page.route("**/api/data/projects", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_PROJECT]) });
    }
    // POST — project creation
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
  });

  // Get project by ID (any project)
  await page.route(/\/api\/data\/projects\/[^/]+$/, (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECT) });
    }
    return route.continue();
  });

  // Latest bible → 404 (no bible yet)
  await page.route("**/bibles/latest", (route) => {
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No bible" }) });
  });

  // Bible versions → empty
  await page.route("**/bibles/versions", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Chapter arcs → empty
  await page.route("**/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    // POST chapters → success
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // POST bibles → echo back the body (any project)
  await page.route(/\/api\/data\/projects\/[^/]+\/bibles$/, (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
    }
    // GET bibles list → empty
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // POST scenes → return just the plan (matching real server behavior)
  await page.route("**/api/data/scenes", (route, request) => {
    if (request.method() === "POST") {
      try {
        const body = JSON.parse(request.postData() ?? "{}");
        const plan = body.plan ?? body;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plan) });
      } catch {
        return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
      }
    }
    return route.continue();
  });
}

/** Switch to the JSON tab inside the Project Atlas pane. */
export async function switchToJsonTab(page: Page) {
  // Atlas pane tabs are inside a .tabs container — find the JSON tab button
  const jsonTab = page.locator(".tabs button", { hasText: "JSON" });
  await expect(jsonTab).toBeVisible();
  await jsonTab.click();
}
