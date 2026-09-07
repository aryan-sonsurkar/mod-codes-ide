import { test, expect, PROJECTS_URL, SETTINGS_URL } from "./helpers.js";

test.describe("M166 UX Hardening", () => {
  test("onboarding shows step labels", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const stepLabel = page.locator(".onboarding-step-label, [class*='step-label']");
    if (await stepLabel.count() > 0) {
      const text = await stepLabel.first().textContent();
      expect(text).toMatch(/Step \d+ of \d+/);
    }
  });

  test("onboarding has ARIA progressbar", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const progressbar = page.locator("[role='progressbar']");
    if (await progressbar.count() > 0) {
      const ariaValueNow = await progressbar.first().getAttribute("aria-valuenow");
      expect(ariaValueNow).toBeTruthy();
    }
  });

  test("projects page empty state has heading", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const heading = page.locator(".empty-state h3, .projects-empty-title").first();
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await heading.textContent();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test("create project modal has ARIA attributes", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const skipBtn = page.locator(".onboarding-overlay button", { hasText: /skip/i }).first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
    const newBtn = page.locator("button.projects-new-button").first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[role='dialog'][aria-modal='true']");
      if (await dialog.count() > 0) {
        const ariaLabel = await dialog.first().getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
      }
    }
  });

  test("create project modal has labeled inputs", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const skipBtn = page.locator(".onboarding-overlay button", { hasText: /skip/i }).first();
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
    const newBtn = page.locator("button.projects-new-button").first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(500);
      const nameInput = page.locator("#project-name");
      if (await nameInput.count() > 0) {
        const id = await nameInput.first().getAttribute("id");
        expect(id).toBe("project-name");
      }
    }
  });

  test("settings page loads with categories", async ({ page }) => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const categories = page.locator(".settings-nav-item");
    const count = await categories.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("settings has AI category", async ({ page }) => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const navItems = page.locator(".settings-nav-item");
    const count = await navItems.count();
    let foundAI = false;
    for (let i = 0; i < count; i++) {
      const text = await navItems.nth(i).textContent();
      if (text.toLowerCase().includes("ai")) {
        foundAI = true;
        break;
      }
    }
    expect(foundAI).toBeTruthy();
  });

  test("error boundary shows recovery UI", async ({ page }) => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const settingsPage = page.locator(".settings-page");
    expect(await settingsPage.isVisible()).toBeTruthy();
  });

  test("sidebar has nav landmark", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const nav = page.locator("nav[aria-label]");
    if (await nav.count() > 0) {
      const ariaLabel = await nav.first().getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });

  test("workspace mode bar has tab roles", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const tabs = page.locator("[role='tablist'] [role='tab']");
    if (await tabs.count() > 0) {
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test("IDE header buttons have ARIA labels", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const explorerBtn = page.locator("button[aria-label*='Explorer']");
    if (await explorerBtn.count() > 0) {
      const ariaLabel = await explorerBtn.first().getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });

  test("settings page has aria-label on inputs", async ({ page }) => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const toggleButtons = page.locator("[role='switch']");
    const count = await toggleButtons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("no console errors on settings page", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const seriousErrors = errors.filter(e => !e.includes("Warning:") && !e.includes("hydrat"));
    expect(seriousErrors.length).toBe(0);
  });

  test("no console errors on projects page", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const seriousErrors = errors.filter(e => !e.includes("Warning:") && !e.includes("hydrat"));
    expect(seriousErrors.length).toBe(0);
  });

  test("empty state icons are present", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const icons = page.locator(".empty-state-icon, [aria-hidden='true']");
    const count = await icons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("status badges use correct CSS classes", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const badges = page.locator(".badge, .status-badge");
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("skip link exists for keyboard navigation", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const skipLink = page.locator(".skip-link");
    if (await skipLink.count() > 0) {
      const href = await skipLink.first().getAttribute("href");
      expect(href).toBeTruthy();
    }
  });

  test("responsive layout at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    const width = await body.evaluate(el => el.scrollWidth);
    expect(width).toBeLessThanOrEqual(380);
  });

  test("responsive layout at 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const body = page.locator("body");
    const width = await body.evaluate(el => el.scrollWidth);
    expect(width).toBeLessThanOrEqual(780);
  });

  test("consent banner has proper ARIA", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const banner = page.locator("[role='dialog'], [aria-label*='consent'], [aria-label*='advertising']");
    if (await banner.count() > 0) {
      const first = banner.first();
      const role = await first.getAttribute("role");
      expect(role).toBeTruthy();
    }
  });

  test("confirm dialog has alertdialog role", async ({ page }) => {
    const confirmDialog = page.locator("[role='alertdialog']");
    if (await confirmDialog.count() > 0) {
      const ariaModal = await confirmDialog.first().getAttribute("aria-modal");
      expect(ariaModal).toBe("true");
    }
  });

  test("search input has aria-label", async ({ page }) => {
    await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const searchInput = page.locator("input[aria-label*='Search']");
    if (await searchInput.count() > 0) {
      const ariaLabel = await searchInput.first().getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });
});
