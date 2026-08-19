export const SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  HINT: "hint",
};

export const SEVERITY_ORDER = ["error", "warning", "info", "hint"];

export function createDiagnostic({
  path,
  severity,
  message,
  line = 1,
  column = 1,
  endLine,
  endColumn,
  source = "modcodes.light",
}) {
  return {
    path,
    severity,
    message,
    line,
    column,
    endLine: endLine ?? line,
    endColumn: endColumn ?? column + Math.max(1, message.length),
    source,
  };
}

export function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (sevDiff !== 0) {
      return sevDiff;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.column - b.column;
  });
}

export function groupDiagnosticsByPath(diagnostics) {
  const groups = new Map();

  for (const diagnostic of diagnostics) {
    if (!groups.has(diagnostic.path)) {
      groups.set(diagnostic.path, []);
    }
    groups.get(diagnostic.path).push(diagnostic);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => {
      const sevDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
      if (sevDiff !== 0) {
        return sevDiff;
      }
      return a.line - b.line;
    });
  }

  return Array.from(groups.entries()).sort((a, b) => {
    if (a[0] < b[0]) {
      return -1;
    }
    if (a[0] > b[0]) {
      return 1;
    }
    return 0;
  });
}

export function countSeverity(diagnostics, severity) {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
}