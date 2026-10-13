"use client";

export const PROTECTED_REASONS = {
  env: "Environment files hold secrets. A bad write can leak keys or break config.",
  manifest: "Package manifests and lockfiles define the project. A bad write breaks installs and builds.",
  database: "Database files hold durable data. A bad write can corrupt or destroy it.",
  migration: "Migrations change persistent schema. A bad write can break every environment.",
  memory: ".modcodes is the project's memory. A bad write loses decisions and context.",
  git: "Git internals control version history. A bad write can lose the repository state.",
};

const ENV_BASENAME = /^\.env($|\..+$)/i;
const MANIFEST_BASENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "composer.json",
  "composer.lock",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
]);
const DATABASE_BASENAME = /\.(db|sqlite|sqlite3|mdb)$/i;
const MIGRATION_DIR = /(^|\/)(migrations|prisma\/migrations)(\/|$)/i;
const GIT_DIR = /(^|\/)\.git(\/|$)/;

export function classifyProtectedPath(path) {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }
  const normalized = path.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() || "";
  if (ENV_BASENAME.test(basename)) return "env";
  if (basename.toLowerCase() === ".modcodes") return "memory";
  if (MANIFEST_BASENAMES.has(basename.toLowerCase())) return "manifest";
  if (DATABASE_BASENAME.test(basename)) return "database";
  if (MIGRATION_DIR.test(normalized)) return "migration";
  if (GIT_DIR.test(normalized)) return "git";
  return null;
}

export function isProtectedPath(path) {
  return classifyProtectedPath(path) !== null;
}

export function describeProtectedPath(path) {
  const reason = classifyProtectedPath(path);
  return reason ? PROTECTED_REASONS[reason] : null;
}

export function basenameOf(path) {
  if (typeof path !== "string" || path.length === 0) return "";
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || "";
}
