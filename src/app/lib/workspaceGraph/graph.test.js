import { describe, expect, it } from "vitest";
import {
  buildWorkspaceGraph,
  dependenciesOf,
  dependentsOf,
  detectCircularImports,
} from "./graph";

function makeAnalysis(imports) {
  return (path) => ({
    path,
    imports: (imports[path] || []).map((source) => ({ source })),
  });
}

describe("buildWorkspaceGraph", () => {
  it("builds nodes and edges from resolved imports", () => {
    const files = ["proj/a.js", "proj/b.js", "proj/c.ts"];
    const graph = buildWorkspaceGraph({
      files,
      getAnalysis: makeAnalysis({
        "proj/a.js": ["./b"],
        "proj/b.js": ["./c", "node-lib"],
      }),
    });

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toEqual([
      { from: "proj/a.js", to: "proj/b.js", type: "import" },
      { from: "proj/b.js", to: "proj/c.ts", type: "import" },
    ]);
  });

  it("skips missing targets and dedupes edges", () => {
    const files = ["proj/a.js"];
    const graph = buildWorkspaceGraph({
      files,
      getAnalysis: makeAnalysis({
        "proj/a.js": ["./b", "./b"],
      }),
    });

    expect(graph.edges).toHaveLength(0);
  });
});

describe("dependenciesOf / dependentsOf", () => {
  const graph = buildWorkspaceGraph({
    files: ["proj/a.js", "proj/b.js"],
    getAnalysis: makeAnalysis({ "proj/a.js": ["./b"] }),
  });

  it("lists dependencies and dependents", () => {
    expect(dependenciesOf(graph, "proj/a.js")).toEqual(["proj/b.js"]);
    expect(dependentsOf(graph, "proj/b.js")).toEqual(["proj/a.js"]);
    expect(dependentsOf(graph, "proj/a.js")).toEqual([]);
  });
});

describe("detectCircularImports", () => {
  it("detects a cycle", () => {
    const graph = buildWorkspaceGraph({
      files: ["proj/a.js", "proj/b.js", "proj/c.ts"],
      getAnalysis: makeAnalysis({
        "proj/a.js": ["./b"],
        "proj/b.js": ["./c"],
        "proj/c.ts": ["./a"],
      }),
    });

    const cycles = detectCircularImports(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain("proj/a.js");
    expect(cycles[0][0]).toBe(cycles[0][cycles[0].length - 1]);
  });

  it("returns no cycles for a DAG", () => {
    const graph = buildWorkspaceGraph({
      files: ["proj/a.js", "proj/b.js"],
      getAnalysis: makeAnalysis({ "proj/a.js": ["./b"] }),
    });

    expect(detectCircularImports(graph)).toEqual([]);
  });
});