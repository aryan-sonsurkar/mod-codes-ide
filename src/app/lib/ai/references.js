export const REFERENCE_TYPES = {
  file: "file",
  line: "line",
  symbol: "symbol",
  diagnostic: "diagnostic",
  search: "search",
  graph: "graph",
};

export function createReference({ type, path, line = null, column = null, symbol = null, label = null } = {}) {
  if (!type || typeof type !== "string") {
    throw new TypeError("Reference type is required");
  }
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Reference path is required");
  }
  return {
    type,
    path,
    line: Number.isFinite(line) ? line : null,
    column: Number.isFinite(column) ? column : null,
    symbol: typeof symbol === "string" ? symbol : null,
    label: typeof label === "string" && label.length > 0 ? label : `${path}${line ? `:${line}` : ""}`,
  };
}

export function parseReferencesFromText(text) {
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }
  const pattern = /([^\s`"'()]+(?:\/[^\s`"'()]+)+\.\w+)(?::(\d+)(?::(\d+))?)?/g;
  const references = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const path = match[1];
    const line = match[2] ? Number.parseInt(match[2], 10) : null;
    const column = match[3] ? Number.parseInt(match[3], 10) : null;
    if (path.includes(".") && !path.startsWith("http")) {
      references.push(createReference({ type: REFERENCE_TYPES.file, path, line, column }));
    }
  }
  return references;
}

export function referencesFromDiagnostics(diagnostics = []) {
  return diagnostics
    .filter((item) => item && typeof item.path === "string")
    .map((item) =>
      createReference({
        type: REFERENCE_TYPES.diagnostic,
        path: item.path,
        line: item.line || null,
        column: item.column || null,
        label: `${item.path}:${item.line || "?"} ${item.message || ""}`.trim(),
      })
    );
}

export function referencesFromSymbols(symbols = []) {
  return symbols.flatMap((entry) =>
    (entry.symbols || [])
      .filter((symbol) => symbol && typeof symbol.name === "string")
      .map((symbol) =>
        createReference({
          type: REFERENCE_TYPES.symbol,
          path: entry.path,
          line: symbol.line || null,
          symbol: symbol.name,
          label: `${entry.path}:${symbol.line || "?"} ${symbol.name}`,
        })
      )
  );
}
