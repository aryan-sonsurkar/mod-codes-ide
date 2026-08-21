import { createChangeset } from "./changeset";

function validatePath(path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError(`Invalid path: ${path}`);
  }
  if (path.includes("..") || path.startsWith("/")) {
    throw new TypeError(`Path must be project-relative: ${path}`);
  }
}

export function agentObservationsToChangeset({ title = "Agent changeset", observations = [], proposedEdits = [] } = {}) {
  if (!Array.isArray(proposedEdits) || proposedEdits.length === 0) {
    throw new TypeError("At least one proposed edit is required");
  }
  const seen = new Set();
  const operations = [];
  for (const edit of proposedEdits) {
    if (!edit || typeof edit.path !== "string") {
      throw new TypeError("Each edit requires a path");
    }
    validatePath(edit.path);
    if (seen.has(edit.path)) {
      throw new TypeError(`Duplicate operation for ${edit.path}`);
    }
    seen.add(edit.path);
    if (!edit.proposed || typeof edit.proposed !== "string") {
      throw new TypeError(`Missing proposed content for ${edit.path}`);
    }
    const operation = edit.operation || "modify";
    if (!["modify", "create", "delete", "rename"].includes(operation)) {
      throw new TypeError(`Unsupported operation: ${operation}`);
    }
    if (operation === "rename" && !edit.newPath) {
      throw new TypeError("Rename requires newPath");
    }
    operations.push({
      path: edit.path,
      operation,
      original: typeof edit.original === "string" ? edit.original : null,
      proposed: edit.proposed,
      reason: edit.reason || `From observations: ${observations.length} tool results`,
    });
  }
  // Deterministic ordering
  operations.sort((a, b) => a.path.localeCompare(b.path));
  return createChangeset({ title, operations });
}
