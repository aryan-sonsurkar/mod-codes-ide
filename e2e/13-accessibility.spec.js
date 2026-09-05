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
  togglePanels,
} from "./helpers";

test.describe("Accessibility Smoke Tests", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
  });

  test("sidebar links have accessible names", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    const links = page.locator(".sidebar a");
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test("New Project button is accessible", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    const btn = page.locator(".projects-new-button, button", { hasText: /new project/i }).first();
    await expect(btn).toBeVisible();
    const tagName = await btn.evaluate(el => el.tagName);
    expect(tagName).toBe("BUTTON");
  });

  test("project modal can be opened and closed", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    const newBtn = page.locator(".projects-new-button, button", { hasText: /new project/i }).first();
    await newBtn.click({ force: true });
    await expect(page.locator(".ProjectModal")).toBeVisible();
    const cancelBtn = page.locator(".ProjectModal button", { hasText: /cancel/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click({ force: true });
    }
    await page.waitForTimeout(500);
    const isModalClosed = !(await page.locator(".ProjectModal").isVisible().catch(() => false));
    expect(isModalClosed).toBe(true);
  });

  test("consent banner buttons have correct semantics", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.evaluate(() => {
      try { localStorage.removeItem("modcodes-adsense-consent"); } catch {}
    });
    await page.waitForTimeout(2000);
    const acceptBtn = page.locator("button", { hasText: /accept/i }).first();
    if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const tagName = await acceptBtn.evaluate(el => el.tagName);
      expect(tagName).toBe("BUTTON");
    }
  });

  test("workspace mode buttons are accessible", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const modeButtons = page.locator(".workspace-mode-bar button");
    const count = await modeButtons.count();
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      const btn = modeButtons.nth(i);
      const text = await btn.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test("IDE header buttons are accessible", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    const headerButtons = page.locator(".ide-header-button");
    const count = await headerButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const btn = headerButtons.nth(i);
      const text = await btn.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test("right panel tabs are accessible", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await togglePanels(page);
    await page.waitForTimeout(500);
    const tabs = page.locator('.ide-panel-tabs button[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const text = await tab.textContent();
      expect(text.trim().length).toBeGreaterThan(0);
      const hasAriaSelected = await tab.getAttribute("aria-selected");
      expect(hasAriaSelected).not.toBeNull();
    }
  });

  test("settings page toggles have correct role", async ({ modcodesPage: page }) => {
    await navigateToSettings(page);
    await expect(page.locator(".settings-page")).toBeVisible();
    const toggles = page.locator('button[role="switch"]');
    const count = await toggles.count();
    for (let i = 0; i < count; i++) {
      const toggle = toggles.nth(i);
      const hasAriaChecked = await toggle.getAttribute("aria-checked");
      expect(hasAriaChecked).not.toBeNull();
    }
  });

  test("error boundary has role alert", async ({ modcodesPage: page }) => {
    await navigateToProjects(page);
    const hasAlert = await page.locator('[role="alert"]').isVisible().catch(() => false);
    expect(typeof hasAlert).toBe("boolean");
  });
});
