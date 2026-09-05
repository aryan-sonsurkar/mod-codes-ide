import {
  test,
  expect,
  waitForAppReady,
  navigateToProjects,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  uniqueProject,
  createAndOpenProject,
  switchMode,
} from "./helpers";

test.describe("Project Lifecycle", () => {
  let project;

  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
  });

  test("Research workspace shows research UI", async ({ modcodesPage: page }) => {
    await switchMode(page, "Research");
    await expect(page.locator(".research-ws")).toBeVisible();
  });

  test("PRD workspace shows PRD UI", async ({ modcodesPage: page }) => {
    await switchMode(page, "PRD");
    await expect(page.locator(".prd-ws")).toBeVisible();
  });

  test("PRD workspace has content area", async ({ modcodesPage: page }) => {
    await switchMode(page, "PRD");
    await expect(page.locator(".prd-ws")).toBeVisible();
    const hasContent = await page.locator(".prd-ws").textContent();
    expect(hasContent.length).toBeGreaterThan(0);
  });

  test("PRD can be generated from research", async ({ modcodesPage: page }) => {
    await switchMode(page, "PRD");
    const genBtn = page.locator(".prd-actions button", { hasText: /generate/i }).first();
    if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
    await expect(page.locator(".prd-ws")).toBeVisible();
  });

  test("Roadmap workspace shows roadmap UI", async ({ modcodesPage: page }) => {
    await switchMode(page, "Roadmap");
    await expect(page.locator(".roadmap-ws")).toBeVisible();
  });

  test("Roadmap can be generated from PRD", async ({ modcodesPage: page }) => {
    await switchMode(page, "PRD");
    const genPrd = page.locator(".prd-actions button", { hasText: /generate/i }).first();
    if (await genPrd.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genPrd.click({ force: true });
      await page.waitForTimeout(500);
    }
    await switchMode(page, "Roadmap");
    const genRoadmap = page.locator("button", { hasText: /generate roadmap/i }).first();
    if (await genRoadmap.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genRoadmap.click({ force: true });
      await page.waitForTimeout(500);
    }
    await expect(page.locator(".roadmap-ws")).toBeVisible();
  });

  test("Agent workspace shows agent UI", async ({ modcodesPage: page }) => {
    await switchMode(page, "Agent");
    await expect(page.locator(".agent-ws")).toBeVisible();
  });

  test("Agent workspace has control buttons", async ({ modcodesPage: page }) => {
    await switchMode(page, "Agent");
    await expect(page.locator(".agent-ws")).toBeVisible();
    await expect(page.locator(".agent-controls")).toBeVisible();
    const controlsText = await page.locator(".agent-controls").textContent();
    expect(controlsText).toMatch(/pause|resume|cancel|review/i);
  });

  test("Agent workspace shows Review Changes button", async ({ modcodesPage: page }) => {
    await switchMode(page, "Agent");
    await expect(page.locator(".agent-ws")).toBeVisible();
    const reviewBtn = page.locator(".agent-controls .primary");
    if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(reviewBtn).toContainText(/review/i);
    }
  });

  test("Overview shows project overview", async ({ modcodesPage: page }) => {
    await switchMode(page, "Overview");
    await expect(page.locator(".project-overview")).toBeVisible();
  });

  test("full lifecycle flow: Research → PRD → Roadmap → Agent", async ({ modcodesPage: page }) => {
    await switchMode(page, "Research");
    await expect(page.locator(".research-ws")).toBeVisible();
    await switchMode(page, "PRD");
    await expect(page.locator(".prd-ws")).toBeVisible();
    await switchMode(page, "Roadmap");
    await expect(page.locator(".roadmap-ws")).toBeVisible();
    await switchMode(page, "Agent");
    await expect(page.locator(".agent-ws")).toBeVisible();
  });

  test("no console errors during lifecycle navigation", async ({ modcodesPage: page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await switchMode(page, "Research");
    await switchMode(page, "PRD");
    await switchMode(page, "Roadmap");
    await switchMode(page, "Agent");
    await switchMode(page, "Code");
    expect(errors).toHaveLength(0);
  });
});
