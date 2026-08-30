# Project Lifecycle Orchestrator — MODCODES M153

## Purpose
Connect existing systems (.modcodes, research, PRD, roadmap, inspection, agent, testing, git, progress) into one coherent workflow: Roadmap milestone → plan → approve → execute → review → save → memory — without new automation taking control from the student.

## Architecture
```
Project Lifecycle (orchestrator)
  ├─ Project Memory (.modcodes frontmatter + Markdown, service.js)
  ├─ Roadmap (roadmap.js, RoadmapWorkspace)
  ├─ Project Inspection (inspect.js, bounded)
  ├─ Agent (agentOrchestrator.js, planner, ToolRegistry, permission)
  ├─ ChangeSet / Diff / Save Gate (existing)
  ├─ Git safety (git/safety.js, read-only)
  └─ Progress (proposed memory update)
```
Lifecycle is orchestration above agent; agent is execution engine.

## Lifecycle States (project workflow, not agent duplicate)
`idle → preparing → inspecting → contextReady → planning → awaitingApproval → executing → validation → review → completed` + `cancelled/failed/blocked`. Distinct from `ORCHESTRATOR_STATES` (agent: idle/planning/awaitingApproval/executing/awaitingReview/completed).

## Relationship Lifecycle ↔ Agent
Lifecycle subscribes to `agentOrchestrator.subscribe` (no polling). Mapping: lifecycle `awaitingApproval` mirrors agent `awaitingApproval`; `executing` mirrors agent `executing/observing`; `review` when agent `changesProposed/awaitingReview` (prepares `proposedMemoryUpdate`); `completed` only via `lifecycle.complete()` after review+save. Agent lifecycle drives lifecycle transitions.

## Milestone Execution Flow
`load project memory → validate milestone exists → inspect (inspectCodebase) → assemble context (modcodes phase/PRD/arch/decisions/inspection) → agentOrchestrator.startTask({title, description, context}) → planner creates plan → awaitingApproval → user approvePlan() → agent executing → observations/changeset → validation/review → user review → Save Gate (dirty→Save) → proposed memory update (Progress) → Accept/Edit/Reject → complete`.

## Approval Boundaries
Approval mandatory: `milestone → plan → awaitingApproval → approvePlan() → execute`. Lifecycle `approvePlan()` throws if not `awaitingApproval`. No auto-execute.

## ChangeSet / Save Boundaries
Correct: `Agent → ChangeSet → Review → Save Gate → Filesystem`. Lifecycle never calls `filesystem.writeFile` — only `proposeChangeset` and `proposedMemoryUpdate` (requires Accept/Edit/Reject). Tests verify no `ads` dep and no direct write.

## Project-Memory Update Boundaries
After `review`, lifecycle prepares `{section:"Progress", append:"- M2 ready_for_review", requires:["Accept","Edit","Reject"]}`. Meaningful `decisions/architecture/intent/research/PRD` never silently rewritten. Minor factual metadata auto, meaningful via proposal.

## Error Handling
`Milestone not found → failed "return to roadmap"`, `memory unavailable → blocked`, `inspection failed → failed "retry"`, `planner failed → failed "retry/cancel"`, `agent failed → failed (preserve changes)`, `cancelled → preserve recoverable state`, never generic "Something went wrong" without details.

## Future Extension Points
M154 context intelligence (ranked context adapter), M155 milestone completion detection, M156 verification, M157 auto memory, M158 testing, M159+ UX — all plug via `startMilestone` context/inspection hooks without changing lifecycle core.

## Security
No `filesystem.writeFile` bypass, no `permission` bypass, no `ChangeSet/Save Gate` bypass, no arbitrary terminal, no Git auto-commit/push, no secret exposure, no `AdService` import (verified). Performance: reuses `workspaceGraph`/`inspection`/`relevanceRanking`, no polling, no Monaco remount.
