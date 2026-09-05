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
  openAIPanel,
  openTerminal,
  closeTerminal,
  toggleExplorer,
  togglePanels,
} from "./helpers";

test.describe("Monaco / IDE Usability", () => {
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

  test("IDE opens with explorer panel visible by default", async ({ modcodesPage: page }) => {
    const hasExplorer = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasExplorer).toBe(true);
  });

  test("file explorer shows project files", async ({ modcodesPage: page }) => {
    const hasFiles = await page.locator("body").textContent();
    expect(hasFiles).toMatch(/package\.json|src|README/i);
  });

  test("can switch between workspace modes", async ({ modcodesPage: page }) => {
    const modes = ["Overview", "Research", "PRD", "Roadmap", "Agent", "Code"];
    for (const mode of modes) {
      await switchMode(page, mode);
      await expect(page.locator(".workspace-mode-bar button", { hasText: mode })).toHaveClass(/active/);
    }
  });

  test("workspace mode bar is always accessible", async ({ modcodesPage: page }) => {
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
    await switchMode(page, "Research");
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
    await switchMode(page, "Code");
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
  });

  test("AI panel is accessible from IDE header", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await expect(page.locator(".ai-panel, [class*='ai-panel']")).toBeVisible();
  });

  test("terminal panel can be toggled", async ({ modcodesPage: page }) => {
    await openTerminal(page);
    await expect(page.locator(".ide-terminal-area")).toBeVisible();
    await closeTerminal(page);
    await expect(page.locator(".ide-terminal-area")).not.toBeVisible();
  });

  test("explorer panel can be toggled", async ({ modcodesPage: page }) => {
    await toggleExplorer(page);
    await page.waitForTimeout(300);
    await toggleExplorer(page);
    await expect(page.locator(".file-explorer")).toBeVisible();
  });

  test("right panels can be toggled", async ({ modcodesPage: page }) => {
    await togglePanels(page);
    await page.waitForTimeout(300);
    await togglePanels(page);
    await expect(page.locator(".ide-panel-tabs")).toBeVisible();
  });

  test("header shows project name and MODCODES branding", async ({ modcodesPage: page }) => {
    await expect(page.locator(".ide-header h1")).toContainText("MODCODES IDE");
    await expect(page.locator(".ide-header")).toContainText(project.name);
  });

  test("no horizontal overflow in IDE", async ({ modcodesPage: page }) => {
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
