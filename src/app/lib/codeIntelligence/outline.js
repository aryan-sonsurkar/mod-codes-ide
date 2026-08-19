function sortByLine(symbols) {
  return [...symbols].sort((a, b) => {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return (a.column || 1) - (b.column || 1);
  });
}

export function buildOutline(analysis) {
  if (!analysis || analysis.supported === false) {
    return { supported: false, groups: [] };
  }

  const byKind = { function: [], class: [], variable: [] };

  for (const symbol of analysis.symbols || []) {
    if (byKind[symbol.kind]) {
      byKind[symbol.kind].push(symbol);
    }
  }

  const imports = (analysis.imports || [])
    .filter((entry) => entry.names && entry.names.length > 0)
    .map((entry) => ({
      name: entry.names.join(", "),
      kind: "import",
      line: entry.line,
      column: entry.column ?? 1,
      detail: entry.source ? `from "${entry.source}"` : "",
    }));

  const exports = (analysis.exports || []).map((entry) => ({
    name: entry.name,
    kind: entry.kind,
    line: entry.line,
    column: entry.column ?? 1,
    detail: entry.source ? `from "${entry.source}"` : "",
  }));

  const groups = [
    {
      key: "functions",
      label: "Functions",
      symbols: sortByLine(byKind.function),
    },
    {
      key: "classes",
      label: "Classes",
      symbols: sortByLine(byKind.class),
    },
    {
      key: "variables",
      label: "Variables",
      symbols: sortByLine(byKind.variable),
    },
    {
      key: "imports",
      label: "Imports",
      symbols: sortByLine(imports),
    },
    {
      key: "exports",
      label: "Exports",
      symbols: sortByLine(exports),
    },
  ].filter((group) => group.symbols.length > 0);

  return { supported: true, groups };
}