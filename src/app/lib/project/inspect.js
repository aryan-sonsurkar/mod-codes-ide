"use client";
import { buildWorkspaceGraph } from "../workspaceGraph/graph";
import { analyzeFile } from "../codeIntelligence/analyzer";

function findFiles(tree, predicate, limit = 20) {
  const out = [];
  function walk(node) {
    if (!node || out.length >= limit) return;
    if (node.kind === "file" && predicate(node)) out.push(node);
    if (node.children) node.children.forEach(walk);
  }
  walk(tree);
  return out;
}

export async function inspectCodebase({ tree, fileContents }) {
  const files = [];
  function collectFiles(node) {
    if (!node) return;
    if (node.kind === "file") files.push(node.path);
    else if (node.children) node.children.forEach(collectFiles);
  }
  collectFiles(tree);
  const graph = buildWorkspaceGraph({ files, getAnalysis: () => null });
  const technologies = new Set();
  const entryPoints = [];
  const routes = [];
  const configs = [];
  let packageJson = null;
  let testingSetup = "unknown";
  let confidence = "low";

  function walk(node) {
    if (!node) return;
    if (node.kind === "file") {
      const ext = node.name.split(".").pop();
      if (["js","jsx","ts","tsx","py","json"].includes(ext)) technologies.add(ext);
      if (["index.js","app.js","main.py","package.json","page.js","layout.js"].includes(node.name)) entryPoints.push(node.path);
      if (node.path && node.path.includes("/app/") && node.name === "page.js") routes.push(node.path);
      if (["package.json","tsconfig.json","next.config.mjs","next.config.js","vite.config.js","pyproject.toml"].includes(node.name)) configs.push(node.name);
      if (node.name === "package.json" && fileContents && fileContents.has(node.path)) {
        try { packageJson = JSON.parse(fileContents.get(node.path)); } catch {}
      }
    } else if (node.children) node.children.forEach(walk);
  }
  walk(tree);

  // dependencies
  const deps = packageJson ? Object.keys(packageJson.dependencies || {}).slice(0,10) : [];
  const devDeps = packageJson ? Object.keys(packageJson.devDependencies || {}).slice(0,10) : [];
  // testing
  const hasVitest = findFiles(tree, n=>n.name.includes("vitest")).length>0 || (packageJson && JSON.stringify(packageJson).includes("vitest"));
  const hasJest = findFiles(tree, n=>n.name.includes("jest")).length>0;
  if (hasVitest) testingSetup = "vitest";
  else if (hasJest) testingSetup = "jest";
  else testingSetup = "none detected";

  const readme = findFiles(tree, n=>n.name.toLowerCase()==="readme.md").map(n=>n.path)[0] || null;
  const envTemplate = findFiles(tree, n=>n.name.startsWith(".env")).map(n=>n.path)[0] || null;

  // architecture summary bounded
  const analysis = [];
  if (fileContents) {
    for (const [path, text] of fileContents.entries()) {
      if (analysis.length >= 5) break;
      try { analysis.push({ path, result: analyzeFile(text, path) }); } catch {}
    }
  }

  const techStack = Array.from(technologies);
  if (packageJson && packageJson.dependencies && packageJson.dependencies.next) techStack.push("Next.js");
  if (packageJson && packageJson.dependencies && packageJson.dependencies.react) techStack.push("React");

  if (entryPoints.length && configs.length) confidence = "medium";
  if (deps.length && testingSetup !== "none detected") confidence = "high";

  const risks = [];
  if (!packageJson) risks.push("No package.json — stack unclear");
  if (testingSetup === "none detected") risks.push("No test setup detected");
  if (!envTemplate && deps.includes("dotenv")) risks.push("Env template missing");
  if (graph.edges && graph.edges.length > 1000) risks.push("Large dependency graph — respect context budget");

  const unknowns = [];
  if (!readme) unknowns.push("README missing");
  if (!confidence || confidence==="low") unknowns.push("Architecture not fully inferred — bounded scan");

  return {
    projectOverview: `${graph.nodes?.length || 0} files, ${graph.edges?.length || 0} imports, ${techStack.join(", ") || "unknown stack"}`,
    technologyStack: techStack,
    entryPoints: entryPoints.slice(0,10),
    architectureSummary: `Framework: ${techStack.includes("Next.js")?"Next.js App Router":techStack.join(", ") || "unknown"}; Routes: ${routes.slice(0,5).join(", ") || "none"}; Configs: ${configs.join(", ") || "none"}`,
    dependencies: { deps, devDeps },
    testingSetup,
    potentialRisks: risks,
    unknowns,
    confidence,
    structure: `${graph.nodes?.length || 0} files, ${graph.edges?.length || 0} imports`,
    technologies: techStack,
    analysis: analysis.slice(0,5),
    configPresent: configs.length > 0,
    recommendation: "Create plan → show for approval → execute approved plan only. Never silently modify unfamiliar code.",
    readmePath: readme,
    envTemplate,
    routes: routes.slice(0,10),
  };
}
