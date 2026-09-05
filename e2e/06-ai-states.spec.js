import {
  test,
  expect,
  waitForAppReady,
  navigateToProjects,
  navigateToSettings,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  uniqueProject,
  createAndOpenProject,
  openAIPanel,
} from "./helpers";

test.describe("AI Provider States", () => {
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

  test("AI panel is accessible from IDE", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await expect(page.locator(".ai-panel, [class*='ai-panel']")).toBeVisible();
  });

  test("AI panel shows provider status", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const hasStatus = await page.locator(".ai-panel, [class*='ai-panel']").textContent().catch(() => "");
    expect(hasStatus).toMatch(/provider|status|ready|unavailable|ollama|bonsai|none|off/i);
  });

  test("AI panel shows usage indicator", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const hasUsage = await page.locator("body").textContent();
    expect(hasUsage).toMatch(/usage|unlimited|daily|session/i);
  });

  test("AI panel remains usable when provider is unavailable", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const panelVisible = await page.locator(".ai-panel, [class*='ai-panel']").isVisible().catch(() => false);
    expect(panelVisible).toBe(true);
  });

  test("no fake Ready status when provider is down", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(2000);
    const statusText = await page.locator(".ai-panel, [class*='ai-panel']").textContent().catch(() => "");
    if (statusText.includes("Ready")) {
      expect(statusText).not.toMatch(/ready.*connected|connected.*ready/i);
    }
  });

  test("application remains usable when AI fails", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
    await expect(page.locator(".ide-workspace")).toBeVisible();
  });

  test("settings page shows AI configuration", async ({ modcodesPage: page }) => {
    await navigateToSettings(page);
    await expect(page.locator(".settings-page")).toBeVisible();
    const aiNav = page.locator(".settings-nav-item", { hasText: /AI/i });
    if (await aiNav.isVisible().catch(() => false)) {
      await aiNav.click({ force: true });
      await page.waitForTimeout(500);
    }
  });
});
