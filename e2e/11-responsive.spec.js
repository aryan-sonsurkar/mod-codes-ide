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
} from "./helpers";

const VIEWPORTS = [
  { width: 320, height: 568, name: "mobile-sm" },
  { width: 375, height: 667, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1024, height: 768, name: "desktop-sm" },
  { width: 1280, height: 720, name: "desktop" },
];

test.describe("Responsive Browser Tests", () => {
  for (const vp of VIEWPORTS) {
    test(`layout at ${vp.name} (${vp.width}x${vp.height})`, async ({ modcodesPage: page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await clearLocalStorage(page);
      await injectOnboardingCompleted(page);
      await injectConsentAccepted(page);
      await navigateToProjects(page);
      await page.waitForTimeout(1000);
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
      const bodyText = await page.locator("body").textContent();
      expect(bodyText.length).toBeGreaterThan(10);
    });
  }

  test("navigation remains usable on mobile (320px)", async ({ modcodesPage: page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await expect(page.locator(".sidebar")).toBeVisible();
    const sidebarLinks = await page.locator(".sidebar a").count();
    expect(sidebarLinks).toBeGreaterThanOrEqual(2);
  });

  test("navigation remains usable on tablet (768px)", async ({ modcodesPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await expect(page.locator(".sidebar")).toBeVisible();
    const newProjectBtn = page.locator(".projects-new-button, button", { hasText: /new project/i }).first();
    await expect(newProjectBtn).toBeVisible();
  });

  test("project creation works at mobile size", async ({ modcodesPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("AI panel accessible at tablet size", async ({ modcodesPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await openAIPanel(page);
    await expect(page.locator(".ai-panel, [class*='ai-panel']")).toBeVisible();
  });

  test("workspace mode bar works at all viewports", async ({ modcodesPage: page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await clearLocalStorage(page);
      await injectOnboardingCompleted(page);
      await injectConsentAccepted(page);
      await navigateToProjects(page);
      await page.waitForTimeout(1000);
      const project = uniqueProject();
      await createAndOpenProject(page, project);
      await page.waitForTimeout(2000);
      await expect(page.locator(".workspace-mode-bar")).toBeVisible();
      await switchMode(page, "Overview");
      await expect(page.locator(".workspace-mode-bar button", { hasText: "Overview" })).toHaveClass(/active/);
      await page.evaluate(() => {
        const btns = document.querySelectorAll(".ide-header-button");
        for (const btn of btns) {
          if (btn.textContent.trim() === "Projects") { btn.click(); break; }
        }
      });
      await page.waitForTimeout(500);
    }
  });
});
