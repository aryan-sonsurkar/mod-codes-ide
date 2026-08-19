import { analyzeFile, isSupportedPath } from "./index";

const MAX_SEARCH_RESULTS = 200;

export function collectFileSymbols(analysis) {
  return (analysis?.symbols || []).map((symbol) => ({
    ...symbol,
    path: analysis.path,
  }));
}

export function collectWorkspaceSymbols(documents) {
  const output = [];

  for (const document of documents) {
    if (
      !document ||
      typeof document.content !== "string" ||
      !isSupportedPath(document.path)
    ) {
      continue;
    }

    const analysis = analyzeFile(document.path, document.content);
    output.push(...collectFileSymbols(analysis));
  }

  return output;
}

export function searchSymbols(symbols, query, limit = MAX_SEARCH_RESULTS) {
  const trimmed = typeof query === "string" ? query.trim().toLowerCase() : "";

  if (!trimmed) {
    return symbols.slice(0, limit);
  }

  const filtered = symbols.filter((symbol) =>
    symbol.name.toLowerCase().includes(trimmed)
  );

  filtered.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(trimmed);
    const bStarts = b.name.toLowerCase().startsWith(trimmed);
    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }
    if (a.path !== b.path) {
      return a.path < b.path ? -1 : 1;
    }
    return a.line - b.line;
  });

  return filtered.slice(0, limit);
}