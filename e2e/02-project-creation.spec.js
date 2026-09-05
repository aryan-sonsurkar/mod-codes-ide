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
} from "./helpers";

test.describe("Project Creation", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
  });

  test("New Project button opens modal", async ({ modcodesPage: page }) => {
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await expect(page.locator(".ProjectModal")).toBeVisible();
  });

  test("create project modal has required fields", async ({ modcodesPage: page }) => {
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await expect(page.locator(".ProjectModal")).toBeVisible();
    await expect(page.locator('input[placeholder="My Awesome Project"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Select a folder"]')).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("create project modal has Create and Cancel buttons", async ({ modcodesPage: page }) => {
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await expect(page.locator('.ProjectModal button[type="submit"]')).toBeVisible();
    await expect(page.locator('.ProjectModal button[type="reset"]')).toBeVisible();
  });

  test("creating a project adds it to localStorage", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', project.name);
    await page.locator(".ProjectModal button", { hasText: "Browse" }).click();
    await page.waitForTimeout(500);
    await page.locator('.ProjectModal button[type="submit"]').click();
    const projects = await getProjects(page);
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe(project.name);
  });

  test("creating a project opens the IDE or shows workspace", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', project.name);
    await page.locator(".ProjectModal button", { hasText: "Browse" }).click();
    await page.waitForTimeout(500);
    await page.locator('.ProjectModal button[type="submit"]').click();
    await page.waitForTimeout(3000);
    const hasWorkspace = await page.locator(".workspace, .ide-workspace, .ide-header, .workspace-mode-bar, .ide-status").isVisible().catch(() => false);
    expect(hasWorkspace).toBe(true);
  });

  test("cancel button closes modal", async ({ modcodesPage: page }) => {
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await expect(page.locator(".ProjectModal")).toBeVisible();
    await page.locator('.ProjectModal button[type="reset"]').click();
    await expect(page.locator(".ProjectModal")).not.toBeVisible();
  });

  test("clicking Cancel closes modal", async ({ modcodesPage: page }) => {
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await expect(page.locator(".ProjectModal")).toBeVisible();
    await page.locator('.ProjectModal button[type="reset"]').click();
    await expect(page.locator(".ProjectModal")).not.toBeVisible();
  });

  test("project appears in project list after creation", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', project.name);
    await page.locator(".ProjectModal button", { hasText: "Browse" }).click();
    await page.waitForTimeout(500);
    await page.locator('.ProjectModal button[type="submit"]').click();
    await page.waitForTimeout(1000);
    const projects = await getProjects(page);
    const found = projects.find(p => p.name === project.name);
    expect(found).toBeDefined();
    expect(found.name).toBe(project.name);
  });

  test("multiple projects can be created", async ({ modcodesPage: page }) => {
    const p1 = uniqueProject();
    const p2 = uniqueProject();
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', p1.name);
    await page.locator(".ProjectModal button", { hasText: "Browse" }).click();
    await page.waitForTimeout(500);
    await page.locator('.ProjectModal button[type="submit"]').click();
    await page.waitForTimeout(1000);
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', p2.name);
    await page.locator(".ProjectModal button", { hasText: "Browse" }).click();
    await page.waitForTimeout(500);
    await page.locator('.ProjectModal button[type="submit"]').click();
    const projects = await getProjects(page);
    expect(projects.length).toBe(2);
  });
});
