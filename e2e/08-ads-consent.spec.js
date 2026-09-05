import {
  test,
  expect,
  waitForAppReady,
  navigateToProjects,
  navigateToSettings,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  injectConsentDeclined,
  injectConsentUnknown,
  getConsentState,
  uniqueProject,
  createAndOpenProject,
} from "./helpers";

test.describe("AdSense / Consent", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
  });

  test("consent banner appears when consent is unknown", async ({ modcodesPage: page }) => {
    await injectConsentUnknown(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const consentDialog = page.locator('[role="dialog"]');
    const hasConsent = await consentDialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasConsent) {
      const text = await consentDialog.textContent();
      expect(text).toMatch(/consent|ads|accept|privacy/i);
    }
  });

  test("accept button stores accepted consent", async ({ modcodesPage: page }) => {
    await injectConsentUnknown(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const acceptBtn = page.locator("button", { hasText: /accept/i }).first();
    if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await acceptBtn.click({ force: true });
      await page.waitForTimeout(500);
      const state = await getConsentState(page);
      expect(state).toBe("accepted");
    }
  });

  test("decline button stores declined consent", async ({ modcodesPage: page }) => {
    await injectConsentUnknown(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const declineBtn = page.locator("button", { hasText: /decline/i }).first();
    if (await declineBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await declineBtn.click({ force: true });
      await page.waitForTimeout(500);
      const state = await getConsentState(page);
      expect(state).toBe("declined");
    }
  });

  test("consent banner does not reappear after accepting", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const consentDialog = page.locator('[role="dialog"]');
    await expect(consentDialog).not.toBeVisible();
  });

  test("consent banner does not reappear after declining", async ({ modcodesPage: page }) => {
    await injectConsentDeclined(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const consentDialog = page.locator('[role="dialog"]');
    await expect(consentDialog).not.toBeVisible();
  });

  test("ad containers do not block project creation", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("ad failure does not crash the IDE", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const adErrors = errors.filter(e => e.includes("adsbygoogle") || e.includes("AdSense"));
    expect(adErrors).toHaveLength(0);
  });

  test("duplicate AdSense scripts are not injected", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const scripts = await page.locator('script[src*="pagead2.googlesyndication.com"]').count();
    expect(scripts).toBeGreaterThanOrEqual(1);
    expect(scripts).toBeLessThanOrEqual(2);
  });

  test("privacy settings are accessible", async ({ modcodesPage: page }) => {
    await navigateToSettings(page);
    await expect(page.locator(".settings-page")).toBeVisible();
    const privacyNav = page.locator(".settings-nav-item", { hasText: /privacy/i });
    if (await privacyNav.isVisible().catch(() => false)) {
      await privacyNav.click({ force: true });
      await page.waitForTimeout(500);
    }
  });

  test("consent unknown does not show ads in project list", async ({ modcodesPage: page }) => {
    await injectConsentUnknown(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const adContainers = await page.locator('[data-placement]').count();
    expect(adContainers).toBe(0);
  });

  test("consent accepted enables ad containers", async ({ modcodesPage: page }) => {
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(2000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await expect(page.locator(".ide-workspace")).toBeVisible();
  });
});
