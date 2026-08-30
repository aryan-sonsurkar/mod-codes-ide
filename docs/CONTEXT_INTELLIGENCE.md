# Context Intelligence — MODCODES M154

## Purpose
Provide high-relevance, low-noise, bounded, explainable, safe initial context for `M2 Authentication` (and any milestone) — not entire project.

## Architecture
Single module `lib/ai/contextIntelligence.js` reusing:
- `relevanceRanking.rankWorkspaceContext` (file ranking, dependency awareness)
- `workspaceGraph.buildWorkspaceGraph` (imports, graphNeighbors)
- `context/secrets.isSecretPath` (security)
- `context/budget.buildBudget` + `rankWorkspaceContext` budget
- `project/inspect.js` (projectOverview, techStack)
- `codeIntelligence/analyzer` (where needed)

No `ContextRankingV2` — extends existing.

```
Milestone/Task → ContextRequest → discoverCandidates → filter (secret/skipped/large) → rank (deterministic) → budget (maxFiles 14, maxBytes 24k) → ContextSelection → Planner
```

## Candidate Sources (bounded, MAX_CANDIDATES 50)
- `.modcodes` sections: PRD requirements (FR-*), research evidence, decisions, architecture, constraints
- Workspace files via `collectFiles` (tree walk, SKIPPED_DIRS, MAX_FILE_SIZE 50k, isSecretPath)
- Tests (`*.test.*`, `__tests__`)
- Inspection summary, dependencies, graph edges
- Diagnostics/recentPaths/searchMatches when provided

## Relevance Strategy
- Files: `rankWorkspaceContext` scores (currentFile 100, selection 90, imported 70, importer 50, graphNeighbor 40, diagnostic 30, sameDir 20, search 15, recent 10) + task token substring boost 40 + milestone 15 + test boost 25. Deterministic sort by score/priority.
- PRD/research/decision/architecture: keyword overlap (`direct task match` 30, `milestone` 20, `PRD/research/decision/architecture relationship` 10-15, dependency mention 15).
- Dependency awareness via `workspaceGraph` edges — `importedFiles/importers/graphNeighbors` fed to ranking, `candidateMentionsGraph` for non-files.

## Context Budgets
Default 24k chars (≈6k tokens), min 2k max 200k, `maxFiles 14`, `maxCandidates 50`, `maxResearch 4`, `maxDecisions 3`, `maxPRD 5`. Rank first, then truncate low-value; `budget: {total, used, remaining, maxFiles, candidates, excluded}`.

## Provenance
Each selected item: `{source: project-file|prd|research|decision|architecture|test|constraint, path/requirement/sessionId/decisionId, section}`. Auditable via `selection.provenance[]`.

## Explainability
`reason` per item: e.g. `graph neighbor, task match`, `direct task match, milestone relationship`. Selected/excluded both carry `reason + "; budget exceeded"` when truncated. UI shows `Why included` / `Why excluded`.

## Security Filtering
Never includes `.env`/`.env.*/.pem/.key/credentials/id_rsa` (via `isSecretPath`), skipped dirs, large files (>50k). Exposes safe metadata (`DATABASE_URL is required`) not values. Never leaks to logs/ads. No AdService import (verified).

## Integration with M153
`lifecycle.startMilestone` → `inspectCodebase` → `createContextRequest({task, milestone, project, phase, budget})` → `selectContext(request, {projectData,tree,fileContents})` → `contextSelection` stored in lifecycle snapshot → passed as `context: {milestone, contextSelection, prd/arch/decisions/evidence}` to `agentOrchestrator.startTask`. Lifecycle state `contextReady` before `planning`.

## Agent Investigation
M154 gives initial relevant context only. Agent may still call approved tools (`ide.current-file`, `ide.search`, etc.) to read additional files — not predicted, not omniscient.

## Performance
Cheap per milestone: reuses cached `workspaceGraph` (file list), `inspection`, parsed `.modcodes`; no full rescan, no duplicate graph, no network, no AI calls for ranking, no sync expensive work, `useMemo` in lifecycle.

## Future Extensions
Tunable budgets per model (`budgetForModel`), richer PRD ID parsing, research session ranking, decision recency weighting.
