# Milestone Verification — MODCODES M156

## Purpose
Convert M155 assessment (`appears complete`) into evidence-backed verification (`can we verify`). Flow: `Milestone → M155 assessment → M156 verification → acceptance criteria → evidence → result → user review`. Never auto-marks complete.

## M155 vs M156
- M155: heuristic assessment (keyword/path, `likely_complete/needs_review`) — fast, read-only.
- M156: criterion-by-criterion verification against hierarchy (passing test > executable > structured > implementation > inspection > agent claim) — evidence-based, `verified/failed/blocked/partially_verified/unknown`.

## Verification Lifecycle
`verifyMilestone({milestone, assessment, projectData, inspection, tests, gitState, changeset, permissions}) → {status, criteria, requirements, evidence, blockers, verified, passed, failed, unknown, blocked}`. Called by `lifecycle` after `agent → changesProposed → review` → `completionAssessment` + `verification` exposed in `lifecycle.getSnapshot()` (`validation→review`).

## Verification Statuses
- `verified` — all applicable criteria `passed`
- `failed` — any criterion `failed` (e.g. test expected 401 got 200)
- `blocked` — concrete blocker (Git conflict, test failure, permission)
- `partially_verified` — some `passed`, some `unknown`
- `unknown` — insufficient evidence (no criteria, no test, implementation alone)

Not using `confidence` — verification is evidence, not probability.

## Evidence Hierarchy (strongest first)
1. Passing automated test, 2. Direct executable verification, 3. Structured project evidence, 4. Implementation evidence, 5. Inspection, 6. Agent claim, 7. Keyword/path inference. `session.ts exists` ≠ `session expiry works` — implementation alone → `unknown`.

## Criterion Verification
Per `milestone.criteria` (string or array) → `{id, description, status: passed/failed/blocked/unknown/not_applicable, evidence:[{source,path,test,output,description}], reason, provenance:{criterionId, source}}`. `passed` requires passing test + implementation; `failed` from failing test; `unknown` when no executable evidence.

## Test Verification
Uses existing `tests: {passing,failing,missing,total}` — respects `permissions.canRunTests`. If blocked, returns `blocked: "Automated tests require user approval"` — never silently executes arbitrary commands via `ToolRegistry`. Auto-fix prohibited — reports `failed`, not `Fixing...`.

## Permission Model
`permissions.canRunTests` gate; if false and tests unavailable → `blocked`. Never bypass `ToolRegistry` permission, never direct `terminal` execution.

## Contradictory Evidence
If test `PASS` but inspection `missing dependency` — do not silently choose; keep `passed` but surface inspection risk via `blockers` or `needs_review` via assessment. Hierarchy prefers stronger evidence but flags conflict.

## Unknown States
`unknown` when no criteria, no tests, blocked permissions, empty project, no changeset — returns `"No explicit acceptance criteria available"`.

## Security
Read-only: never `writeFile/.modcodes/PRD/roadmap`, never `commit/push/reset`, never `AdService` import (verified), never secret exposure, respects `Save Gate`/`ChangeSet`/`Git safety`. Verification results in-memory until M157 approved persistence.

## Lifecycle Integration
`lifecycle: review` exposes `{completionAssessment, verification}` — `RoadmapWorkspace` shows `Verification: partially_verified 5/7` + `[Verify][View Results]`, `AgentWorkspace` shows `✓5 ✗1 ?1`. Extend existing `validation/review` states, no new state machine.

## User Approval
Verification may require execution — user must approve per permission. Verification never modifies source.

## Known Limitations
No test runner invoked (uses provided `tests` evidence); no PRD auto-mutation; single verification run per assessment; unknown criteria remain unknown until test exists; contradictory evidence not auto-resolved.
