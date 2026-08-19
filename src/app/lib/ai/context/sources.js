import {
  CONTEXT_PRIORITY,
  CONTEXT_TYPES,
  createContextItem,
} from "./item";
import { isSecretPath } from "./secrets";

const MAX_SYMBOLS_PER_SOURCE = 200;
const MAX_DIAGNOSTICS_PER_SOURCE = 100;
const MAX_GRAPH_NODES = 100;
const MAX_SEARCH_RESULTS = 50;
const MAX_EXPLICIT_FILES = 20;

function serializeSymbols(symbols, path) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return null;
  }

  const lines = symbols.slice(0, MAX_SYMBOLS_PER_SOURCE).map((symbol) => {
    const location = symbol.line ? `:${symbol.line}` : "";
    return `${symbol.kind || "symbol"} ${symbol.name}${location}`;
  });

  return { path, text: `Symbols in ${path}\n${lines.join("\n")}` };
}

export function currentFileSource(request) {
  const current = request.currentFile;
  if (!current || typeof current.path !== "string" || typeof current.content !== "string") {
    return [];
  }
  if (isSecretPath(current.path)) {
    return [];
  }
  return [
    createContextItem({
      type: CONTEXT_TYPES.currentFile,
      path: current.path,
      content: current.content,
      metadata: { language: current.language || null },
      priority: CONTEXT_PRIORITY.currentFile,
      source: "currentFile",
    }),
  ];
}

export function selectionSource(request) {
  const selection = request.selection;
  if (!selection || typeof selection.text !== "string" || selection.text.length === 0) {
    return [];
  }
  return [
    createContextItem({
      type: CONTEXT_TYPES.selection,
      path: selection.path || null,
      content: selection.text,
      metadata: {
        startLine: selection.startLine ?? null,
        endLine: selection.endLine ?? null,
      },
      priority: CONTEXT_PRIORITY.selection,
      source: "selection",
    }),
  ];
}

export function openDocumentsSource(request) {
  const documents = request.openDocuments;
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  return documents
    .filter(
      (document) =>
        typeof document.path === "string" &&
        typeof document.content === "string" &&
        !isSecretPath(document.path)
    )
    .map((document) =>
      createContextItem({
        type: CONTEXT_TYPES.openDocument,
        path: document.path,
        content: document.content,
        metadata: { name: document.name || null },
        priority: CONTEXT_PRIORITY.openDocuments,
        source: "openDocuments",
      })
    );
}

export function symbolsSource(request) {
  const sources = request.symbols;
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  return sources
    .filter((entry) => entry && typeof entry.path === "string")
    .map((entry) => {
      const serialized = serializeSymbols(entry.symbols, entry.path);
      if (!serialized) {
        return null;
      }
      return createContextItem({
        type: CONTEXT_TYPES.symbols,
        path: entry.path,
        content: serialized.text,
        metadata: { count: Array.isArray(entry.symbols) ? entry.symbols.length : 0 },
        priority: CONTEXT_PRIORITY.relatedSymbols,
        source: "symbols",
      });
    })
    .filter(Boolean);
}

export function diagnosticsSource(request) {
  const diagnostics = request.diagnostics;
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return [];
  }

  const byPath = new Map();
  for (const diagnostic of diagnostics.slice(0, MAX_DIAGNOSTICS_PER_SOURCE)) {
    if (!diagnostic || typeof diagnostic.path !== "string") {
      continue;
    }
    if (!byPath.has(diagnostic.path)) {
      byPath.set(diagnostic.path, []);
    }
    byPath.get(diagnostic.path).push(diagnostic);
  }

  const items = [];
  for (const [path, entries] of byPath) {
    const lines = entries.map((entry) => {
      const location = entry.line ? `${entry.line}${entry.column ? `:${entry.column}` : ""}` : "";
      return `[${entry.severity || "error"}]${location ? ` ${location}` : ""} ${entry.message || ""}`;
    });
    items.push(
      createContextItem({
        type: CONTEXT_TYPES.diagnostics,
        path,
        content: `Diagnostics in ${path}\n${lines.join("\n")}`,
        metadata: { count: entries.length },
        priority: CONTEXT_PRIORITY.diagnostics,
        source: "diagnostics",
      })
    );
  }

  return items;
}

export function graphSource(request) {
  const graph = request.graph;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return [];
  }

  const nodes = graph.nodes.slice(0, MAX_GRAPH_NODES);
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const lines = nodes.map((node) => {
    const dependents = edges
      .filter((edge) => edge.to === node.path)
      .map((edge) => edge.from);
    const dependencyList = edges
      .filter((edge) => edge.from === node.path)
      .map((edge) => edge.to);

    const parts = [];
    if (dependencyList.length > 0) {
      parts.push(`imports ${dependencyList.join(", ")}`);
    }
    if (dependents.length > 0) {
      parts.push(`imported by ${dependents.join(", ")}`);
    }
    return parts.length > 0 ? `${node.path} (${parts.join("; ")})` : node.path;
  });

  return [
    createContextItem({
      type: CONTEXT_TYPES.graph,
      path: null,
      content: `Workspace dependency graph (${nodes.length} files, ${edges.length} edges)\n${lines.join("\n")}`,
      metadata: { nodes: nodes.length, edges: edges.length },
      priority: CONTEXT_PRIORITY.graph,
      source: "graph",
    }),
  ];
}

export function searchSource(request) {
  const results = request.searchResults;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const lines = results.slice(0, MAX_SEARCH_RESULTS).map((result) => {
    const location = result.line ? `:${result.line}` : "";
    return `${result.path}${location} ${result.text || ""}`.trim();
  });

  return [
    createContextItem({
      type: CONTEXT_TYPES.search,
      path: null,
      content: `Search results (${results.length} matches)\n${lines.join("\n")}`,
      metadata: { count: results.length },
      priority: CONTEXT_PRIORITY.searchResults,
      source: "searchResults",
    }),
  ];
}

export function explicitFilesSource(request) {
  const files = request.explicitFiles;
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  return files
    .filter(
      (file) =>
        typeof file.path === "string" &&
        typeof file.content === "string" &&
        !isSecretPath(file.path)
    )
    .slice(0, MAX_EXPLICIT_FILES)
    .map((file) =>
      createContextItem({
        type: CONTEXT_TYPES.explicit,
        path: file.path,
        content: file.content,
        metadata: { name: file.name || null },
        priority: CONTEXT_PRIORITY.explicitFiles,
        source: "explicitFiles",
      })
    );
}