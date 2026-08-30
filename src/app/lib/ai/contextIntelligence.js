"use client";
import { isSecretPath } from "./context/secrets";
import { rankWorkspaceContext } from "./relevanceRanking";
import { buildWorkspaceGraph } from "../workspaceGraph/graph";

const DEFAULT_BUDGET = 24000;
const MAX_FILES = 14;
const MAX_CANDIDATES = 50;
const MAX_RESEARCH_FINDINGS = 4;
const MAX_DECISIONS = 3;
const MAX_PRD_REQUIREMENTS = 5;
const SKIPPED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
const MAX_FILE_SIZE = 50000; // for context selection, large files excluded

function normalizeTask(task) {
  return String(task || "").toLowerCase();
}

function tokenize(text) {
  return String(text || "").toLowerCase().split(/\W+/).filter(Boolean);
}

function collectFiles(tree, fileContents) {
  const files = [];
  function walk(node) {
    if (!node) return;
    if (node.kind === "directory" && SKIPPED_DIRS.has(node.name)) return;
    if (node.kind === "file") {
      if (isSecretPath(node.path)) return;
      const content = fileContents ? fileContents.get(node.path) : null;
      const size = typeof content === "string" ? content.length : 0;
      if (size > MAX_FILE_SIZE) return;
      // skip large binaries by extension heuristic (handled via size)
      files.push({ path: node.path, content, size, name: node.name });
    } else if (node.children) node.children.forEach(walk);
  }
  walk(tree);
  return files.slice(0, MAX_CANDIDATES);
}

function parseSectionItems(text, max) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    if (line.startsWith("-") || line.startsWith("*") || /^FR-/.test(line) || /^R\d/.test(line) || line.startsWith("###")) {
      items.push(line);
      if (items.length >= max) break;
    }
  }
  // fallback: if no bullet, chunk by 200 chars
  if (items.length === 0 && String(text || "").trim()) {
    const t = String(text).trim().slice(0, 800);
    items.push(t.slice(0, 400));
  }
  return items;
}

export function createContextRequest({ task, milestone, project, phase, focusFiles, requiredSections, budget } = {}) {
  if (!task || typeof task !== "string" || !task.trim()) throw new Error("task required");
  return {
    task: String(task).trim(),
    milestone: milestone || null,
    project: project || null,
    phase: phase || null,
    focusFiles: Array.isArray(focusFiles) ? focusFiles.filter((p) => typeof p === "string") : [],
    requiredSections: Array.isArray(requiredSections) ? requiredSections : [],
    budget: Number.isFinite(budget) ? Math.max(2000, Math.min(200000, Math.round(budget))) : DEFAULT_BUDGET,
  };
}

export function selectContext(request, {
  projectData,
  tree,
  fileContents,
  diagnostics = [],
  recentPaths = [],
  searchMatches = [],
  budget,
} = {}) {
  const taskLower = normalizeTask(request.task);
  const taskTokens = new Set(tokenize(request.task));
  const milestoneTokens = request.milestone ? new Set(tokenize(`${request.milestone.goal || ""} ${request.milestone.title || ""} ${(request.milestone.tasks||[]).join(" ")}`)) : new Set();

  // 1. Discover candidates
  const candidates = [];
  const provenanceMap = new Map();

  // Files
  const fileList = tree ? collectFiles(tree, fileContents) : [];
  // Build graph for dependency awareness
  let graph = null;
  let graphNeighbors = [];
  try {
    const filePaths = fileList.map((f) => f.path);
    graph = buildWorkspaceGraph({ files: filePaths, getAnalysis: () => null });
  } catch { graph = null; }

  // Determine focus file for relevanceRanking (first focusFiles or milestone related)
  const focusPath = request.focusFiles[0] || null;

  // Add file candidates
  for (const f of fileList) {
    const isTest = /\.test\.(js|ts|jsx|tsx)$/.test(f.path) || /__tests__/.test(f.path);
    const isEnv = isSecretPath(f.path);
    if (isEnv) continue;
    // provenance
    const prov = { source: "project-file", path: f.path, type: isTest ? "test" : "file" };
    candidates.push({
      id: `file:${f.path}`,
      type: isTest ? "test" : "file",
      path: f.path,
      content: f.content ? String(f.content).slice(0, 3000) : "",
      size: f.size || 0,
      provenance: prov,
      isTest,
      rawFile: f,
    });
  }

  // PRD requirements
  const prdText = projectData ? String(projectData.sections?.PRD || "") : "";
  const prdItems = parseSectionItems(prdText, MAX_PRD_REQUIREMENTS);
  for (let i = 0; i < prdItems.length; i++) {
    const txt = prdItems[i];
    candidates.push({
      id: `prd:${i}`,
      type: "prd",
      path: `prd:requirement-${i}`,
      content: txt,
      size: txt.length,
      provenance: { source: "prd", requirement: `PRD-${i}`, section: "PRD" },
    });
  }

  // Research evidence
  const researchText = projectData ? String(projectData.sections?.Research || "") : "";
  const sourcesText = projectData ? String(projectData.sections?.Sources || "") : "";
  const researchItems = parseSectionItems(researchText + "\n" + sourcesText, MAX_RESEARCH_FINDINGS);
  for (let i = 0; i < researchItems.length; i++) {
    const txt = researchItems[i];
    candidates.push({
      id: `research:${i}`,
      type: "research",
      path: `research:${i}`,
      content: txt,
      size: txt.length,
      provenance: { source: "research", sessionId: `R${i}`, section: "Research" },
    });
  }

  // Decisions
  const decisionsText = projectData ? String(projectData.sections?.Decisions || "") : "";
  const decisionItems = parseSectionItems(decisionsText, MAX_DECISIONS);
  for (let i = 0; i < decisionItems.length; i++) {
    const txt = decisionItems[i];
    candidates.push({
      id: `decision:${i}`,
      type: "decision",
      path: `decision:${i}`,
      content: txt,
      size: txt.length,
      provenance: { source: "decision", decisionId: `D${i}`, section: "Decisions" },
    });
  }

  // Architecture
  const archText = projectData ? String(projectData.sections?.Architecture || "") : "";
  if (archText.trim()) {
    candidates.push({
      id: "architecture",
      type: "architecture",
      path: "architecture",
      content: archText.slice(0, 800),
      size: Math.min(archText.length, 800),
      provenance: { source: "architecture", section: "Architecture" },
    });
  }

  // Inspection summary as candidate (if available via fileContents? we add via context param inspection)
  // Note: inspection result passed via projectData inspection is handled outside; we add generic constraint candidate
  if (projectData && projectData.project) {
    candidates.push({
      id: "constraint",
      type: "constraint",
      path: "constraint:project",
      content: `Project ${projectData.project.name} phase ${projectData.project.phase}`,
      size: 80,
      provenance: { source: "project", section: "Project" },
    });
  }

  // Filter large / secret already done, also filter skipped dirs handled
  const filtered = candidates.filter((c) => {
    if (c.type === "file" || c.type === "test") {
      if (isSecretPath(c.path)) return false;
      if (c.size > MAX_FILE_SIZE) return false;
    }
    return true;
  }).slice(0, MAX_CANDIDATES);

  // 2. Ranking — deterministic, reuse rankWorkspaceContext for files where possible
  // For files, delegate to rankWorkspaceContext for dependency awareness
  const fileCandidates = filtered.filter((c) => c.type === "file" || c.type === "test");
  const otherCandidates = filtered.filter((c) => c.type !== "file" && c.type !== "test");

  let rankedFiles = [];
  if (fileCandidates.length) {
    // Prepare rankWorkspaceContext inputs: use graph neighbors if task mentions path
    // Derive importedFiles/importers from graph edges containing task keywords
    const importedFiles = [];
    const importers = [];
    if (graph && graph.edges) {
      for (const e of graph.edges) {
        if (taskLower.includes(e.from.toLowerCase().split("/").pop()) || taskLower.includes(e.to.toLowerCase().split("/").pop())) {
          importedFiles.push(e.to);
          importers.push(e.from);
          graphNeighbors.push(e.from, e.to);
        }
      }
    }
    const rankResult = rankWorkspaceContext({
      candidates: fileCandidates.map((c) => ({ path: c.path, content: c.content, size: c.size, priority: c.isTest ? 10 : 50 })),
      currentFile: focusPath ? { path: focusPath } : null,
      activePath: focusPath,
      importedFiles,
      importers,
      graphNeighbors: [...new Set(graphNeighbors)],
      diagnostics,
      recentPaths,
      searchMatches,
      budget: budget || request.budget || DEFAULT_BUDGET,
    });
    // Map back with reasons
    const reasonMap = new Map(rankResult.ranked.map((r) => [r.path, r.reason]));
    const scoreMap = new Map(rankResult.ranked.map((r) => [r.path, r.score]));
    rankedFiles = fileCandidates.map((c) => {
      const score = scoreMap.get(c.path) ?? 0;
      const reason = reasonMap.get(c.path) || (c.isTest ? "test relationship" : "file");
      // Boost if task tokens overlap path (substring, handles camelCase)
      let boost = 0;
      const pathLower = c.path.toLowerCase();
      for (const t of taskTokens) if (pathLower.includes(t)) boost += 40;
      for (const t of milestoneTokens) if (pathLower.includes(t)) boost += 15;
      if (c.isTest && (taskLower.includes("test") || taskLower.includes("auth") || taskLower.includes("password"))) boost += 25;
      const finalScore = score + boost;
      return { candidate: c, score: finalScore, reason: reason + (boost ? ", task match" : "") };
    });
  }

  // Score other candidates via keyword overlap
  const rankedOthers = otherCandidates.map((c) => {
    const contentTokens = new Set(tokenize(c.content));
    let score = 0;
    const reasons = [];
    for (const t of taskTokens) if (contentTokens.has(t)) { score += 30; reasons.push("direct task match"); break; }
    for (const t of milestoneTokens) if (contentTokens.has(t)) { score += 20; reasons.push("milestone relationship"); break; }
    if (c.type === "prd" && taskLower.includes("requirement")) { score += 15; reasons.push("PRD requirement relationship"); }
    if (c.type === "research" && taskLower.includes("research")) { score += 10; reasons.push("research evidence relationship"); }
    if (c.type === "decision" && taskLower.includes("decision")) { score += 10; reasons.push("decision relationship"); }
    if (c.type === "architecture") { score += 5; reasons.push("architecture relationship"); }
    // Dependency awareness for others: if candidate mentions file that is dependency
    if (graph && candidateMentionsGraph(c.content, graph)) { score += 15; reasons.push("dependency relationship"); }
    return { candidate: c, score, reason: reasons.join(", ") || "other" };
  });

  function candidateMentionsGraph(content, g) {
    if (!g || !g.edges) return false;
    const low = String(content||"").toLowerCase();
    for (const e of g.edges) {
      const name = e.to.split("/").pop().toLowerCase();
      if (low.includes(name)) return true;
    }
    return false;
  }

  const allRanked = [...rankedFiles, ...rankedOthers].sort((a,b)=> b.score - a.score || a.candidate.type.localeCompare(b.candidate.type));

  // 3. Budgeting — rank first, then truncate low-value
  const effectiveBudget = budget || request.budget || DEFAULT_BUDGET;
  let used = 0;
  const selected = [];
  const rejected = [];
  let fileCount = 0;
  for (const item of allRanked) {
    const size = item.candidate.size || 0;
    const isFile = item.candidate.type === "file" || item.candidate.type === "test";
    if (isFile && fileCount >= MAX_FILES) {
      rejected.push({ ...item, reason: item.reason + "; budget exceeded (max files)", included: false });
      continue;
    }
    if (used + size <= effectiveBudget && selected.length < MAX_CANDIDATES) {
      selected.push({ ...item.candidate, score: item.score, reason: item.reason, provenance: item.candidate.provenance, included: true });
      used += size;
      if (isFile) fileCount++;
    } else {
      rejected.push({ ...item.candidate, score: item.score, reason: item.reason + "; budget exceeded", included: false });
    }
  }

  // Ensure at least one of each critical type if available and within budget? No — keep ranking, explain exclusion

  const result = {
    request,
    selected,
    rejected,
    budget: { total: effectiveBudget, used, remaining: Math.max(0, effectiveBudget - used), maxFiles: MAX_FILES, candidates: candidates.length, excluded: rejected.length },
    provenance: selected.map((s)=> s.provenance),
    // Explainability helpers
    explanation: selected.map((s)=> ({ path: s.path || s.id, reason: s.reason, provenance: s.provenance })),
  };

  return result;
}

export function createContextIntelligence(options = {}) {
  return {
    createRequest: createContextRequest,
    select: selectContext,
  };
}
