import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupportedPath } from "../lib/codeIntelligence";
import { diagnoseFile } from "../lib/diagnostics";
import { collectFilePaths } from "../lib/diagnostics/resolve";
import { sortDiagnostics } from "../lib/diagnostics/model";

const ANALYSIS_DEBOUNCE_MS = 400;

export function useDiagnostics({ tabs, activePath, tree }) {
  const [diagnosticsByPath, setDiagnosticsByPath] = useState({});
  const analyzedTokensRef = useRef(new Map());
  const timerRef = useRef(null);

  const filePaths = useMemo(
    () => (tree ? collectFilePaths(tree) : new Set()),
    [tree]
  );

  const runAnalysis = useCallback(() => {
    if (!tree) {
      return;
    }

    const tokens = analyzedTokensRef.current;
    const openPaths = new Set(tabs.map((tab) => tab.path));
    const nextByPath = new Map();
    let changed = false;

    for (const tokenPath of tokens.keys()) {
      if (!openPaths.has(tokenPath)) {
        tokens.delete(tokenPath);
      }
    }

    for (const tab of tabs) {
      if (tab.readStatus !== "ready" || typeof tab.content !== "string") {
        continue;
      }
      if (!isSupportedPath(tab.path)) {
        continue;
      }

      if (tokens.get(tab.path) === tab.contentToken) {
        continue;
      }

      const result = diagnoseFile(tab.path, tab.content, { filePaths });
      nextByPath.set(tab.path, result);
      tokens.set(tab.path, tab.contentToken);
      changed = true;
    }

    if (!changed) {
      return;
    }

    setDiagnosticsByPath((current) => {
      const merged = new Map(Object.entries(current));
      for (const [path, list] of nextByPath) {
        merged.set(path, list);
      }
      for (const path of merged.keys()) {
        if (!openPaths.has(path)) {
          merged.delete(path);
        }
      }
      return Object.fromEntries(merged);
    });
  }, [tree, tabs, filePaths]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(runAnalysis, ANALYSIS_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [runAnalysis]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const diagnostics = useMemo(() => {
    const flattened = Object.values(diagnosticsByPath).flat();
    return sortDiagnostics(flattened);
  }, [diagnosticsByPath]);

  const activeDiagnostics = useMemo(
    () => (activePath && diagnosticsByPath[activePath]) || [],
    [activePath, diagnosticsByPath]
  );

  return {
    diagnosticsByPath,
    diagnostics,
    activeDiagnostics,
  };
}