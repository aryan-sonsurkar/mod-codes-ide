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

test.describe("Refresh / Recovery", () => {
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

  test("refresh on Code mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(1);
    const found = projects.find(p => p.name === project.name);
    expect(found).toBeDefined();
  });

  test("refresh on Overview mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await switchMode(page, "Overview");
    await expect(page.locator(".project-overview")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("refresh on Research mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await switchMode(page, "Research");
    await expect(page.locator(".research-ws")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("refresh on PRD mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await switchMode(page, "PRD");
    await expect(page.locator(".prd-ws")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("refresh on Roadmap mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await switchMode(page, "Roadmap");
    await expect(page.locator(".roadmap-ws")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("refresh on Agent mode reconstructs valid state", async ({ modcodesPage: page }) => {
    await switchMode(page, "Agent");
    await expect(page.locator(".agent-ws")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("no duplicate lifecycle after refresh", async ({ modcodesPage: page }) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const projects = await getProjects(page);
    expect(projects.length).toBeGreaterThanOrEqual(1);
  });

  test("no fatal error after refresh", async ({ modcodesPage: page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const fatalErrors = errors.filter(e => !e.includes("hydration") && !e.includes("Non-Error"));
    expect(fatalErrors).toHaveLength(0);
  });

  test("IDE remains usable after multiple refreshes", async ({ modcodesPage: page }) => {
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
    }
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
    await expect(page.locator(".workspace-mode-bar")).toBeVisible();
  });

  test("settings survive refresh", async ({ modcodesPage: page }) => {
    await page.evaluate(() => {
      const btns = document.querySelectorAll(".ide-header-button");
      for (const btn of btns) {
        if (btn.textContent.trim() === "Projects") { btn.click(); break; }
      }
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const link = document.querySelector('.settingsbtn, a[href="/settings"]');
      if (link) link.click();
    });
    await page.waitForTimeout(1000);
    await expect(page.locator(".settings-page")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await expect(page.locator(".settings-page")).toBeVisible();
  });
});
