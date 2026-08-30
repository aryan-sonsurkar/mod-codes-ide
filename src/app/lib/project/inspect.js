"use client";
import { buildWorkspaceGraph } from "../workspaceGraph/graph";
import { analyzeFile } from "../codeIntelligence/analyzer";

export async function inspectCodebase({ tree, fileContents }) {
  // fileContents: Map<path,string> for sampling open files + entry points
  const graph = tree ? buildWorkspaceGraph(tree) : { nodes: [], edges: [] };
  const technologies = new Set();
  const entryPoints = [];

  function walk(node) {
    if (!node) return;
    if (node.kind === "file") {
      const ext = node.name.split(".").pop();
      if (["js","jsx","ts","tsx","py","json"].includes(ext)) technologies.add(ext);
      if (["index.js","app.js","main.py","package.json"].includes(node.name)) entryPoints.push(node.path);
    } else if (node.children) node.children.forEach(walk);
  }
  walk(tree);

  const analysis = [];
  if (fileContents) {
    for (const [path, text] of fileContents.entries()) {
      try { analysis.push({ path, result: analyzeFile(text, path) }); } catch {}
    }
  }

  return {
    structure: `${graph.nodes?.length || 0} files, ${graph.edges?.length || 0} imports`,
    technologies: Array.from(technologies),
    entryPoints,
    analysis: analysis.slice(0,5),
    configPresent: entryPoints.length > 0,
    recommendation: "Create plan → show for approval → execute approved plan only. Never silently modify unfamiliar code.",
  };
}
