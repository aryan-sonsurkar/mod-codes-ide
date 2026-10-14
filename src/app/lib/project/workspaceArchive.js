import { createZip, parseZip, zipEntryToText } from "./zip";

export const WORKSPACE_ZIP_EXTENSION = ".zip";
const MAX_ZIP_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_FILES = 500;

function safeSlug(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "workspace";
}

export function isSafeArchivePath(path) {
  if (typeof path !== "string") return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  const normalized = path.replace(/\\/g, "/");
  if (!normalized || normalized === "." || normalized === "..") return false;
  if (normalized.split("/").includes("..")) return false;
  return true;
}

export function buildWorkspaceArchive({ files, projectName } = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, status: "empty" };
  }

  const safeFiles = files.filter((file) => {
    if (!file || typeof file.path !== "string") return false;
    if (!isSafeArchivePath(file.path)) return false;
    if (typeof file.content !== "string") return false;
    if (file.content.length > MAX_ZIP_FILE_BYTES) return false;
    return true;
  });

  if (safeFiles.length === 0) {
    return { ok: false, status: "empty" };
  }

  const zip = createZip(
    safeFiles.map((file) => ({
      name: file.path.replace(/\\/g, "/").replace(/^\/+/, ""),
      content: file.content,
    }))
  );
  if (!zip.ok) {
    return { ok: false, status: "zip-error" };
  }

  return {
    ok: true,
    filename: `${safeSlug(projectName)}-workspace${WORKSPACE_ZIP_EXTENSION}`,
    bytes: zip.bytes,
    fileCount: safeFiles.length,
    skipped: files.length - safeFiles.length,
  };
}

export async function parseWorkspaceArchive(buffer) {
  const parsed = await parseZip(buffer);
  if (!parsed.ok) {
    return parsed;
  }

  const files = [];
  let skipped = 0;
  for (const entry of parsed.entries) {
    if (!isSafeArchivePath(entry.name)) {
      skipped += 1;
      continue;
    }
    if (entry.content.length > MAX_ZIP_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    if (files.length >= MAX_ZIP_FILES) {
      skipped += 1;
      continue;
    }
    files.push({
      path: entry.name.replace(/\\/g, "/").replace(/^\/+/, ""),
      content: zipEntryToText(entry),
    });
  }

  if (files.length === 0) {
    return { ok: false, status: "no-safe-files", skipped };
  }

  return { ok: true, files, skipped };
}

export function downloadWorkspaceArchive({ files, projectName } = {}) {
  const built = buildWorkspaceArchive({ files, projectName });
  if (!built.ok) {
    return built;
  }

  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return { ok: false, status: "unsupported", filename: built.filename };
  }

  const blob = new Blob([built.bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = built.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { ok: true, filename: built.filename, fileCount: built.fileCount, skipped: built.skipped };
}

export async function parseWorkspaceArchiveFile(file) {
  if (!file) {
    return { ok: false, status: "missing-file" };
  }
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    return {
      ok: false,
      status: "read-error",
      error: error && error.message ? error.message : "read failed",
    };
  }
  return parseWorkspaceArchive(buffer);
}
