"use client";

export const MODCODES_VERSION = 1;
export const SCHEMA_VERSION = 1;

export const PROJECT_PHASES = [
  "idea",
  "research",
  "prd",
  "planning",
  "development",
  "testing",
  "release",
  "maintenance",
];

export const PROJECT_SOURCES = ["idea", "codebase", "hybrid", "empty"];

export const CANONICAL_SECTIONS = [
  "Project",
  "Problem",
  "Users",
  "Research",
  "Existing Solutions",
  "PRD",
  "Architecture",
  "Decisions",
  "Roadmap",
  "Milestones",
  "Progress",
  "Open Questions",
  "Sources",
  "Agent History",
  "Project Context",
];

const SECTION_ALIASES = new Map(
  CANONICAL_SECTIONS.map((s) => [normalizeSectionKey(s), s])
);

function normalizeSectionKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase();
}

function isoNow() {
  return new Date().toISOString();
}

function isValidPhase(p) {
  return PROJECT_PHASES.includes(String(p || "").toLowerCase());
}

function isValidSource(s) {
  return PROJECT_SOURCES.includes(String(s || "").toLowerCase());
}

function fallbackPhase(p) {
  const v = String(p || "").toLowerCase();
  return isValidPhase(v) ? v : "idea";
}

function parseIsoOrNow(v) {
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return isoNow();
}

export function createEmptyModcodes({ name, phase = "idea", source = "idea", github = null } = {}) {
  const now = isoNow();
  const safeName = typeof name === "string" && name.trim().length > 0 ? name.trim() : "Untitled Project";
  return {
    modcodesVersion: MODCODES_VERSION,
    schemaVersion: SCHEMA_VERSION,
    project: {
      name: safeName,
      phase: fallbackPhase(phase),
      createdAt: now,
      updatedAt: now,
      source: isValidSource(source) ? String(source).toLowerCase() : "idea",
      github: typeof github === "string" && github.trim().length > 0 ? github.trim() : null,
    },
    sections: Object.fromEntries(CANONICAL_SECTIONS.map((s) => [s, ""])),
  };
}

function parseFrontmatterYaml(block) {
  // Minimal YAML subset: top-level scalar keys and `project:` nested map (2-space indent).
  const lines = String(block || "").split("\n");
  const out = {};
  let currentParent = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.startsWith("  ") || raw.startsWith("\t") ? 2 : 0;
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    // strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === "null" || value === "~" || value === "") value = null;
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (/^-?\d+$/.test(value)) value = Number(value);

    if (indent === 0) {
      if (value === null && (key === "project")) {
        out[key] = {};
        currentParent = key;
      } else {
        out[key] = value;
        currentParent = null;
      }
    } else if (currentParent && indent > 0) {
      if (!out[currentParent] || typeof out[currentParent] !== "object") out[currentParent] = {};
      out[currentParent][key] = value;
    }
  }
  return out;
}

function serializeFrontmatter(data) {
  const fm = data || {};
  const project = fm.project || {};
  const lines = ["---"];
  lines.push(`modcodesVersion: ${Number(fm.modcodesVersion) || MODCODES_VERSION}`);
  lines.push(`schemaVersion: ${Number(fm.schemaVersion) || SCHEMA_VERSION}`);
  lines.push("project:");
  lines.push(`  name: "${String(project.name || "Untitled Project").replace(/"/g, '\\"')}"`);
  lines.push(`  phase: ${fallbackPhase(project.phase)}`);
  lines.push(`  createdAt: ${parseIsoOrNow(project.createdAt)}`);
  lines.push(`  updatedAt: ${isoNow()}`);
  lines.push(`  source: ${isValidSource(project.source) ? String(project.source).toLowerCase() : "idea"}`);
  lines.push(`  github: ${project.github ? `"${String(project.github).replace(/"/g, '\\"')}"` : "null"}`);
  // preserve unknown top-level keys that are not project/modcodesVersion/schemaVersion
  for (const [k, v] of Object.entries(fm)) {
    if (k === "modcodesVersion" || k === "schemaVersion" || k === "project") continue;
    if (v == null) lines.push(`${k}: null`);
    else if (typeof v === "string") lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${String(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function parseBodySections(body) {
  const sections = {};
  // init all canonical to "" so missing sections are known empty
  for (const s of CANONICAL_SECTIONS) sections[s] = "";

  if (!body || !String(body).trim()) return sections;

  const text = String(body);
  // Split on /^# (.+)$/m  keeping headings
  const parts = text.split(/^# (.+)$/m);
  // parts[0] is preamble before first # (ignore), then [heading, content, heading, content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const rawHeading = String(parts[i] || "").trim();
    const content = String(parts[i + 1] || "").trim();
    const key = SECTION_ALIASES.get(normalizeSectionKey(rawHeading));
    if (key) {
      sections[key] = content;
    } else {
      // preserve unknown section under its raw heading (forward-compat)
      sections[rawHeading] = content;
    }
  }
  return sections;
}

function normalizeParsed(frontmatter, sections) {
  const fm = frontmatter || {};
  const project = fm.project && typeof fm.project === "object" ? fm.project : {};
  const now = isoNow();
  return {
    modcodesVersion: Number(fm.modcodesVersion) > 0 ? Number(fm.modcodesVersion) : MODCODES_VERSION,
    schemaVersion: Number(fm.schemaVersion) > 0 ? Number(fm.schemaVersion) : SCHEMA_VERSION,
    project: {
      name: typeof project.name === "string" && project.name.trim() ? project.name.trim() : "Untitled Project",
      phase: fallbackPhase(project.phase),
      createdAt: parseIsoOrNow(project.createdAt || now),
      updatedAt: parseIsoOrNow(project.updatedAt || now),
      source: isValidSource(project.source) ? String(project.source).toLowerCase() : "idea",
      github: typeof project.github === "string" && project.github.trim() ? project.github.trim() : null,
    },
    sections: sections || Object.fromEntries(CANONICAL_SECTIONS.map((s) => [s, ""])),
  };
}

export function parseModcodes(rawText) {
  try {
    const text = String(rawText || "");
    if (!text.trim()) {
      return { ok: true, data: createEmptyModcodes({ name: "Untitled Project" }), raw: text };
    }
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) {
      // No frontmatter — treat whole file as body with default frontmatter
      const sections = parseBodySections(text);
      const data = normalizeParsed({}, sections);
      return { ok: true, data, raw: text, warnings: ["missing-frontmatter"] };
    }
    const fmBlock = fmMatch[1] || "";
    const body = fmMatch[2] || "";
    const fm = parseFrontmatterYaml(fmBlock);
    const sections = parseBodySections(body);
    const data = normalizeParsed(fm, sections);
    return { ok: true, data, raw: text };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : "parse failed", raw: String(rawText || "") };
  }
}

export function serializeModcodes(data) {
  const normalized = normalizeParsed(
    { modcodesVersion: data?.modcodesVersion, schemaVersion: data?.schemaVersion, project: data?.project },
    data?.sections
  );
  const front = serializeFrontmatter(normalized);
  const bodyParts = [];
  for (const name of CANONICAL_SECTIONS) {
    const content = normalized.sections[name];
    // keep all canonical sections for stability even if empty (human can delete)
    bodyParts.push(`# ${name}`);
    bodyParts.push(content && String(content).trim() ? String(content).trim() : "");
    bodyParts.push("");
  }
  // append unknown sections last
  for (const [k, v] of Object.entries(normalized.sections)) {
    if (CANONICAL_SECTIONS.includes(k)) continue;
    bodyParts.push(`# ${k}`);
    bodyParts.push(String(v || "").trim());
    bodyParts.push("");
  }
  return `${front}\n\n${bodyParts.join("\n").trim()}\n`;
}

export function migrateModcodes(parsed) {
  if (!parsed || typeof parsed !== "object") return createEmptyModcodes({ name: "Untitled Project" });
  const data = parsed.data ? parsed.data : parsed;
  return normalizeParsed(
    { modcodesVersion: data.modcodesVersion, schemaVersion: SCHEMA_VERSION, project: data.project },
    data.sections
  );
}

export function getSection(data, name) {
  const key = SECTION_ALIASES.get(normalizeSectionKey(name)) || String(name || "").trim();
  return (data && data.sections && typeof data.sections[key] === "string" ? data.sections[key] : "") || "";
}

export function setSection(data, name, value) {
  const key = SECTION_ALIASES.get(normalizeSectionKey(name)) || String(name || "").trim();
  const next = {
    ...data,
    project: { ...data.project, updatedAt: isoNow() },
    sections: { ...data.sections, [key]: String(value || "") },
  };
  return next;
}
