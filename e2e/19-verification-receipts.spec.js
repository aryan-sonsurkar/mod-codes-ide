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

test.describe("Verification receipts", () => {
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

  test("a successful run records a passing receipt", async ({ modcodesPage: page }) => {
    await openFileInExplorer(page, "index.js");
    await page.locator('button[aria-label="Run active file"]').click({ force: true });
    await expect(page.locator(".run-panel")).toBeVisible({ timeout: 10000 });

    const receipt = page.locator('[data-testid="run-receipt"]');
    await expect(receipt).toBeVisible({ timeout: 20000 });
    await expect(receipt).toContainText("passed");
    await expect(receipt).toContainText("index.js");
  });

  test("a non-runnable file records a nothing-to-run receipt", async ({
    modcodesPage: page,
  }) => {
    await openFileInExplorer(page, "README.md");
    await page.locator('button[aria-label="Run active file"]').click({ force: true });
    await expect(page.locator(".run-panel")).toBeVisible({ timeout: 10000 });

    const receipt = page.locator('[data-testid="run-receipt"]');
    await expect(receipt).toBeVisible({ timeout: 10000 });
    await expect(receipt).toContainText("nothing to run");
    await expect(receipt).toContainText("README.md");
  });

  test("Clear removes the receipt along with the output", async ({ modcodesPage: page }) => {
    await openFileInExplorer(page, "index.js");
    await page.locator('button[aria-label="Run active file"]').click({ force: true });
    await expect(page.locator('[data-testid="run-receipt"]')).toBeVisible({ timeout: 20000 });

    await page.locator('button[title="Clear output"]').click();
    await expect(page.locator('[data-testid="run-receipt"]')).not.toBeVisible();
  });
});
