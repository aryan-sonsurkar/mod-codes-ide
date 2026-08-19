import { buildBudget } from "./budget";
import {
  currentFileSource,
  diagnosticsSource,
  explicitFilesSource,
  graphSource,
  openDocumentsSource,
  searchSource,
  selectionSource,
  symbolsSource,
} from "./sources";
import { CONTEXT_PRIORITY, createContextItem, markTruncated } from "./item";

const SOURCE_ORDER = [
  "selection",
  "currentFile",
  "explicitFiles",
  "symbols",
  "openDocuments",
  "searchResults",
  "diagnostics",
  "graph",
];

function collectCandidates(request, enabledSources) {
  const sources = enabledSources || SOURCE_ORDER;
  const collectors = {
    selection: selectionSource,
    currentFile: currentFileSource,
    explicitFiles: explicitFilesSource,
    symbols: symbolsSource,
    openDocuments: openDocumentsSource,
    searchResults: searchSource,
    diagnostics: diagnosticsSource,
    graph: graphSource,
  };

  const candidates = [];
  for (const name of SOURCE_ORDER) {
    if (!sources.includes(name)) {
      continue;
    }
    const collector = collectors[name];
    if (collector) {
      candidates.push(...collector(request));
    }
  }

  return candidates;
}

export function buildContext(request = {}) {
  const budget = buildBudget({ budget: request.budget });
  const candidates = collectCandidates(request, request.sources);

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const sourceIndexA = SOURCE_ORDER.indexOf(a.source);
    const sourceIndexB = SOURCE_ORDER.indexOf(b.source);
    return (sourceIndexA === -1 ? 99 : sourceIndexA) - (sourceIndexB === -1 ? 99 : sourceIndexB);
  });

  const items = [];
  let remaining = budget.remaining;

  for (const candidate of candidates) {
    const length = candidate.content.length;

    if (length === 0) {
      continue;
    }

    if (length <= remaining) {
      items.push(candidate);
      remaining -= length;
      continue;
    }

    if (candidate.priority <= CONTEXT_PRIORITY.relatedSymbols && remaining > 0) {
      items.push(markTruncated(candidate, remaining));
      remaining = 0;
      continue;
    }
  }

  return {
    items,
    budget: budget.total,
    used: budget.total - remaining,
    remaining,
    estimatedTokens: Math.ceil((budget.total - remaining) / 4),
  };
}

export function createFallbackContext(message) {
  return {
    items: [
      createContextItem({
        type: "message",
        content: message,
        priority: CONTEXT_PRIORITY.other,
        source: "fallback",
      }),
    ],
    budget: 0,
    used: message.length,
    remaining: 0,
    estimatedTokens: Math.ceil(message.length / 4),
  };
}