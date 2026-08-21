import { isSecretPath } from "./context/secrets";

function scoreCandidate(candidate, context) {
  let score = 0;
  const reasons = [];

  if (context.currentFile && candidate.path === context.currentFile.path) {
    score += 100;
    reasons.push("current file");
  }
  if (context.selection && candidate.path === context.selection.path) {
    score += 90;
    reasons.push("selection");
  }
  if (context.activePath && candidate.path && candidate.path.startsWith(context.activePath.split("/").slice(0, -1).join("/"))) {
    score += 20;
    reasons.push("same directory");
  }
  if (context.importedFiles && context.importedFiles.includes(candidate.path)) {
    score += 70;
    reasons.push("imported");
  }
  if (context.importers && context.importers.includes(candidate.path)) {
    score += 50;
    reasons.push("importer");
  }
  if (context.graphNeighbors && context.graphNeighbors.includes(candidate.path)) {
    score += 40;
    reasons.push("graph neighbor");
  }
  if (context.diagnostics && context.diagnostics.some((d) => d.path === candidate.path)) {
    score += 30;
    reasons.push("diagnostic");
  }
  if (context.recentPaths && context.recentPaths.includes(candidate.path)) {
    score += 10;
    reasons.push("recent");
  }
  if (context.searchMatches && context.searchMatches.some((m) => m.path === candidate.path)) {
    score += 15;
    reasons.push("search match");
  }
  if (candidate.size != null) {
    if (candidate.size > 50000) {
      score -= 10;
    }
  }
  return { score, reasons };
}

export function rankWorkspaceContext({
  candidates = [],
  currentFile = null,
  selection = null,
  activePath = null,
  importedFiles = [],
  importers = [],
  graphNeighbors = [],
  diagnostics = [],
  recentPaths = [],
  searchMatches = [],
  budget = 24000,
} = {}) {
  const filtered = candidates.filter((c) => c && typeof c.path === "string" && !isSecretPath(c.path));
  const ranked = filtered.map((candidate) => {
    const { score, reasons } = scoreCandidate(candidate, {
      currentFile,
      selection,
      activePath,
      importedFiles,
      importers,
      graphNeighbors,
      diagnostics,
      recentPaths,
      searchMatches,
    });
    return {
      path: candidate.path,
      score,
      reason: reasons.join(", ") || "other",
      size: typeof candidate.content === "string" ? candidate.content.length : candidate.size || 0,
      priority: candidate.priority ?? 99,
      content: candidate.content || null,
    };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.priority - b.priority;
  });

  let used = 0;
  const included = [];
  const excluded = [];
  for (const item of ranked) {
    if (used + item.size <= budget) {
      included.push({ ...item, included: true });
      used += item.size;
    } else {
      excluded.push({ ...item, included: false });
    }
  }

  return {
    ranked,
    included,
    excluded,
    used,
    budget,
    remaining: Math.max(0, budget - used),
  };
}
