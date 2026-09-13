import { createChangeset } from "./changeset";

function validatePath(path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError(`Invalid path: ${path}`);
  }
  if (path.includes("..") || path.startsWith("/")) {
    throw new TypeError(`Path must be project-relative: ${path}`);
  }
}

function extractFileContentFromResult(result) {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    if (typeof result.content === "string") return result.content;
    if (typeof result.text === "string") return result.text;
    if (typeof result.data === "string") return result.data;
  }
  return null;
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
  operations.sort((a, b) => a.path.localeCompare(b.path));
  return createChangeset({ title, operations });
}

export function observationsToChangeset({ title = "Agent changeset", observations = [] } = {}) {
  const readContent = new Map();
  const writeContent = new Map();
  const fileOperations = new Map();

  for (const obs of observations) {
    if (obs.status !== "success") continue;

    const path = obs.arguments && obs.arguments.path;
    if (!path) continue;

    if (obs.tool === "ide.read-file" || obs.tool === "ide.current-file") {
      const content = extractFileContentFromResult(obs.result);
      if (content !== null) {
        readContent.set(path, content);
      }
    }

    if (obs.tool === "ide.write-file" || obs.tool === "ide.create-file") {
      const argContent = obs.arguments && (obs.arguments.content || obs.arguments.data);
      const resultContent = extractFileContentFromResult(obs.result);
      const content = typeof argContent === "string" ? argContent : resultContent;

      if (typeof content === "string" && content.length > 0) {
        writeContent.set(path, content);
        if (!fileOperations.has(path)) {
          fileOperations.set(path, readContent.has(path) ? "modify" : "create");
        }
      }
    }

    if (obs.tool === "ide.apply-patch") {
      const patch = obs.arguments && (obs.arguments.patch || obs.arguments.diff);
      if (typeof patch === "string" && readContent.has(path)) {
        fileOperations.set(path, "modify");
        writeContent.set(path, patch);
      }
    }
  }

  const operations = [];
  for (const [path, operation] of fileOperations) {
    const original = readContent.get(path) || null;
    const proposed = writeContent.get(path) || null;

    if (proposed === null) continue;

    operations.push({
      path,
      operation,
      original,
      proposed,
      reason: `From agent observations: ${observations.filter((o) => o.arguments && o.arguments.path === path).map((o) => o.tool).join(", ")}`,
    });
  }

  for (const [path, content] of writeContent) {
    if (!fileOperations.has(path)) {
      const operation = readContent.has(path) ? "modify" : "create";
      operations.push({
        path,
        operation,
        original: readContent.get(path) || null,
        proposed: content,
        reason: `From agent write operation`,
      });
    }
  }

  operations.sort((a, b) => a.path.localeCompare(b.path));

  if (operations.length === 0) {
    return null;
  }

  return createChangeset({ title, operations });
}
