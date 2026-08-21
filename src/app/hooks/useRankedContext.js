"use client";
import { useMemo } from "react";
import { rankWorkspaceContext } from "../lib/ai/relevanceRanking";
import { createContextCache } from "../lib/ai/contextPerformance";
import { clampBudget } from "../lib/ai/context/budget";

const globalCache = createContextCache({ ttlMs: 2000 });

export function useRankedContext({
  candidates = [],
  currentFile = null,
  selection = null,
  activePath = null,
  diagnostics = [],
  graphNeighbors = [],
  recentPaths = [],
  searchMatches = [],
  budget,
  settingsBudget,
} = {}) {
  const effectiveBudget = budget ?? clampBudget(settingsBudget);

  return useMemo(() => {
    const cacheKey = {
      currentFile,
      selection,
      budget: effectiveBudget,
      activePath,
      candidates: candidates.map((c) => c.path).join(","),
    };
    const cached = globalCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const ranked = rankWorkspaceContext({
      candidates,
      currentFile,
      selection,
      activePath,
      diagnostics,
      graphNeighbors,
      recentPaths,
      searchMatches,
      budget: effectiveBudget,
    });
    globalCache.set(cacheKey, ranked);
    return ranked;
  }, [candidates, currentFile, selection, activePath, diagnostics, graphNeighbors, recentPaths, searchMatches, effectiveBudget]);
}
