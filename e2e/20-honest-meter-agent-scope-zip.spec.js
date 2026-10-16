import { test, expect, clearLocalStorage, injectOnboardingCompleted, injectConsentAccepted, navigateToProjects, uniqueProject, injectUsageData, waitForAppReady } from "./helpers";
import { createZip } from "../src/app/lib/project/zip";

async function createBrowserProject(page, project) {
  await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
  await page.locator("button.projects-new-button").first().click();
  await page.fill('input[placeholder="My Awesome Project"]', project.name);

  const browserStorage = page.locator("#project-browser");
  if (!(await browserStorage.isChecked())) {
    await browserStorage.check();
  }
  await expect(browserStorage).toBeChecked();

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
          localStorage.setItem("modcodes-workspace", JSON.stringify({ projectId: proj.id }));
        }
      } catch {}
    }, projectName);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(page.locator(".ide-workspace")).toBeVisible({ timeout: 15000 });
}

async function openAIPanel(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      if (btn.textContent.trim().toLowerCase().includes("panel")) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('button[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent.trim() === "AI") { tab.click(); break; }
    }
  });
  await page.waitForTimeout(500);
}

test.describe("Honest meter, agent scoping, and workspace ZIP", () => {
  test.beforeEach(async ({ modcodesPage: page }) => {
    await clearLocalStorage(page);
    await injectOnboardingCompleted(page);
    await injectConsentAccepted(page);
    await navigateToProjects(page);
    await page.waitForTimeout(1000);
  });

  test("shows the task meter with honest local-spend copy", async ({
    modcodesPage: page,
  }) => {
    await injectUsageData(page, {
      daily: { day: new Date().toISOString().split("T")[0], count: 1200 },
      projects: {},
      log: [
        {
          provider: "ollama",
          model: "qwen2.5-coder:1.5b",
          kind: "chat",
          label: "explain this file",
          durationMs: 842,
          inputTokens: null,
          outputTokens: 1200,
          totalTokens: 1200,
          known: true,
          accounting: "actual",
          timestamp: Date.now(),
        },
      ],
    });

    const project = uniqueProject();
    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);
    await openAIPanel(page);

    const meter = page.locator('[data-testid="task-meter"]');
    await expect(meter).toBeVisible({ timeout: 10000 });
    await expect(meter).toContainText("honest by design");
    await page.locator('[data-testid="task-meter-toggle"]').click();
    await expect(meter).toContainText("ollama");
    await expect(meter).toContainText("1k tok");
    await expect(meter).toContainText("$0.00");
    await expect(page.locator('[data-testid="task-meter-copy"]')).toBeVisible();
  });

  test("shows the honest agent scope chip", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);
    await openAIPanel(page);

    const scope = page.locator('[data-testid="agent-scope"]');
    await expect(scope).toBeVisible({ timeout: 10000 });
    await expect(scope).toContainText(/Offline agent|Ollama|Agent/);
  });

  test("exports the workspace as a ZIP file", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await page.keyboard.press("Control+Shift+p");
    await page.locator(".palette-input").fill("Export Workspace as ZIP");
    await page.keyboard.press("Enter");

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-workspace\.zip$/);
  });

  test("imports files from a workspace ZIP", async ({ modcodesPage: page }) => {
    const project = uniqueProject();
    await createBrowserProject(page, project);
    await openCreatedProject(page, project.name);

    const zip = createZip([
      { name: "imported/hello.txt", content: "hello from zip\n" },
    ]);
    expect(zip.ok).toBe(true);

    await page.setInputFiles('input[type="file"][accept*=".zip"]', {
      name: "import.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip.bytes),
    });

    const dialog = page.locator(".confirm-dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText("Import 1 file");
    await dialog.locator("button", { hasText: "Import" }).click();

    await expect(
      page.locator(".toast").filter({ hasText: "Imported 1 file(s) from ZIP." })
    ).toBeVisible({ timeout: 15000 });

    const filter = page.locator(".explorer-filter-input");
    await expect(filter).toBeVisible({ timeout: 10000 });
    await filter.fill("hello.txt");
    await page.waitForTimeout(400);
    await expect(page.locator(".tree-row").filter({ hasText: "hello.txt" })).toBeVisible({
      timeout: 10000,
    });
  });
});
