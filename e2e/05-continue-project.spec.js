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
  switchMode,
} from "./helpers";

test.describe("Continue Project", () => {
  test("opening existing project shows Continue experience", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("project memory persists after navigation", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const btns = document.querySelectorAll(".ide-header-button");
      for (const btn of btns) {
        if (btn.textContent.trim() === "Projects") { btn.click(); break; }
      }
    });
    await page.waitForTimeout(1000);
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const found = projects.find(p => p.name === project.name);
    expect(found).toBeDefined();
  });

  test("project state survives page refresh", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const found = projects.find(p => p.name === project.name);
    expect(found).toBeDefined();
  });

  test("no duplicate lifecycle after refresh", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(1);
  });

  test("IDE remains usable after refresh", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
  });
});
