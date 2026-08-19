export function nameFromPath(path) {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function parentPathOf(path) {
  const index = typeof path === "string" ? path.lastIndexOf("/") : -1;
  return index === -1 ? null : path.slice(0, index);
}

export function createEmptyTab(overrides = {}) {
  return {
    path: "",
    name: "",
    content: "",
    savedContent: "",
    dirty: false,
    readStatus: "idle",
    readError: "",
    saveStatus: "idle",
    saveError: "",
    fileStatus: "ok",
    contentToken: 0,
    ...overrides,
  };
}

export function isUnderPath(path, dirPath) {
  return path === dirPath || path.startsWith(dirPath + "/");
}

export function remapPath(path, oldPath, newPath) {
  if (path === oldPath) {
    return newPath;
  }
  if (path.startsWith(oldPath + "/")) {
    return newPath + path.slice(oldPath.length);
  }
  return path;
}

export function nextActivePath(tabs, removedSet, currentPath) {
  if (!currentPath || !removedSet.has(currentPath)) {
    return currentPath;
  }

  const index = tabs.findIndex((tab) => tab.path === currentPath);
  const remaining = tabs.filter((tab) => !removedSet.has(tab.path));
  const neighbor = remaining[Math.min(index, remaining.length - 1)];
  return neighbor ? neighbor.path : null;
}

export function computeAffectedPaths(tabs, mode, targetPath) {
  if (mode === "all") {
    return new Set(tabs.map((tab) => tab.path));
  }

  if (mode === "others") {
    const set = new Set(tabs.map((tab) => tab.path));
    set.delete(targetPath);
    return set;
  }

  if (mode === "right") {
    const index = tabs.findIndex((tab) => tab.path === targetPath);
    if (index === -1) {
      return new Set();
    }
    return new Set(tabs.slice(index + 1).map((tab) => tab.path));
  }

  return new Set();
}