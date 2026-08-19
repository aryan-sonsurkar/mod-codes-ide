export const CONTEXT_TYPES = {
  currentFile: "current_file",
  selection: "selection",
  openDocument: "open_document",
  symbols: "symbols",
  diagnostics: "diagnostics",
  graph: "graph",
  search: "search",
  explicit: "explicit",
};

export const CONTEXT_PRIORITY = {
  selection: 0,
  currentFile: 1,
  relatedSymbols: 2,
  openDocuments: 3,
  importedFiles: 4,
  searchResults: 5,
  diagnostics: 6,
  graph: 7,
  explicitFiles: 2,
  other: 8,
};

export function createContextItem({
  type,
  path = null,
  content = "",
  metadata = {},
  priority = CONTEXT_PRIORITY.other,
  source = "context",
}) {
  return {
    type,
    path,
    content: typeof content === "string" ? content : "",
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    priority,
    source,
    truncated: false,
  };
}

export function contextItemLength(item) {
  return item.content.length;
}

export function markTruncated(item, budget) {
  return { ...item, content: item.content.slice(0, budget), truncated: true };
}