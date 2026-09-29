import {
  test,
  expect,
  waitForAppReady,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  navigateToProjects,
  uniqueProject,
  createAndOpenProject,
} from "./helpers";

async function openFileInExplorer(page, fileName) {
  const filter = page.locator(".explorer-filter-input");
  await expect(filter).toBeVisible({ timeout: 10000 });
  await filter.fill(fileName);
  await page.waitForTimeout(400);
  await page.locator(".tree-row").filter({ hasText: fileName }).first().click();
  await expect(page.locator(".tab-active").filter({ hasText: fileName })).toBeVisible({
    timeout: 10000,
  });
  await page.waitForTimeout(600);
}

async function runActiveFile(page) {
  await page.locator('button[aria-label="Run active file"]').click({ force: true });
  await expect(page.locator(".run-panel")).toBeVisible({ timeout: 10000 });
}

test.describe("Run panel and offline runtime", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    await createAndOpenProject(page, uniqueProject());
    await page.waitForTimeout(2000);
    await waitForAppReady(page);
  });

  test("Run button opens a docked run panel", async ({ modcodesPage: page }) => {
    await page.locator('button[aria-label="Run active file"]').click({ force: true });
    await expect(page.locator(".ide-terminal-area")).toBeVisible();
    await expect(page.locator(".run-panel")).toBeVisible();
    await expect(page.locator('.ide-dock-tab[aria-selected="true"]')).toHaveText("Run");
    await expect(page.locator('[data-testid="run-summary"]')).toBeVisible();
  });

  test("JavaScript executes in the browser and streams output", async ({ modcodesPage: page }) => {
    await openFileInExplorer(page, "index.js");
    await runActiveFile(page);

    await expect(page.locator('[data-testid="run-console"]')).toContainText("hello", {
      timeout: 20000,
    });
    await expect(page.locator('[data-testid="run-summary"]')).toContainText("exited 0", {
      timeout: 20000,
    });
    await expect(page.locator(".run-line-out").first()).toContainText("hello");
  });

  test("non-runnable files explain why instead of failing silently", async ({
    modcodesPage: page,
  }) => {
    await openFileInExplorer(page, "README.md");
    await runActiveFile(page);

    await expect(page.locator('[data-testid="run-summary"]')).toContainText("not runnable", {
      timeout: 10000,
    });
    await expect(page.locator(".run-line-err")).toContainText(/runtime|nothing to run|executable|program/i, {
      timeout: 10000,
    });
  });

  test("bottom dock switches between Terminal and Run", async ({ modcodesPage: page }) => {
    await runActiveFile(page);
    await expect(page.locator(".run-panel")).toBeVisible();

    await page.locator(".ide-dock-tab", { hasText: "Terminal" }).click();
    await expect(page.locator(".terminal-panel")).toBeVisible();
    await expect(page.locator(".run-panel")).not.toBeVisible();

    await page.locator(".ide-dock-tab", { hasText: "Run" }).click();
    await expect(page.locator(".run-panel")).toBeVisible();
  });

  test("a service worker is registered for offline use", async ({ modcodesPage: page }) => {
    const value = await page.evaluate(async () => {
      const deadline = Date.now() + 15000;

      while (Date.now() < deadline) {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && (reg.active || reg.waiting || reg.installing)) {
            return {
              scope: reg.scope,
              ready: Boolean(reg.active || reg.waiting || reg.installing),
            };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return null;
    });

    expect(value).not.toBeNull();
    expect(value.scope).toContain("localhost");
    expect(value.ready).toBe(true);
  });

  test("the app shell is declared as an installable PWA", async ({ modcodesPage: page }) => {
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href")
      .catch(() => null);
    expect(manifestHref).toBe("/manifest.json");

    const manifest = await page.evaluate(async () => {
      const response = await fetch("/manifest.json");
      if (!response.ok) {
        return null;
      }
      return response.json();
    });
    expect(manifest).not.toBeNull();
    expect(manifest.name).toContain("MODCODES");
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
  });

  test("the service worker script is served and versioned", async ({ modcodesPage: page }) => {
    const sw = await page.evaluate(async () => {
      const response = await fetch("/sw.js");
      if (!response.ok) {
        return { ok: false, body: "" };
      }
      return { ok: true, body: await response.text() };
    });
    expect(sw.ok).toBe(true);
    expect(sw.body).toContain("modcodes-sw-");
    expect(sw.body).toContain("skipWaiting");
  });
});
