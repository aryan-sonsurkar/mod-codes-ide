import {
  test,
  expect,
  MODCODES_APP_URL,
  PROJECTS_URL,
  SETTINGS_URL,
  LANDING_URL,
  waitForAppReady,
  navigateToLanding,
  navigateToProjects,
  navigateToSettings,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  injectConsentDeclined,
  injectProjects,
  uniqueProject,
  dismissOnboarding,
  dismissConsent,
} from "./helpers";

test.describe("Application Startup", () => {
  test("landing page loads with correct title", async ({ modcodesPage: page }) => {
    await navigateToLanding(page);
    await expect(page).toHaveTitle(/MODCODES/i);
  });

  test("landing page shows brand name", async ({ modcodesPage: page }) => {
    await navigateToLanding(page);
    await expect(page.locator("body")).toContainText("MODCODES");
  });

  test("navigation to projects page works", async ({ modcodesPage: page }) => {
    await navigateToLanding(page);
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL(/\/projects/);
  });

  test("navigation to settings page works", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await page.click('.sidebar a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);
  });

  test("sidebar is visible on projects page", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await expect(page.locator(".sidebar")).toBeVisible();
  });

  test("sidebar has correct links", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await expect(page.locator('.sidebar a[href="/"]')).toBeVisible();
    await expect(page.locator('.sidebar a[href="/projects"]')).toBeVisible();
    await expect(page.locator('.sidebar a[href="/settings"]')).toBeVisible();
  });

  test("projects page shows New Project button", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await expect(page.locator("button.projects-new-button").first()).toBeVisible();
  });

  test("empty projects page shows appropriate message", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await expect(page.locator("body")).toContainText(/projects/i);
  });

  test("no console errors on startup", async ({ modcodesPage: page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(e => !e.includes("hydration") && !e.includes("Non-Error"));
    expect(criticalErrors).toHaveLength(0);
  });

  test("no uncaught exceptions during normal navigation", async ({ modcodesPage: page }) => {
    const exceptions = [];
    page.on("pageerror", (err) => exceptions.push(err.message));
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await navigateToLanding(page);
    await page.click('a[href="/projects"]');
    await page.waitForTimeout(1000);
    await page.click('.sidebar a[href="/settings"]');
    await page.waitForTimeout(1000);
    await page.click('.sidebar a[href="/projects"]');
    await page.waitForTimeout(1000);
    expect(exceptions).toHaveLength(0);
  });
});
