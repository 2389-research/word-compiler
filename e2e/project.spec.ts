import { expect, test, type Page } from "@playwright/test";

const MOCK_PROJECTS = [
  { id: "proj-1", title: "The Letter", status: "drafting", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-02T00:00:00Z" },
  { id: "proj-2", title: "Summer Noir", status: "planning", createdAt: "2025-02-01T00:00:00Z", updatedAt: "2025-02-02T00:00:00Z" },
  { id: "proj-3", title: "First Light", status: "bootstrap", createdAt: "2025-03-01T00:00:00Z", updatedAt: "2025-03-02T00:00:00Z" },
];

async function mockMultiProject(page: Page) {
  // List projects → 3 projects (triggers project list view)
  await page.route("**/api/data/projects", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECTS) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PROJECTS[0]) });
  });

  // Get project by ID
  await page.route(/\/api\/data\/projects\/[^/]+$/, (route, request) => {
    if (request.method() === "GET") {
      const url = request.url();
      const id = url.split("/").pop();
      const proj = MOCK_PROJECTS.find((p) => p.id === id) ?? MOCK_PROJECTS[0];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(proj) });
    }
    return route.continue();
  });

  // Latest bible → 404
  await page.route("**/bibles/latest", (route) => {
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No bible" }) });
  });

  // Bible versions → empty
  await page.route("**/bibles/versions", (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Chapters → empty
  await page.route("**/chapters", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
  });

  // Bibles → empty
  await page.route(/\/api\/data\/projects\/[^/]+\/bibles$/, (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: request.postData() ?? "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

test.describe("Multi-project", () => {
  test.beforeEach(async ({ page }) => {
    await mockMultiProject(page);
  });

  test("shows ProjectList when multiple projects exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Projects")).toBeVisible();
    await expect(page.locator("text=The Letter")).toBeVisible();
    await expect(page.locator("text=Summer Noir")).toBeVisible();
    await expect(page.locator("text=First Light")).toBeVisible();
  });

  test("selecting a project navigates to workspace", async ({ page }) => {
    await page.goto("/");
    // Click on "The Letter" project
    await page.locator("text=The Letter").click();
    // Should now show the main Word Compiler UI
    await expect(page.locator("text=Word Compiler").first()).toBeVisible();
    await expect(page.locator("text=Bible + Plan")).toBeVisible();
  });

  test("New Project button is visible in project list", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("button", { hasText: "New Project" })).toBeVisible();
  });
});
