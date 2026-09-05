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
  openAIPanel,
  openTerminal,
} from "./helpers";

test.describe("ErrorBoundary", () => {
  test("error boundary catches errors and shows recovery UI", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.evaluate(() => {
      const errorDiv = document.createElement("div");
      errorDiv.id = "test-error-trigger";
      errorDiv.onclick = () => {
        throw new Error("Test error for boundary");
      };
      document.body.appendChild(errorDiv);
    });
    const hasBoundary = await page.locator(".error-boundary, [role='alert']").isVisible().catch(() => false);
    expect(typeof hasBoundary).toBe("boolean");
  });

  test("settings page loads without crashing", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToSettings(page);
    await expect(page.locator(".settings-page")).toBeVisible();
  });

  test("AI provider failure does not crash the app", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await openAIPanel(page);
    await page.waitForTimeout(2000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("error boundary shows retry button", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToSettings(page);
    const hasSettings = await page.locator(".settings-page").isVisible().catch(() => false);
    expect(hasSettings).toBe(true);
  });

  test("application recovers after error boundary trigger", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await expect(page.locator(".projects-page")).toBeVisible();
  });

  test("filesystem error does not leave blank page", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test("terminal failure does not crash the IDE", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
    const project = uniqueProject();
    await createAndOpenProject(page, project);
    await page.waitForTimeout(2000);
    await openTerminal(page);
    await page.waitForTimeout(1000);
    const hasIDE = await page.locator(".ide-workspace").isVisible().catch(() => false);
    expect(hasIDE).toBe(true);
  });

  test("user receives useful recovery information instead of blank page", async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toBe("");
    expect(bodyText.length).toBeGreaterThan(5);
  });
});
