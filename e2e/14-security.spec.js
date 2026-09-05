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

test.describe("Security", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
  });

  test(".env is never exposed to AI context", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/\.env|API_KEY|SECRET|PASSWORD|TOKEN/i);
  });

  test("secrets never appear in ad containers", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const adContainers = page.locator('[data-placement]');
    const count = await adContainers.count();
    for (let i = 0; i < count; i++) {
      const text = await adContainers.nth(i).textContent();
      expect(text).not.toMatch(/API_KEY|SECRET|PASSWORD|TOKEN|\.env/i);
    }
  });

  test("usage tracking contains no source/prompt data", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const usageRaw = await page.evaluate(() => {
      try { return localStorage.getItem("modcodes-usage"); } catch { return null; }
    });
    if (usageRaw) {
      expect(usageRaw).not.toMatch(/console\.log|import |export |function |class /);
    }
  });

  test("project source is not passed to advertising", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const adContainers = page.locator('[data-placement]');
    const count = await adContainers.count();
    for (let i = 0; i < count; i++) {
      const text = await adContainers.nth(i).textContent();
      expect(text).not.toContain(project.name);
    }
  });

  test("no real credentials in E2E test output", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{48}/);
  });

  test("AdService is isolated from project data", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const adData = await page.evaluate(() => {
      try {
        const keys = Object.keys(localStorage);
        return keys.filter(k => k.includes("ad") || k.includes("Ad"));
      } catch { return []; }
    });
    for (const key of adData) {
      const val = await page.evaluate((k) => localStorage.getItem(k), key);
      if (val) {
        expect(val).not.toContain(project.name);
      }
    }
  });

  test("consent state is not leaked to project storage", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const projectsRaw = await page.evaluate(() => {
      try { return localStorage.getItem("modcodes-projects"); } catch { return null; }
    });
    if (projectsRaw) {
      expect(projectsRaw).not.toMatch(/consent|accepted|declined/i);
    }
  });
});
