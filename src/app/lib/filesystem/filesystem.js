const DEFAULT_MAX_DEPTH = 8;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
]);

const fileHandles = new Map();

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
    return { ok: true, content: "" };
  }

  const text = await file.text();

  if (looksBinary(text)) {
    return { ok: false, status: "binary" };
  }

  return { ok: true, content: text };
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

  return { ok: true };
}

export { isDirectoryAccessSupported };