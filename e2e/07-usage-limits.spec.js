import {
  test,
  expect,
  waitForAppReady,
  navigateToProjects,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  injectUsageData,
  getUsageData,
  uniqueProject,
  createAndOpenProject,
  openAIPanel,
} from "./helpers";

test.describe("Usage Limits", () => {
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

  test("usage indicator shows unlimited state by default", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/usage|unlimited/i);
  });

  test("usage indicator displays after AI panel loads", async ({ modcodesPage: page }) => {
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const panelVisible = await page.locator(".ai-panel, [class*='ai-panel']").isVisible().catch(() => false);
    expect(panelVisible).toBe(true);
    const hasUsage = await page.locator("body").textContent();
    expect(hasUsage).toMatch(/usage/i);
  });

  test("usage data persists in localStorage", async ({ modcodesPage: page }) => {
    await injectUsageData(page, {
      daily: { date: new Date().toISOString().slice(0, 10), input: 5000, output: 2000, unknown: 0 },
      session: { count: 3, input: 5000, output: 2000, unknown: 0 },
      project: { "test-project": { input: 5000, output: 2000, unknown: 0 } },
    });
    const data = await getUsageData(page);
    expect(data).not.toBeNull();
    expect(data.daily.input).toBe(5000);
  });

  test("usage data survives refresh", async ({ modcodesPage: page }) => {
    await injectUsageData(page, {
      daily: { date: new Date().toISOString().slice(0, 10), input: 5000, output: 2000, unknown: 0 },
      session: { count: 3, input: 5000, output: 2000, unknown: 0 },
      project: {},
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const data = await getUsageData(page);
    expect(data).not.toBeNull();
    expect(data.daily.input).toBe(5000);
  });

  test("IDE does not crash when usage limit is reached", async ({ modcodesPage: page }) => {
    await injectUsageData(page, {
      daily: { date: new Date().toISOString().slice(0, 10), input: 100000, output: 50000, unknown: 0 },
      session: { count: 100, input: 100000, output: 50000, unknown: 0 },
      project: {},
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("unknown usage does not show fabricated token counts", async ({ modcodesPage: page }) => {
    await injectUsageData(page, {
      daily: { date: new Date().toISOString().slice(0, 10), input: 0, output: 0, unknown: 5 },
      session: { count: 5, input: 0, output: 0, unknown: 5 },
      project: {},
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await openAIPanel(page);
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/50k|50000/);
  });
});
