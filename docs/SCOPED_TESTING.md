# Scoped Testing — MODCODES M159

## Why scoped testing exists
Run smallest safe useful test scope instead of full suite every milestone — faster, bounded, evidence-precise, without weakening verification.

## Test scope model
`{scope: full|file|related|unknown, sourceFiles: [changed], testFiles: [selected], reason, evidence, framework, command, timeout, requiresApproval}` — `full` when no safe mapping, `file` single, `related` multiple, `unknown` when no test infra.

## Source → test mapping
Deterministic ranking via:
1. exact filename `login.ts → login.test.ts`
2. directory relationship
3. naming `.test.ts/.spec.ts`
4. imports (`test imports src`)
5. workspaceGraph edges
6. Context Intelligence relevant test candidate
Uses `mapSourceFilesToTests` reusing `workspaceGraph` + `fileContents` import check — not substring-only.

## Workspace graph integration
Graph edges `test → src` boost mapping via `graph.edges.some(e=>e.from===test && e.to===src)`. Reuses cached graph.

## Context Intelligence integration
M154 relevant test candidate feeds `testFiles` selection; M159 consumes `ChangeSet` sourceFiles + M154 ranking to propose scope.

## Safe selector detection
`isScopedSelectorSafe(framework, testFiles)` — supports `vitest`/`jest` (`npx vitest run <files>`), rejects unknown or `integration/e2e` files (unsafe to isolate) → fallback `full`.

## Full suite fallback
When no reliable mapping, ambiguous, integration detected, or framework unsupported → `scope: full`, `reason: Unable to establish safe file-scoped test set` — preferable to false confidence.

## Permission model
Scoped execution uses same `ToolRegistry`/`permissions.canRunTests` + `TerminalService` + `isCommandSafe` (blocks `rm -rf`, `git push`, `curl|sh`). `requiresApproval: true` — never bypass.

## Approval flow
Testing card shows `Detected: Vitest — Scope: 2 related tests — Changed: 2 files — Tests: 2 files — Reason: Tests directly import changed files — Command: npx vitest run … [Approve & Run] [Run Full Suite]` — never hidden.

## Test evidence
`TestResult` retains `scope`, `testFiles`, `sourceFiles`, `evidence`, `command`, `framework`, `outputTruncated`, `startedAt`, `duration`, `exitCode`, `passed/failed`. M156 consumes `tests: {passing, failing}` + `scope` to avoid overclaim (`partially_verified` if only subset).

## M156 integration
`M159 → TestResult → M156 verifyMilestone({tests})` — scoped `1 passed` does NOT imply `verified` for 3-criteria milestone → `partially_verified`. Full suite `scope: full` provides broader evidence.

## Concurrent editing
Captures `testStartPaths` vs `testEndPaths` from `ChangeSet`; if changed during run → `stale:true`, needs reverification. No overwrite. Cache key `command|scope|testFiles|framework`; duplicate execution avoided via `getCachedTestResult` / `setCachedTestResult`, invalidated when sourceFiles changed.

## Cache invalidation
`clearTestCache()` on demand; `cacheKey` includes `testFiles` and `sourceFiles` hash — stale after relevant source changes.

## Security
No `writeFile`/`commit/push`, no `AdService` import, redacts secrets (`DATABASE_URL=[REDACTED]`), bounds output/timeout, no arbitrary commands, respects `Save Gate`/`Git safety`.

## Known limitations
First impl supports Vitest/Jest (`npx vitest run`/`jest`); Pytest scaffolded but not fully tested; integration tests fallback to full; no per-test selector beyond file list; cache in-memory only.

**Scoped testing is optimization and evidence-selection — does NOT reduce verification standard.**
