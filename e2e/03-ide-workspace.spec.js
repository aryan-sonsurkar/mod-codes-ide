import {
  test,
  expect,
  waitForAppReady,
  navigateToProjects,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  getProjects,
  uniqueProject,
  createAndOpenProject,
} from "./helpers";

test.describe("IDE Workspace", () => {
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

  test("IDE header shows project name", async ({ modcodesPage: page }) => {
    await expect(page.locator(".ide-header")).toContainText(project.name);
  });

  test("IDE header shows MODCODES branding", async ({ modcodesPage: page }) => {
    await expect(page.locator(".ide-header h1")).toContainText("MODCODES IDE");
  });

  test("workspace mode bar has all modes", async ({ modcodesPage: page }) => {
    const modeBar = page.locator(".workspace-mode-bar");
    await expect(modeBar).toContainText("Code");
    await expect(modeBar).toContainText("Overview");
    await expect(modeBar).toContainText("Research");
    await expect(modeBar).toContainText("PRD");
    await expect(modeBar).toContainText("Roadmap");
    await expect(modeBar).toContainText("Agent");
  });

  test("default workspace mode is Code", async ({ modcodesPage: page }) => {
    const codeBtn = page.locator(".workspace-mode-bar button", { hasText: "Code" });
    await expect(codeBtn).toHaveClass(/active/);
  });

  test("can switch to Overview mode", async ({ modcodesPage: page }) => {
    await page.locator(".workspace-mode-bar button", { hasText: "Overview" }).click({ force: true });
    await expect(page.locator(".project-overview")).toBeVisible();
  });

  test("can switch to Research mode", async ({ modcodesPage: page }) => {
    await page.locator(".workspace-mode-bar button", { hasText: "Research" }).click({ force: true });
    await expect(page.locator(".research-ws")).toBeVisible();
  });

  test("can switch to PRD mode", async ({ modcodesPage: page }) => {
    await page.locator(".workspace-mode-bar button", { hasText: "PRD" }).click({ force: true });
    await expect(page.locator(".prd-ws")).toBeVisible();
  });

  test("can switch to Roadmap mode", async ({ modcodesPage: page }) => {
    await page.locator(".workspace-mode-bar button", { hasText: "Roadmap" }).click({ force: true });
    await expect(page.locator(".roadmap-ws")).toBeVisible();
  });

  test("can switch to Agent mode", async ({ modcodesPage: page }) => {
    await page.locator(".workspace-mode-bar button", { hasText: "Agent" }).click({ force: true });
    await expect(page.locator(".agent-ws")).toBeVisible();
  });

  test("Explorer button toggles explorer panel", async ({ modcodesPage: page }) => {
    const explorerBtn = page.locator(".ide-header-actions button", { hasText: /explorer/i });
    const classBefore = await explorerBtn.getAttribute("class");
    await page.evaluate(() => {
      document.querySelector('.ide-header-actions button[title*="Explorer"]')?.click();
    });
    await page.waitForTimeout(500);
    const classAfter = await explorerBtn.getAttribute("class");
    expect(classBefore).not.toBe(classAfter);
  });

  test("Terminal button toggles terminal panel", async ({ modcodesPage: page }) => {
    await page.locator(".ide-header-actions button", { hasText: /terminal/i }).click({ force: true });
    await expect(page.locator(".ide-terminal-area")).toBeVisible();
  });

  test("Panels button toggles right panels", async ({ modcodesPage: page }) => {
    await page.locator(".ide-header-actions button", { hasText: /panels/i }).click({ force: true });
    await expect(page.locator(".ide-right-panel")).toBeVisible();
  });

  test("Back to Projects button works", async ({ modcodesPage: page }) => {
    await page.locator(".ide-header-actions button", { hasText: "Projects" }).click({ force: true });
    await expect(page).toHaveURL(/\/projects/);
  });

  test("no crash when switching rapidly between modes", async ({ modcodesPage: page }) => {
    const modes = ["Overview", "Research", "PRD", "Roadmap", "Agent", "Code"];
    for (const mode of modes) {
      await page.locator(".workspace-mode-bar button", { hasText: mode }).click({ force: true });
      await page.waitForTimeout(200);
    }
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
  });

  test("no console errors during mode switching", async ({ modcodesPage: page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const modes = ["Overview", "Research", "PRD", "Roadmap", "Agent", "Code"];
    for (const mode of modes) {
      await page.locator(".workspace-mode-bar button", { hasText: mode }).click({ force: true });
      await page.waitForTimeout(300);
    }
    expect(errors).toHaveLength(0);
  });
});
