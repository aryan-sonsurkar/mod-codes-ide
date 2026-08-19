export const WORKSPACE_VERSION = 2;

const MAX_RESTORED_TABS = 50;

export function normalizeWorkspace(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const projectId =
    typeof raw.projectId === "string" ? raw.projectId : null;
  if (!projectId) {
    return null;
  }

  const entries = Array.isArray(raw.openTabs) ? raw.openTabs : [];

  const seen = new Set();
  const openTabs = [];

  for (const entry of entries.slice(0, MAX_RESTORED_TABS)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const path = typeof entry.path === "string" ? entry.path : null;
    const name = typeof entry.name === "string" ? entry.name : null;
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    openTabs.push({ path, name });
  }

  const activePath =
    typeof raw.activePath === "string" &&
    seen.has(raw.activePath)
      ? raw.activePath
      : openTabs.length > 0
        ? openTabs[0].path
        : null;

  return {
    version: WORKSPACE_VERSION,
    projectId,
    openTabs,
    activePath,
    savedAt:
      typeof raw.savedAt === "number" ? raw.savedAt : Date.now(),
  };
}

export function filterPathsToTree(paths, availablePaths) {
  if (!availablePaths) {
    return paths;
  }

  const available = availablePaths instanceof Set ? availablePaths : new Set(availablePaths);
  return paths.filter((path) => available.has(path));
}

export function buildRecoveryPlan(workspace, availablePaths) {
  if (!workspace) {
    return { shouldRestore: false, openPaths: [], activePath: null };
  }

  const openPaths = filterPathsToTree(
    workspace.openTabs.map((entry) => entry.path),
    availablePaths
  );

  if (openPaths.length === 0) {
    return { shouldRestore: false, openPaths: [], activePath: null };
  }

  const activePath =
    workspace.activePath && openPaths.includes(workspace.activePath)
      ? workspace.activePath
      : openPaths[0];

  return { shouldRestore: true, openPaths, activePath };
}