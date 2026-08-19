"use client";
import { useMemo, useState } from "react";
import "./GraphPanel.css";
import {
  ArrowRight,
  ArrowLeft,
  GitBranch,
  RefreshCw,
  Link2,
} from "lucide-react";
import { analyzeFile, isSupportedPath } from "../../../lib/codeIntelligence";
import {
  collectFilePaths,
  resolveRelativeImport,
} from "../../../lib/diagnostics/resolve";
import {
  analyzeWorkspaceGraph,
  dependentsOf,
  detectCircularImports,
} from "../../../lib/workspaceGraph";

export default function GraphPanel({
  activePath,
  activeContent,
  tree,
  tabs,
  readFile,
  onOpen,
}) {
  const [graph, setGraph] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const filePaths = useMemo(
    () => (tree ? collectFilePaths(tree) : new Set()),
    [tree]
  );

  const dependencies = useMemo(() => {
    if (!activePath || typeof activeContent !== "string") {
      return [];
    }
    if (!isSupportedPath(activePath)) {
      return [];
    }

    const analysis = analyzeFile(activePath, activeContent);
    const output = [];

    for (const entry of analysis.imports || []) {
      if (typeof entry.source !== "string" || !entry.source.startsWith(".")) {
        continue;
      }
      const resolved = resolveRelativeImport(
        activePath,
        entry.source,
        filePaths
      );
      output.push({
        source: entry.source,
        path: resolved,
        missing: !resolved,
        line: entry.line,
      });
    }

    return output;
  }, [activePath, activeContent, filePaths]);

  const dependents = useMemo(
    () => (graph && activePath ? dependentsOf(graph, activePath) : []),
    [graph, activePath]
  );

  const cycles = useMemo(
    () => (graph ? detectCircularImports(graph) : []),
    [graph]
  );

  async function handleAnalyze() {
    if (!tree || analyzing) {
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const result = await analyzeWorkspaceGraph(tree, {
        readFile,
        openDocuments: tabs,
      });
      setGraph(result);
    } catch (err) {
      setError("Could not analyze the workspace graph.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="graph-panel">
      <div className="graph-section">
        <div className="graph-section-header">
          <ArrowRight size={13} />
          <span>Imports</span>
        </div>
        {dependencies.length === 0 ? (
          <p className="graph-empty">
            {!activePath || typeof activeContent !== "string"
              ? "Open a file to see its imports."
              : "No relative imports found."}
          </p>
        ) : (
          <div className="graph-list">
            {dependencies.map((entry) => (
              <button
                type="button"
                key={`${activePath}:${entry.source}`}
                className={`graph-item${entry.missing ? " graph-item-missing" : ""}`}
                disabled={entry.missing}
                title={entry.path || entry.source}
                onClick={() => entry.path && onOpen(entry.path)}
              >
                <Link2 size={12} />
                <span className="graph-item-name">{entry.source}</span>
                {entry.missing ? (
                  <span className="graph-item-status">missing</span>
                ) : (
                  <span className="graph-item-path">{entry.path}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="graph-section">
        <div className="graph-section-header">
          <ArrowLeft size={13} />
          <span>Imported by</span>
        </div>

        {!graph ? (
          <div className="graph-analyze">
            <p className="graph-empty">
              Analyze the workspace to find which files import the active file.
            </p>
            <button
              type="button"
              className="graph-analyze-button"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              <RefreshCw size={13} className={analyzing ? "graph-spin" : ""} />
              {analyzing ? "Analyzing workspace..." : "Analyze workspace"}
            </button>
          </div>
        ) : (
          <>
            {dependents.length === 0 ? (
              <p className="graph-empty">Nothing imports this file.</p>
            ) : (
              <div className="graph-list">
                {dependents.map((path) => (
                  <button
                    type="button"
                    key={path}
                    className="graph-item"
                    title={path}
                    onClick={() => onOpen(path)}
                  >
                    <GitBranch size={12} />
                    <span className="graph-item-name">{path}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {graph && (
          <p className="graph-summary">
            {graph.totalFiles} files analyzed · {graph.edges.length} imports
            {cycles.length > 0
              ? ` · ${cycles.length} circular import${cycles.length === 1 ? "" : "s"}`
              : ""}
          </p>
        )}
        {error && <p className="graph-error">{error}</p>}
      </div>
    </div>
  );
}