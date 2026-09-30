const STORAGE_PREFIX = "modcodes-virtual-fs:";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

let state = null;

function storageKey(rootName) {
  return `${STORAGE_PREFIX}${rootName}`;
}

function parentPathOf(path) {
  const index = typeof path === "string" ? path.lastIndexOf("/") : -1;
  return index === -1 ? null : path.slice(0, index);
}

function nameOf(path) {
  const index = typeof path === "string" ? path.lastIndexOf("/") : -1;
  return index === -1 ? path : path.slice(index + 1);
}

function isValidEntryName(name) {
  if (typeof name !== "string") {
    return false;
  }
  if (name.length === 0 || name === "." || name === "..") {
    return false;
  }
  return !name.includes("/") && !name.includes("\\");
}

function normalizePath(path) {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.some((part) => part === "..")) {
    return null;
  }
  return parts.join("/");
}

function starterFiles(rootName) {
  return [
    {
      path: `${rootName}/README.md`,
      content: `# ${rootName}\n\nThis project lives in your browser. Files are saved to this browser only and never uploaded.\n\n## Run it\n\nOpen \`src/index.js\` and press **Run**.\n`,
    },
    {
      path: `${rootName}/src/index.js`,
      content: `console.log("hello from MODCODES");\n`,
    },
    {
      path: `${rootName}/index.html`,
      content: `<!doctype html>\n<html lang="en">\n  <body>\n    <p>Edit this page and press Run to preview it.</p>\n  </body>\n</html>\n`,
    },
  ];
}

function newState(rootName) {
  const next = { rootName, dirs: new Set([rootName]), files: new Map() };
  for (const entry of starterFiles(rootName)) {
    next.files.set(entry.path, { content: entry.content, lastModified: Date.now() });
    let parent = parentPathOf(entry.path);
    while (parent) {
      next.dirs.add(parent);
      parent = parentPathOf(parent);
    }
  }
  return next;
}

function serialize(next) {
  const files = {};
  for (const [path, entry] of next.files.entries()) {
    files[path] = { content: entry.content, lastModified: entry.lastModified };
  }
  return { rootName: next.rootName, dirs: [...next.dirs], files };
}

function persist() {
  if (!state) {
    return;
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey(state.rootName), JSON.stringify(serialize(state)));
    }
  } catch (error) {
    // Quota or private mode: the workspace still works for this session.
  }
}

function load(rootName) {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    const raw = localStorage.getItem(storageKey(rootName));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.dirs) || typeof parsed.files !== "object") {
      return null;
    }
    const next = { rootName, dirs: new Set(parsed.dirs), files: new Map() };
    for (const [path, entry] of Object.entries(parsed.files || {})) {
      if (entry && typeof entry.content === "string") {
        next.files.set(path, {
          content: entry.content,
          lastModified: Number(entry.lastModified) || Date.now(),
        });
      }
    }
    if (!next.dirs.has(rootName)) {
      next.dirs.add(rootName);
    }
    return next;
  } catch (error) {
    return null;
  }
}

function compareEntries(a, b) {
  if (a.kind !== b.kind) {
    return a.kind === "directory" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function buildTree() {
  if (!state) {
    return null;
  }

  const rootPath = state.rootName;
  const nodes = new Map();

  for (const dirPath of state.dirs) {
    nodes.set(dirPath, {
      name: nameOf(dirPath),
      kind: "directory",
      path: dirPath,
      children: [],
    });
  }

  const root = nodes.get(rootPath);
  if (!root) {
    return null;
  }

  for (const [filePath] of state.files.entries()) {
    const parentPath = parentPathOf(filePath);
    const parent = parentPath ? nodes.get(parentPath) : null;
    if (!parent) {
      continue;
    }
    parent.children.push({ name: nameOf(filePath), kind: "file", path: filePath });
  }

  for (const [dirPath, node] of nodes.entries()) {
    if (dirPath === rootPath) {
      continue;
    }
    const parent = nodes.get(parentPathOf(dirPath));
    if (parent) {
      parent.children.push(node);
    }
  }

  for (const node of nodes.values()) {
    node.children.sort(compareEntries);
  }

  return root;
}

function ensureOpen() {
  return state ? { ok: true } : { ok: false, status: "missing" };
}

function isWholeWord(text, start, length) {
  const before = start === 0 ? "" : text[start - 1];
  const after = start + length >= text.length ? "" : text[start + length];
  const isWordChar = (char) => (char ? /[A-Za-z0-9_]/.test(char) : false);
  return !isWordChar(before) && !isWordChar(after);
}

function findMatches(text, query, options = {}) {
  const matchCase = Boolean(options.matchCase);
  const wholeWord = Boolean(options.wholeWord);
  const needle = matchCase ? query : query.toLowerCase();
  const lines = text.split("\n");
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const haystack = matchCase ? line : line.toLowerCase();
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      if (!wholeWord || isWholeWord(haystack, index, needle.length)) {
        matches.push({
          line: i + 1,
          column: index + 1,
          length: needle.length,
          text: line.trim(),
        });
      }
      index = haystack.indexOf(needle, index + needle.length);
    }
  }

  return matches;
}

function replaceOccurrence(text, match, replacement) {
  const lines = text.split("\n");
  const lineIndex = match.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return text;
  }
  const line = lines[lineIndex];
  const start = match.column - 1;
  if (start < 0 || start + match.length > line.length) {
    return text;
  }
  lines[lineIndex] =
    line.slice(0, start) + replacement + line.slice(start + match.length);
  return lines.join("\n");
}

export function isWorkspaceVirtual() {
  return Boolean(state);
}

export function getVirtualRootName() {
  return state ? state.rootName : null;
}

export function openVirtualWorkspace(projectName) {
  const rootName = typeof projectName === "string" ? projectName.trim() : "";
  if (!rootName) {
    return { ok: false, status: "invalid-name" };
  }

  if (state && state.rootName === rootName) {
    return { ok: true, tree: buildTree() };
  }

  state = load(rootName) || newState(rootName);
  persist();
  return { ok: true, tree: buildTree() };
}

export function closeVirtualWorkspace() {
  state = null;
}

export function virtualReadFile(path) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const normalized = normalizePath(path);
  if (!normalized) {
    return { ok: false, status: "invalid" };
  }

  const entry = state.files.get(normalized);
  if (!entry) {
    return { ok: false, status: "missing" };
  }
  if (entry.content.length > MAX_FILE_SIZE) {
    return { ok: false, status: "too-large" };
  }

  return {
    ok: true,
    content: entry.content,
    lastModified: entry.lastModified,
  };
}

export function virtualWriteFile(path, content) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const normalized = normalizePath(path);
  if (!normalized) {
    return { ok: false, status: "invalid" };
  }

  const text = typeof content === "string" ? content : String(content);
  if (text.length > MAX_FILE_SIZE) {
    return { ok: false, status: "too-large" };
  }

  const existing = state.files.get(normalized);
  if (!existing) {
    const parentPath = parentPathOf(normalized);
    if (!parentPath || !state.dirs.has(parentPath)) {
      return { ok: false, status: "missing" };
    }
  }

  const lastModified = Date.now();
  state.files.set(normalized, { content: text, lastModified });

  let parent = parentPathOf(normalized);
  while (parent) {
    state.dirs.add(parent);
    parent = parentPathOf(parent);
  }

  persist();
  return { ok: true, lastModified };
}

export function virtualCreateFile(parentPath, name) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const normalizedParent = normalizePath(parentPath);
  if (!normalizedParent || !state.dirs.has(normalizedParent)) {
    return { ok: false, status: "missing" };
  }

  const path = `${normalizedParent}/${trimmed}`;
  if (state.files.has(path)) {
    return { ok: false, status: "exists" };
  }

  const lastModified = Date.now();
  state.files.set(path, { content: "", lastModified });
  persist();
  return { ok: true, path };
}

export function virtualCreateDirectory(parentPath, name) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const normalizedParent = normalizePath(parentPath);
  if (!normalizedParent || !state.dirs.has(normalizedParent)) {
    return { ok: false, status: "missing" };
  }

  const path = `${normalizedParent}/${trimmed}`;
  if (state.dirs.has(path) || state.files.has(path)) {
    return { ok: false, status: "exists" };
  }

  state.dirs.add(path);
  persist();
  return { ok: true, path };
}

export function virtualRenameEntry(oldPath, newName) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof newName === "string" ? newName.trim() : "";
  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const normalized = normalizePath(oldPath);
  if (!normalized) {
    return { ok: false, status: "invalid" };
  }

  const parentPath = parentPathOf(normalized);
  if (!parentPath) {
    return { ok: false, status: "invalid" };
  }

  const newPath = `${parentPath}/${trimmed}`;
  if (newPath === normalized) {
    return { ok: true, path: newPath };
  }
  if (state.dirs.has(newPath) || state.files.has(newPath)) {
    return { ok: false, status: "exists" };
  }

  if (state.files.has(normalized)) {
    const entry = state.files.get(normalized);
    state.files.delete(normalized);
    state.files.set(newPath, { ...entry, lastModified: Date.now() });
    persist();
    return { ok: true, path: newPath };
  }

  if (state.dirs.has(normalized)) {
    const prefix = `${normalized}/`;
    const movedFiles = new Map();
    for (const [filePath, entry] of [...state.files.entries()]) {
      if (filePath === normalized || filePath.startsWith(prefix)) {
        const movedPath = newPath + filePath.slice(normalized.length);
        state.files.delete(filePath);
        movedFiles.set(movedPath, entry);
      }
    }
    for (const [movedPath, entry] of movedFiles.entries()) {
      state.files.set(movedPath, entry);
    }

    const movedDirs = [];
    for (const dirPath of [...state.dirs]) {
      if (dirPath === normalized || dirPath.startsWith(prefix)) {
        movedDirs.push(dirPath);
      }
    }
    for (const dirPath of movedDirs) {
      state.dirs.delete(dirPath);
      state.dirs.add(newPath + dirPath.slice(normalized.length));
    }

    state.dirs.add(newPath);
    persist();
    return { ok: true, path: newPath };
  }

  return { ok: false, status: "missing" };
}

export function virtualDeleteEntry(path) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const normalized = normalizePath(path);
  if (!normalized) {
    return { ok: false, status: "invalid" };
  }
  if (normalized === state.rootName) {
    return { ok: false, status: "invalid" };
  }

  if (state.files.has(normalized)) {
    state.files.delete(normalized);
    persist();
    return { ok: true };
  }

  if (state.dirs.has(normalized)) {
    const prefix = `${normalized}/`;
    for (const filePath of [...state.files.keys()]) {
      if (filePath.startsWith(prefix)) {
        state.files.delete(filePath);
      }
    }
    for (const dirPath of [...state.dirs]) {
      if (dirPath === normalized || dirPath.startsWith(prefix)) {
        state.dirs.delete(dirPath);
      }
    }
    persist();
    return { ok: true };
  }

  return { ok: false, status: "missing" };
}

export function virtualRescanProjectTree() {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }
  return { ok: true, tree: buildTree() };
}

export function virtualGetRootHandle() {
  return null;
}

export function virtualSearchWorkspace(query, options = {}) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    return { ok: true, matches: [] };
  }

  const matches = [];
  const limit = 500;
  for (const [path, entry] of state.files.entries()) {
    if (matches.length >= limit) {
      break;
    }
    const found = findMatches(entry.content, trimmed, options);
    for (const match of found) {
      if (matches.length >= limit) {
        break;
      }
      matches.push({
        path,
        name: nameOf(path),
        line: match.line,
        column: match.column,
        length: match.length,
        text: match.text,
      });
    }
  }

  return { ok: true, matches };
}

export function virtualPreviewWorkspaceReplace(query, options = {}) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    return { ok: true, files: [], totalMatches: 0, totalFiles: 0 };
  }

  const files = [];
  let totalMatches = 0;

  for (const [path, entry] of state.files.entries()) {
    const found = findMatches(entry.content, trimmed, options);
    if (found.length > 0) {
      totalMatches += found.length;
      files.push({
        path,
        name: nameOf(path),
        matchCount: found.length,
      });
    }
  }

  return {
    ok: true,
    files,
    totalMatches,
    totalFiles: files.length,
  };
}

export function virtualApplyReplaceAll(query, options, replacement) {
  const open = ensureOpen();
  if (!open.ok) {
    return open;
  }

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    return { ok: true, files: [], totalMatches: 0, totalFiles: 0 };
  }

  const files = [];
  let totalMatches = 0;

  for (const [path, entry] of state.files.entries()) {
    const found = findMatches(entry.content, trimmed, options);
    if (found.length === 0) {
      continue;
    }
    let next = entry.content;
    for (let i = found.length - 1; i >= 0; i--) {
      next = replaceOccurrence(next, found[i], replacement);
    }
    state.files.set(path, { content: next, lastModified: Date.now() });
    totalMatches += found.length;
    files.push({ path, name: nameOf(path), matchCount: found.length });
  }

  persist();
  return { ok: true, files, totalMatches, totalFiles: files.length };
}
