const DEFAULT_MAX_DEPTH = 8;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SEARCH_MAX_RESULTS = 500;

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
]);

const fileHandles = new Map();
const directoryHandles = new Map();
let rootPath = null;

function isDirectoryAccessSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function compareNodes(a, b) {
  if (a.kind === b.kind) {
    return a.name.localeCompare(b.name);
  }
  return a.kind === "directory" ? -1 : 1;
}

function sortEntries(entries) {
  entries.sort(compareNodes);
}

async function ensurePermission(handle, mode) {
  try {
    const result = await handle.queryPermission({ mode });
    if (result === "granted") {
      return true;
    }
    const requested = await handle.requestPermission({ mode });
    return requested === "granted";
  } catch (error) {
    return false;
  }
}

async function readDirectoryNode(handle, path, depth) {
  const node = { name: handle.name, kind: "directory", path, children: [] };

  if (depth >= DEFAULT_MAX_DEPTH) {
    return node;
  }

  try {
    for await (const child of handle.values()) {
      if (child.kind === "directory" && SKIPPED_DIRECTORIES.has(child.name)) {
        continue;
      }

      const childPath = `${path}/${child.name}`;

      if (child.kind === "directory") {
        directoryHandles.set(childPath, child);
        node.children.push(await readDirectoryNode(child, childPath, depth + 1));
      } else if (child.kind === "file") {
        fileHandles.set(childPath, child);
        node.children.push({ name: child.name, kind: "file", path: childPath });
      }
    }
  } catch (error) {
    node.children = [];
  }

  sortEntries(node.children);
  return node;
}

async function requestDirectoryHandle() {
  if (!isDirectoryAccessSupported()) {
    return { ok: false, status: "unsupported" };
  }

  try {
    const handle = await window.showDirectoryPicker();
    return { ok: true, handle };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return { ok: false, status: "cancelled" };
    }
    return { ok: false, status: "error", error };
  }
}

function looksBinary(text) {
  const sample = text.length > 8192 ? text.slice(0, 8192) : text;

  for (let i = 0; i < sample.length; i++) {
    if (sample.charCodeAt(i) === 0) {
      return true;
    }
  }

  return sample.includes("\uFFFD");
}

export async function openProjectDirectory() {
  const result = await requestDirectoryHandle();

  if (!result.ok) {
    return result;
  }

  const { handle } = result;

  const hasPermission = await ensurePermission(handle, "read");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  fileHandles.clear();
  directoryHandles.clear();

  rootPath = handle.name;
  directoryHandles.set(rootPath, handle);

  const tree = await readDirectoryNode(handle, handle.name, 1);
  return { ok: true, tree };
}

export async function readFile(filePath) {
  const handle = fileHandles.get(filePath);

  if (!handle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(handle, "read");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  let file;
  try {
    file = await handle.getFile();
  } catch (error) {
    if (error && error.name === "NotFoundError") {
      return { ok: false, status: "missing" };
    }
    return { ok: false, status: "error", error };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, status: "too-large" };
  }

  if (file.size === 0) {
    return { ok: true, content: "", lastModified: file.lastModified };
  }

  const text = await file.text();

  if (looksBinary(text)) {
    return { ok: false, status: "binary" };
  }

  return { ok: true, content: text, lastModified: file.lastModified };
}

export async function writeFile(filePath, content) {
  const handle = fileHandles.get(filePath);

  if (!handle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(handle, "readwrite");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  let writable;
  try {
    writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    if (writable) {
      try {
        await writable.close();
      } catch (closeError) {
        // ignore close errors on failure
      }
    }
    if (error && error.name === "NotFoundError") {
      return { ok: false, status: "missing" };
    }
    return { ok: false, status: "error", error };
  }

  try {
    const file = await handle.getFile();
    return { ok: true, lastModified: file.lastModified };
  } catch (error) {
    return { ok: true };
  }
}

export { isDirectoryAccessSupported };

export function getRootHandle() {
  if (!rootPath) {
    return null;
  }
  return directoryHandles.get(rootPath) || null;
}

function parentPathOf(path) {
  const index = typeof path === "string" ? path.lastIndexOf("/") : -1;
  return index === -1 ? null : path.slice(0, index);
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

async function entryExists(handle, name) {
  for await (const child of handle.values()) {
    if (child.name === name) {
      return true;
    }
  }
  return false;
}

async function moveDirectoryContents(fromHandle, toHandle) {
  for await (const child of fromHandle.values()) {
    if (child.kind === "file") {
      const newFile = await toHandle.getFileHandle(child.name, { create: true });
      const writable = await newFile.createWritable();
      try {
        const file = await child.getFile();
        await writable.write(file);
      } finally {
        await writable.close();
      }
      await child.remove();
    } else {
      const newSub = await toHandle.getDirectoryHandle(child.name, {
        create: true,
      });
      await moveDirectoryContents(child, newSub);
      await child.remove();
    }
  }
}

function remapPathsAfterRename(oldPath, newPath) {
  const prefix = oldPath + "/";

  for (const [key, handle] of [...directoryHandles.entries()]) {
    if (key === oldPath) {
      directoryHandles.set(newPath, handle);
      directoryHandles.delete(oldPath);
    } else if (key.startsWith(prefix)) {
      directoryHandles.set(newPath + key.slice(oldPath.length), handle);
      directoryHandles.delete(key);
    }
  }

  for (const [key, handle] of [...fileHandles.entries()]) {
    if (key.startsWith(prefix)) {
      fileHandles.set(newPath + key.slice(oldPath.length), handle);
      fileHandles.delete(key);
    }
  }
}

function removePathsWithPrefix(path) {
  const prefix = path + "/";

  for (const key of [...directoryHandles.keys()]) {
    if (key === path || key.startsWith(prefix)) {
      directoryHandles.delete(key);
    }
  }

  for (const key of [...fileHandles.keys()]) {
    if (key.startsWith(prefix)) {
      fileHandles.delete(key);
    }
  }
}

export async function createFile(parentPath, name) {
  const trimmed = typeof name === "string" ? name.trim() : "";

  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const parent = directoryHandles.get(parentPath);
  if (!parent) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(parent, "readwrite");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  if (await entryExists(parent, trimmed)) {
    return { ok: false, status: "exists" };
  }

  try {
    const handle = await parent.getFileHandle(trimmed, { create: true });
    const path = `${parentPath}/${trimmed}`;
    fileHandles.set(path, handle);
    return { ok: true, path };
  } catch (error) {
    return { ok: false, status: "error", error };
  }
}

export async function createDirectory(parentPath, name) {
  const trimmed = typeof name === "string" ? name.trim() : "";

  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const parent = directoryHandles.get(parentPath);
  if (!parent) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(parent, "readwrite");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  if (await entryExists(parent, trimmed)) {
    return { ok: false, status: "exists" };
  }

  try {
    const handle = await parent.getDirectoryHandle(trimmed, { create: true });
    const path = `${parentPath}/${trimmed}`;
    directoryHandles.set(path, handle);
    return { ok: true, path };
  } catch (error) {
    return { ok: false, status: "error", error };
  }
}

export async function renameEntry(oldPath, newName) {
  const trimmed = typeof newName === "string" ? newName.trim() : "";

  if (!isValidEntryName(trimmed)) {
    return { ok: false, status: "invalid-name" };
  }

  const parentPath = parentPathOf(oldPath);
  if (!parentPath) {
    return { ok: false, status: "invalid" };
  }

  const parent = directoryHandles.get(parentPath);
  if (!parent) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(parent, "readwrite");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  if (await entryExists(parent, trimmed)) {
    return { ok: false, status: "exists" };
  }

  const newPath = `${parentPath}/${trimmed}`;

  if (oldPath === newPath) {
    return { ok: true, path: newPath };
  }

  const dirHandle = directoryHandles.get(oldPath);

  if (dirHandle) {
    let newHandle;
    try {
      newHandle = await parent.getDirectoryHandle(trimmed, { create: true });
      await moveDirectoryContents(dirHandle, newHandle);
      await dirHandle.remove();
    } catch (error) {
      if (newHandle) {
        try {
          await newHandle.remove({ recursive: true });
        } catch (cleanupError) {
          // ignore cleanup errors
        }
      }
      return { ok: false, status: "error", error };
    }

    remapPathsAfterRename(oldPath, newPath);
    return { ok: true, path: newPath };
  }

  const fileHandle = fileHandles.get(oldPath);

  if (!fileHandle) {
    return { ok: false, status: "missing" };
  }

  let newHandle;
  try {
    newHandle = await parent.getFileHandle(trimmed, { create: true });
    const file = await fileHandle.getFile();
    const writable = await newHandle.createWritable();
    await writable.write(file);
    await writable.close();
    await fileHandle.remove();
  } catch (error) {
    if (newHandle) {
      try {
        await newHandle.remove();
      } catch (cleanupError) {
        // ignore cleanup errors
      }
    }
    return { ok: false, status: "error", error };
  }

  fileHandles.delete(oldPath);
  fileHandles.set(newPath, newHandle);
  return { ok: true, path: newPath };
}

export async function deleteEntry(path) {
  const dirHandle = directoryHandles.get(path);

  if (dirHandle) {
    const hasPermission = await ensurePermission(dirHandle, "readwrite");
    if (!hasPermission) {
      return { ok: false, status: "denied" };
    }

    try {
      await dirHandle.remove({ recursive: true });
    } catch (error) {
      if (error && error.name === "NotFoundError") {
        return { ok: false, status: "missing" };
      }
      return { ok: false, status: "error", error };
    }

    removePathsWithPrefix(path);
    return { ok: true };
  }

  const fileHandle = fileHandles.get(path);

  if (!fileHandle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(fileHandle, "readwrite");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  try {
    await fileHandle.remove();
  } catch (error) {
    if (error && error.name === "NotFoundError") {
      return { ok: false, status: "missing" };
    }
    return { ok: false, status: "error", error };
  }

  fileHandles.delete(path);
  return { ok: true };
}

export async function rescanProjectTree() {
  if (!rootPath) {
    return { ok: false, status: "missing" };
  }

  const rootHandle = directoryHandles.get(rootPath);
  if (!rootHandle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(rootHandle, "read");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  fileHandles.clear();
  directoryHandles.clear();
  directoryHandles.set(rootPath, rootHandle);

  const tree = await readDirectoryNode(rootHandle, rootPath, 1);
  return { ok: true, tree };
}

function searchNameFromPath(path) {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

function isWordChar(char) {
  return char ? /[A-Za-z0-9_]/.test(char) : false;
}

function isWholeWord(text, start, length) {
  const before = start > 0 ? text[start - 1] : "";
  const after = start + length < text.length ? text[start + length] : "";
  return !isWordChar(before) && !isWordChar(after);
}

function findMatchesInText(text, query, opts) {
  const options = opts || {};
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
  const lineIndex = match.line - 1;
  const lines = text.split("\n");

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

function replaceAllInText(text, query, replacement, opts) {
  const matches = findMatchesInText(text, query, opts);

  if (matches.length === 0) {
    return { text, count: 0 };
  }

  let next = text;

  for (let i = matches.length - 1; i >= 0; i--) {
    next = replaceOccurrence(next, matches[i], replacement);
  }

  return { text: next, count: matches.length };
}

function searchText(text, path, query, opts, matches) {
  const found = findMatchesInText(text, query, opts);

  for (const match of found) {
    if (matches.length >= SEARCH_MAX_RESULTS) {
      return;
    }
    matches.push({
      path,
      name: searchNameFromPath(path),
      line: match.line,
      column: match.column,
      length: match.length,
      text: match.text,
    });
  }
}

async function searchDirectory(handle, path, query, opts, matches) {
  for await (const child of handle.values()) {
    if (matches.length >= SEARCH_MAX_RESULTS) {
      return;
    }

    if (child.kind === "directory") {
      if (SKIPPED_DIRECTORIES.has(child.name)) {
        continue;
      }
      await searchDirectory(child, `${path}/${child.name}`, query, opts, matches);
      continue;
    }

    if (child.kind !== "file") {
      continue;
    }

    const filePath = `${path}/${child.name}`;

    try {
      const file = await child.getFile();
      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        continue;
      }
      const text = await file.text();
      if (looksBinary(text)) {
        continue;
      }
      searchText(text, filePath, query, opts, matches);
    } catch (error) {
      // skip unreadable files
    }
  }
}

export async function searchWorkspace(query, opts) {
  const trimmed = typeof query === "string" ? query.trim() : "";

  if (!trimmed) {
    return { ok: true, matches: [] };
  }

  if (!rootPath) {
    return { ok: false, status: "missing" };
  }

  const rootHandle = directoryHandles.get(rootPath);
  if (!rootHandle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(rootHandle, "read");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  const matches = [];
  await searchDirectory(rootHandle, rootPath, trimmed, opts, matches);
  return { ok: true, matches };
}

async function scanReplaceDirectory(handle, path, query, opts, files) {
  for await (const child of handle.values()) {
    if (child.kind === "directory") {
      if (SKIPPED_DIRECTORIES.has(child.name)) {
        continue;
      }
      await scanReplaceDirectory(
        child,
        `${path}/${child.name}`,
        query,
        opts,
        files
      );
      continue;
    }

    if (child.kind !== "file") {
      continue;
    }

    const filePath = `${path}/${child.name}`;

    try {
      const file = await child.getFile();
      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        continue;
      }
      const text = await file.text();
      if (looksBinary(text)) {
        continue;
      }
      const matches = findMatchesInText(text, query, opts);
      if (matches.length > 0) {
        files.push({
          path: filePath,
          name: searchNameFromPath(filePath),
          matchCount: matches.length,
        });
      }
    } catch (error) {
      // skip unreadable files
    }
  }
}

export async function previewWorkspaceReplace(query, opts) {
  const trimmed = typeof query === "string" ? query.trim() : "";

  if (!trimmed) {
    return { ok: true, files: [], totalMatches: 0, totalFiles: 0 };
  }

  if (!rootPath) {
    return { ok: false, status: "missing" };
  }

  const rootHandle = directoryHandles.get(rootPath);
  if (!rootHandle) {
    return { ok: false, status: "missing" };
  }

  const hasPermission = await ensurePermission(rootHandle, "read");
  if (!hasPermission) {
    return { ok: false, status: "denied" };
  }

  const files = [];
  await scanReplaceDirectory(rootHandle, rootPath, trimmed, opts, files);

  const totalMatches = files.reduce(
    (sum, file) => sum + file.matchCount,
    0
  );

  return { ok: true, files, totalMatches, totalFiles: files.length };
}
export { replaceAllInText, replaceOccurrence };
