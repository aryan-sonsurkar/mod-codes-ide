import {
  test,
  expect,
  waitForAppReady,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  navigateToProjects,
  uniqueProject,
} from "./helpers";

async function createBrowserProject(page, project) {
  await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
  await page.locator("button.projects-new-button").first().click();
  await page.fill('input[placeholder="My Awesome Project"]', project.name);

  const browserStorage = page.locator("#project-browser");
  if (!(await browserStorage.isChecked())) {
    await browserStorage.check();
  }
  await expect(browserStorage).toBeChecked();
  await expect(page.locator("#project-location")).toHaveValue("This browser");

  await page.evaluate(() => {
    const btn = document.querySelector('.ProjectModal button[type="submit"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
}

async function openCreatedProject(page, projectName) {
  if (await page.locator(".ide-workspace").isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  const card = page.locator(".project-card").filter({ hasText: projectName });
  const openBtn = card.locator("button.projects-open-button");
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
  } else {
    await page.evaluate((name) => {
      try {
        const projects = JSON.parse(localStorage.getItem("modcodes-projects") || "[]");
        const proj = projects.find((p) => p.name === name);
        if (proj) {
          localStorage.setItem(
            "modcodes-workspace",
            JSON.stringify({ projectId: proj.id })
          );
        }
      } catch {}
    }, projectName);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await expect(page.locator(".ide-workspace")).toBeVisible({ timeout: 15000 });
}

async function openFileInExplorer(page, fileName) {
  const filter = page.locator(".explorer-filter-input");
  await expect(filter).toBeVisible({ timeout: 10000 });
  await filter.fill(fileName);
  await page.waitForTimeout(400);
  await page.locator(".tree-row").filter({ hasText: fileName }).first().click();
  await expect(page.locator(".tab-active").filter({ hasText: fileName })).toBeVisible({
    timeout: 10000,
  });
}

test.describe("Browser storage workspace", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
  });

  test("creates a project that keeps its files in the browser", async ({
    modcodesPage: page,
  }) => {
    const project = uniqueProject();

    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    await expect(page.locator(".ide-header")).toContainText(project.name);
    await expect(page.locator(".explorer-filter-input")).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("modcodes-projects") || "[]")
    );
    const created = stored.find((p) => p.name === project.name);
    expect(created.storage).toBe("virtual");
    expect(created.location).toBe("This browser");
  });

  test("seeds a runnable starter project and executes it", async ({
    modcodesPage: page,
  }) => {
    const project = uniqueProject();

    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    await openFileInExplorer(page, "index.js");

    await page.locator('button[aria-label="Run active file"]').click({ force: true });
    await expect(page.locator(".run-panel")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="run-console"]')).toContainText("hello", {
      timeout: 20000,
    });
    await expect(page.locator('[data-testid="run-summary"]')).toContainText("exited 0", {
      timeout: 20000,
    });
  });

  test("files survive a reload without any folder permission", async ({
    modcodesPage: page,
  }) => {
    const project = uniqueProject();

    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    await openFileInExplorer(page, "README.md");
    await expect(page.locator(".monaco-editor").first()).toContainText(
      "press **Run**",
      { timeout: 15000 }
    );
    const savedContent = await page.locator(".monaco-editor").first().innerText();

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.locator(".ide-workspace")).toBeVisible({ timeout: 15000 });

    const overview = page.locator(".project-overview");
    const overviewShown = await overview
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (overviewShown) {
      await overview.locator("button", { hasText: "Continue" }).first().click();
      await expect(overview).toBeHidden({ timeout: 5000 });
    }

    await openFileInExplorer(page, "README.md");
    await expect(page.locator(".monaco-editor").first()).toContainText(
      "press **Run**",
      { timeout: 15000 }
    );
    await expect
      .poll(() => page.locator(".monaco-editor").first().innerText(), {
        timeout: 15000,
      })
      .toBe(savedContent);
  });

  test("exports and imports project memory as .modcodes", async ({
    modcodesPage: page,
  }) => {
    const project = uniqueProject();
    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.keyboard.press("Control+Shift+p");
    await page.locator(".palette-input").fill("Export Project Memory");
    await page.keyboard.press("Enter");

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.modcodes$/);

    const content = [
      "---",
      "modcodesVersion: 1",
      "schemaVersion: 1",
      "project:",
      '  name: "Imported Memory Project"',
      "  phase: prd",
      "---",
      "",
      "# Overview",
      "imported memory marker",
      "",
    ].join("\n");

    await page.setInputFiles('input[type="file"][accept*=".modcodes"]', {
      name: "imported.modcodes",
      mimeType: "text/plain",
      buffer: Buffer.from(content),
    });

    await expect(
      page.locator(".toast").filter({ hasText: "Imported project memory" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".workspace-mode-bar-phase")).toContainText("prd");
  });

  test("falls back to a browser workspace when the folder API is missing", async ({
    modcodesPage: page,
  }) => {
    await page.addInitScript(() => {
      try {
        delete window.showDirectoryPicker;
      } catch {}
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);

    const project = uniqueProject();
    await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
    await page.locator("button.projects-new-button").first().click();
    await page.fill('input[placeholder="My Awesome Project"]', project.name);

    await expect(page.locator("#project-browser")).toBeChecked();
    await expect(page.locator("#project-location")).toHaveValue("This browser");

    await page.evaluate(() => {
      const btn = document.querySelector('.ProjectModal button[type="submit"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);

    await openCreatedProject(page, project.name);
    await expect(page.locator(".explorer-filter-input")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "This browser can't open a local folder."
    );
  });
});
