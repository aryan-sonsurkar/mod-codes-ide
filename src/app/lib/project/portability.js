import { parseModcodes, serializeModcodes } from "./modcodes";
import { saveModcodes } from "./service";

export const MODCODES_EXPORT_EXTENSION = ".modcodes";

function safeFileName(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "project";
}

export function buildModcodesExport({ data, projectName } = {}) {
  if (!data || typeof data !== "object") {
    return { ok: false, status: "missing-data" };
  }

  return {
    ok: true,
    filename: `${safeFileName(projectName || data?.project?.name)}${MODCODES_EXPORT_EXTENSION}`,
    content: serializeModcodes(data),
  };
}

export function downloadModcodesExport({ data, projectName } = {}) {
  const built = buildModcodesExport({ data, projectName });
  if (!built.ok) {
    return built;
  }

  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return { ok: false, status: "unsupported", filename: built.filename, content: built.content };
  }

  const blob = new Blob([built.content], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = built.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { ok: true, filename: built.filename };
}

export function importModcodesText(rawText) {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    return { ok: false, status: "empty" };
  }

  const parsed = parseModcodes(rawText);
  if (!parsed.ok) {
    return { ok: false, status: "parse-error", error: parsed.error, raw: rawText };
  }

  const sections = parsed.data?.sections || {};
  const hasSections = Object.values(sections).some((value) =>
    String(value || "").trim().length > 0
  );
  const hasFrontmatter = rawText.trimStart().startsWith("---");

  if (!hasSections && !hasFrontmatter) {
    return { ok: false, status: "not-modcodes", raw: rawText };
  }

  return { ok: true, data: parsed.data, raw: rawText };
}

export async function importModcodesFile(file) {
  if (!file) {
    return { ok: false, status: "missing-file" };
  }

  let text;
  try {
    text = await file.text();
  } catch (error) {
    return {
      ok: false,
      status: "read-error",
      error: error && error.message ? error.message : "read failed",
    };
  }

  return importModcodesText(text);
}

export async function applyImportedModcodes({ rootName, data }) {
  if (!rootName) {
    return { ok: false, status: "missing-root" };
  }
  if (!data) {
    return { ok: false, status: "missing-data" };
  }

  const saved = await saveModcodes({ rootName, data });
  if (!saved.ok) {
    return saved;
  }

  return { ok: true, data, path: saved.path };
}
