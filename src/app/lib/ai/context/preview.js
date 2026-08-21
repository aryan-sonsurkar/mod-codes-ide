const LABELS = {
  current_file: "Current file",
  selection: "Selection",
  open_document: "Open document",
  symbols: "Symbols",
  diagnostics: "Diagnostics",
  graph: "Workspace graph",
  search: "Search results",
  explicit: "Explicit file",
};

export function buildContextPreview(context) {
  const items = context.items || [];

  const byType = new Map();
  let totalChars = 0;

  for (const item of items) {
    totalChars += item.content.length;
    if (!byType.has(item.type)) {
      byType.set(item.type, { count: 0, truncated: false });
    }
    const entry = byType.get(item.type);
    entry.count += 1;
    if (item.truncated) {
      entry.truncated = true;
    }
  }

  const sections = Array.from(byType.entries()).map(([type, stats]) => ({
    type,
    label: LABELS[type] || type,
    count: stats.count,
    truncated: stats.truncated,
  }));

  const files = items
    .filter((item) => typeof item.path === "string")
    .map((item) => item.path);

  return {
    sections,
    totalChars,
    budget: context.budget ?? 0,
    files,
    filesCount: files.length,
    truncated: items.some((item) => item.truncated),
    limitedBy: Number.isFinite(context.limitedBy) ? context.limitedBy : null,
  };
}