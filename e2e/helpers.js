import { test as base, expect } from "@playwright/test";

const MODCODES_APP_URL = "http://localhost:3000";
const PROJECTS_URL = `${MODCODES_APP_URL}/projects`;
const SETTINGS_URL = `${MODCODES_APP_URL}/settings`;
const LANDING_URL = MODCODES_APP_URL;

function uniqueProject() {
  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: `E2E ${id}`,
    location: `test-folder-${id}`,
    type: "Blank Project",
    bringing: "idea",
    git: false,
    githubRepo: false,
    createdAt: Date.now(),
    lastOpened: Date.now(),
    favorite: false,
  };
}

async function clearLocalStorage(page) {
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
  });
}

async function injectOnboardingCompleted(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("modcodes.onboarding.completed", "true"); } catch {}
  });
}

async function injectConsentAccepted(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("modcodes-adsense-consent", "accepted"); } catch {}
  });
}

async function injectConsentDeclined(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("modcodes-adsense-consent", "declined"); } catch {}
  });
}

async function injectConsentUnknown(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem("modcodes-adsense-consent"); } catch {}
  });
}

async function injectProjects(page, projects) {
  await page.evaluate((data) => {
    try { localStorage.setItem("modcodes-projects", JSON.stringify(data)); } catch {}
  }, projects);
}

async function injectUsageData(page, data) {
  await page.evaluate((d) => {
    try { localStorage.setItem("modcodes-usage", JSON.stringify(d)); } catch {}
  }, data);
}

async function getProjects(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("modcodes-projects");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
}

async function getConsentState(page) {
  return page.evaluate(() => {
    try { return localStorage.getItem("modcodes-adsense-consent") || "unknown"; }
    catch { return "unknown"; }
  });
}

async function getUsageData(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("modcodes-usage");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
}

function buildFileTree(files) {
  const root = { kind: "directory", name: "test-project", children: [] };
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let child = current.children.find(c => c.name === parts[i] && c.kind === "directory");
      if (!child) {
        child = { kind: "directory", name: parts[i], children: [] };
        current.children.push(child);
      }
      current = child;
    }
    const fileName = parts[parts.length - 1];
    current.children.push({ kind: "file", name: fileName, content });
  }
  return root;
}

function createDirectoryHandle(tree, handleName) {
  const fileHandlesMap = new Map();
  const dirHandlesMap = new Map();

  function walk(node, path) {
    if (node.kind === "file") {
      const filePath = path;
      const content = node.content || "";
      fileHandlesMap.set(filePath, {
        kind: "file",
        name: node.name,
        getFile: async () => ({
          name: node.name,
          text: async () => content,
          size: content.length,
          lastModified: Date.now(),
        }),
      });
      return;
    }
    if (node.kind === "directory") {
      dirHandlesMap.set(path, node);
      for (const child of (node.children || [])) {
        walk(child, `${path}/${child.name}`);
      }
    }
  }

  walk(tree, handleName);

  function makeDirHandle(name, path) {
    const node = dirHandlesMap.get(path) || tree;
    return {
      kind: "directory",
      name,
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      values: async function* () {
        for (const child of (node.children || [])) {
          if (child.kind === "directory") {
            yield makeDirHandle(child.name, `${path}/${child.name}`);
          } else {
            yield fileHandlesMap.get(`${path}/${child.name}`) || {
              kind: "file",
              name: child.name,
              getFile: async () => ({
                name: child.name,
                text: async () => child.content || "",
                size: (child.content || "").length,
                lastModified: Date.now(),
              }),
            };
          }
        }
      },
      getFileHandle: async (childName) => {
        const fh = fileHandlesMap.get(`${path}/${childName}`);
        if (fh) return fh;
        throw new Error(`File not found: ${childName}`);
      },
      getDirectoryHandle: async (childName) => {
        const childNode = (node.children || []).find(c => c.name === childName && c.kind === "directory");
        if (childNode) return makeDirHandle(childName, `${path}/${childName}`);
        throw new Error(`Directory not found: ${childName}`);
      },
    };
  }

  return makeDirHandle(handleName, handleName);
}

const SAMPLE_FILES = {
  "package.json": JSON.stringify({ name: "e2e-test", version: "1.0.0", scripts: {} }, null, 2),
  "src/index.js": 'console.log("hello");',
  "src/utils.js": 'export function add(a, b) { return a + b; }',
  "src/App.jsx": 'export default function App() { return <div>App</div>; }',
  "README.md": "# E2E Test Project",
};

async function mockFileSystemAccess(page, files = SAMPLE_FILES) {
  await page.addInitScript((fileData) => {
    const tree = { kind: "directory", name: "test-project", children: [] };
    for (const [path, content] of Object.entries(fileData)) {
      const parts = path.split("/").filter(Boolean);
      let current = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        let child = current.children.find(c => c.name === parts[i] && c.kind === "directory");
        if (!child) {
          child = { kind: "directory", name: parts[i], children: [] };
          current.children.push(child);
        }
        current = child;
      }
      current.children.push({ kind: "file", name: parts[parts.length - 1], content });
    }

    const fileHandlesMap = new Map();
    const dirHandlesMap = new Map();

    function walkNode(node, path) {
      if (node.kind === "file") {
        fileHandlesMap.set(path, {
          kind: "file",
          name: node.name,
          getFile: async () => ({
            name: node.name,
            text: async () => node.content || "",
            size: (node.content || "").length,
            lastModified: Date.now(),
          }),
        });
        return;
      }
      dirHandlesMap.set(path, node);
      for (const child of (node.children || [])) {
        walkNode(child, `${path}/${child.name}`);
      }
    }

    walkNode(tree, "test-project");

    function makeDirHandle(name, path) {
      const node = dirHandlesMap.get(path) || tree;
      return {
        kind: "directory",
        name,
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        values: async function* () {
          for (const child of (node.children || [])) {
            if (child.kind === "directory") {
              yield makeDirHandle(child.name, `${path}/${child.name}`);
            } else {
              yield fileHandlesMap.get(`${path}/${child.name}`) || {
                kind: "file",
                name: child.name,
                getFile: async () => ({
                  name: child.name,
                  text: async () => child.content || "",
                  size: (child.content || "").length,
                  lastModified: Date.now(),
                }),
              };
            }
          }
        },
        getFileHandle: async (childName) => {
          const fh = fileHandlesMap.get(`${path}/${childName}`);
          if (fh) return fh;
          throw new Error(`File not found: ${childName}`);
        },
        getDirectoryHandle: async (childName) => {
          const childNode = (node.children || []).find(c => c.name === childName && c.kind === "directory");
          if (childNode) return makeDirHandle(childName, `${path}/${childName}`);
          throw new Error(`Directory not found: ${childName}`);
        },
      };
    }

    window.showDirectoryPicker = async () => makeDirHandle("test-project", "test-project");
    window.showOpenFilePicker = async () => [fileHandlesMap.get("test-project/package.json")];
    window.showSaveFilePicker = async () => fileHandlesMap.get("test-project/package.json");
  }, files);
}

async function mockAdSense(page) {
  await page.addInitScript(() => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push = () => {};
  });
}

async function waitForAppReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function navigateToProjects(page) {
  await page.goto(PROJECTS_URL, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
}

async function navigateToSettings(page) {
  await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
}

async function navigateToLanding(page) {
  await page.goto(LANDING_URL, { waitUntil: "domcontentloaded" });
  await waitForAppReady(page);
}

async function createProjectViaStorage(page, project) {
  const existing = await getProjects(page);
  existing.push(project);
  await injectProjects(page, existing);
}

async function dismissOnboarding(page) {
  const overlay = page.locator(".onboarding-overlay");
  if (await overlay.isVisible().catch(() => false)) {
    const skipBtn = page.locator(".onboarding-overlay button", { hasText: /skip|get started|continue/i }).first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  }
}

async function dismissConsent(page) {
  const consentBtn = page.locator("button", { hasText: /decline/i }).first();
  if (await consentBtn.isVisible().catch(() => false)) {
    await consentBtn.click();
  }
}

async function switchMode(page, mode) {
  await page.evaluate((m) => {
    const btns = document.querySelectorAll(".workspace-mode-bar button");
    for (const btn of btns) {
      if (btn.textContent.trim() === m) { btn.click(); break; }
    }
  }, mode);
  await page.waitForTimeout(500);
}

async function openAIPanel(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("panel")) { btn.click(); break; }
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

async function openTerminal(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("terminal")) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(500);
}

async function closeTerminal(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("terminal")) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(500);
}

async function toggleExplorer(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("explorer")) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(500);
}

async function togglePanels(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".ide-header-button");
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("panel")) { btn.click(); break; }
    }
  });
  await page.waitForTimeout(500);
}

async function createProjectInBrowser(page, project) {
  await page.waitForSelector("button.projects-new-button", { timeout: 10000 });
  await page.locator("button.projects-new-button").first().click();
  await page.fill('input[placeholder="My Awesome Project"]', project.name);
  await page.locator(".ProjectModal button", { hasText: "Browse" }).click({ force: true });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btn = document.querySelector('.ProjectModal button[type="submit"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
}

async function createAndOpenProject(page, project) {
  await createProjectInBrowser(page, project);
  if (await page.locator(".workspace-mode-bar").isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.waitForTimeout(1000);
    return;
  }
  const cardWithName = page.locator(".project-card").filter({ hasText: project.name });
  const openBtn = cardWithName.locator("button.projects-open-button");
  const anyOpenBtn = page.locator("button.projects-open-button").first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
  } else if (await anyOpenBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await anyOpenBtn.click();
  } else {
    await page.evaluate((name) => {
      try {
        const projects = JSON.parse(localStorage.getItem("modcodes-projects") || "[]");
        const proj = projects.find(p => p.name === name);
        if (proj) {
          localStorage.setItem("modcodes-workspace", JSON.stringify({ projectId: proj.id }));
        }
      } catch {}
    }, project.name);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(3000);
}

const test = base.extend({
  modcodesPage: async ({ page }, next) => {
    await mockAdSense(page);
    await mockFileSystemAccess(page);
    await next(page);
  },
});

export {
  MODCODES_APP_URL,
  PROJECTS_URL,
  SETTINGS_URL,
  LANDING_URL,
  uniqueProject,
  clearLocalStorage,
  injectOnboardingCompleted,
  injectConsentAccepted,
  injectConsentDeclined,
  injectConsentUnknown,
  injectProjects,
  injectUsageData,
  getProjects,
  getConsentState,
  getUsageData,
  mockFileSystemAccess,
  mockAdSense,
  waitForAppReady,
  navigateToProjects,
  navigateToSettings,
  navigateToLanding,
  createProjectViaStorage,
  createProjectInBrowser,
  createAndOpenProject,
  switchMode,
  openAIPanel,
  openTerminal,
  closeTerminal,
  toggleExplorer,
  togglePanels,
  dismissOnboarding,
  dismissConsent,
};

export { test, expect };
