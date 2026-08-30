"use client";
import { readFile, writeFile, createFile } from "../filesystem/filesystem";
import { parseModcodes, serializeModcodes, createEmptyModcodes } from "./modcodes";

function modcodesPathFor(rootName) {
  return `${rootName}/.modcodes`;
}

export async function loadModcodes({ rootName }) {
  if (!rootName || typeof rootName !== "string") {
    return { ok: false, status: "missing-root" };
  }
  const path = modcodesPathFor(rootName);
  const result = await readFile(path);
  if (!result.ok) {
    if (result.status === "missing") {
      return { ok: true, absent: true, data: null, path };
    }
    return { ok: false, status: result.status, error: result.error, path };
  }
  const parsed = parseModcodes(result.content);
  if (!parsed.ok) {
    return { ok: false, status: "parse-error", error: parsed.error, path, raw: result.content };
  }
  return { ok: true, absent: false, data: parsed.data, path, lastModified: result.lastModified };
}

export async function saveModcodes({ rootName, data }) {
  if (!rootName) return { ok: false, status: "missing-root" };
  const path = modcodesPathFor(rootName);
  const raw = serializeModcodes(data);
  // Try writeFile first; if missing, createFile then write
  let result = await writeFile(path, raw);
  if (!result.ok && result.status === "missing") {
    const parentPath = rootName;
    const created = await createFile(parentPath, ".modcodes");
    if (!created.ok) return { ok: false, status: created.status, error: created.error };
    result = await writeFile(path, raw);
  }
  if (!result.ok) return { ok: false, status: result.status, error: result.error };
  return { ok: true, path };
}

export async function ensureModcodes({ rootName, projectName, phase, source, github }) {
  const loaded = await loadModcodes({ rootName });
  if (loaded.ok && !loaded.absent && loaded.data) {
    return loaded;
  }
  if (loaded.ok && loaded.absent) {
    const data = createEmptyModcodes({ name: projectName || rootName, phase, source, github });
    const saved = await saveModcodes({ rootName, data });
    if (!saved.ok) return { ok: false, status: saved.status, error: saved.error };
    return { ok: true, absent: false, data, path: modcodesPathFor(rootName), created: true };
  }
  return loaded;
}
