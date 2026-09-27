import {
  test,
  expect,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  navigateToProjects,
  uniqueProject,
  createAndOpenProject,
} from "./helpers";

test.describe("Quick ask bar with an open project", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
  });

  test("typing a question opens the AI panel and carries the text", async ({ modcodesPage: page }) => {
    const quick = page.locator(".chat-input .input");
    await expect(quick).toBeVisible();

    await quick.fill("What does this project do?");
    await quick.press("Enter");

    await expect(page.locator(".ide-right-panel")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".ai-panel, [class*='ai-panel']").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".ai-input")).toHaveValue("What does this project do?", { timeout: 15000 });
  });
});

test.describe("Quick ask bar without a project", () => {
  test("asking shows guidance instead of failing silently", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const quick = page.locator(".chat-input .input");
    await expect(quick).toBeVisible();
    await quick.fill("hello");
    await quick.press("Enter");

    await expect(quick).toHaveValue("");
    await expect(page.locator(".ide-workspace")).toHaveCount(0);
  });
});
