# Milestone Completion Detection — MODCODES M155

## Purpose
Structured assessment `What appears to be complete?` — not verification. M155 reads existing evidence, reports status/confidence/blockers for user review. M156 will verify.

## M155 vs M156
- M155: assessment based on available evidence (tasks, criteria, changeset, tests, PRD, inspection, Git, agent state) → `likely_complete/needs_review`
- M156: stronger verification (test execution, manual acceptance, explicit `complete`)

## Assessment Model
`detectMilestoneCompletion({milestone, projectData, changeset, tests, inspection, gitState, agentState}) → {status, confidence, tasks[], criteria[], requirements[], blockers[], evidence[], summary, completed, total}`
Each `tasks[i]`/`criteria[i]` → `{id, description, status: supported/missing, reason, evidence}`. `requirements` from PRD `FR-*` trace.

## Status Definitions
- `not_started` — no meaningful progress, no changeset
- `in_progress` — some tasks supported, some missing
- `blocked` — concrete blocker (test_failure, git_conflict, destructive, cancelled, agent_failure)
- `needs_review` — substantially complete but missing evidence (e.g. session expiry criterion no test)
- `likely_complete` — available evidence supports completion (no blockers, all tasks/criteria supported)
- `complete` — only if `milestone.status === "complete"` explicitly accepted
- `unknown` — zero tasks/criteria, empty project

## Evidence Model
Sources: roadmap task, criterion, PRD requirement, changed path, test result, inspection, Git, agent result. Reuses `changedPaths(changeset)` handling `operations/changes` shapes. No hidden chain-of-thought — concise `reason`.

## Task Evaluation
`taskSupported(task, paths, progressText)` — keyword overlap (≥4 chars) vs changed paths or `Progress` mentions or manual user edits (progress text). Manual work counted (user may complete 2/5 tasks outside agent). Agent claim is evidence, not truth.

## Criterion Evaluation
Each `milestone.criteria` (string or array) → `{supported/missing}`. `supported` if path/test supports; `missing` e.g. `sessions expire correctly` with no session file/test → needs_review. Evidence `["changeset"]` or `[]`.

## PRD Relationships
Parses `PRD` `FR-*` lines, maps to milestone goal keyword → `partially_supported`. Read-only, never modifies PRD.

## Test Signals
`tests: {passing, failing, missing, total, failed}` — `failing>0 → blocker`, `missing → needs_review`, `passing` → positive, unknown → neutral. Does not run tests (no new runner, respects permission).

## Git Signals
`gitState: {clean, conflict, hasUncommitted, destructive}` — `conflict/destructive → blocker`, `hasUncommitted+overlap → needs_review`, clean → positive. No commit/push/reset.

## Blockers
Structured `{type, description, evidence}` — `test_failure`, `git_conflict`, `destructive`, `cancelled`, `agent_failure`, `missing_file/dependency/criterion`. Never vague.

## Confidence
Numeric 0-1 assessment signal (not proof): `complete 0.95, likely_complete 0.88, needs_review 0.82, in_progress 0.55-0.6, blocked 0.3, not_started 0.1, unknown 0.2`. Documented as likely accurate, not proven.

## User Control
Never auto-marks complete, never modifies `.modcodes/roadmap/PRD`, never Git commit/push. Shows `Milestone assessment [Review]` — user decides. `proposedMemoryUpdate` requires `Accept/Edit/Reject`.

## Lifecycle Integration
`lifecycle: review` exposes `completionAssessment` in `getSnapshot()` after `agent → changesProposed/awaitingReview → validation → review`. Snapshot: `{state:"review", changeset, completionAssessment}`. Roadmap/Agent workspaces render `status, 6/7, blocker, View Assessment`.

## Known Limitations
Deterministic heuristics (keyword overlap) — not semantic; single `criteria` string treated as one criterion; no test runner; PRD mapping keyword-based; manual user edits inferred via `Progress` text.

