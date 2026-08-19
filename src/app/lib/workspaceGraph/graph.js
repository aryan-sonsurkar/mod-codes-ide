import { resolveRelativeImport } from "../diagnostics/resolve";

export function buildWorkspaceGraph({ files, getAnalysis }) {
  const pathSet = new Set(files);
  const nodes = files.map((path) => ({ path, type: "file" }));
  const edges = [];
  const seen = new Set();

  for (const path of files) {
    const analysis = getAnalysis ? getAnalysis(path) : null;
    const imports = analysis?.imports || [];

    for (const entry of imports) {
      if (typeof entry.source !== "string" || !entry.source.startsWith(".")) {
        continue;
      }

      const resolved = resolveRelativeImport(path, entry.source, pathSet);
      if (!resolved) {
        continue;
      }

      const key = `${path}\u0000${resolved}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      edges.push({ from: path, to: resolved, type: "import" });
    }
  }

  return { nodes, edges };
}

export function dependenciesOf(graph, path) {
  return graph.edges
    .filter((edge) => edge.from === path)
    .map((edge) => edge.to);
}

export function dependentsOf(graph, path) {
  return graph.edges
    .filter((edge) => edge.to === path)
    .map((edge) => edge.from);
}

export function detectCircularImports(graph) {
  const adjacency = new Map();

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from).push(edge.to);
  }

  const state = new Map();
  const stack = [];
  const cycles = [];

  function visit(path) {
    state.set(path, 1);
    stack.push(path);

    for (const next of adjacency.get(path) || []) {
      const nextState = state.get(next);

      if (nextState === 1) {
        const start = stack.indexOf(next);
        if (start !== -1) {
          cycles.push([...stack.slice(start), next]);
        }
      } else if (nextState === undefined) {
        visit(next);
      }
    }

    stack.pop();
    state.set(path, 2);
  }

  for (const node of graph.nodes) {
    if (state.get(node.path) === undefined) {
      visit(node.path);
    }
  }

  return cycles;
}