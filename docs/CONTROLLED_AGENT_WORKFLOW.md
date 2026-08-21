# Controlled Agent Workflow (M83–M92)

Status: Implemented and observable. No silent filesystem modification.

## End-to-end flow

```
User: "Find the bug in this project and fix it."
  ↓
Context (ranked top 8–12 files, budgetForModel, secret-filtered, cached)
  ↓
AgentOrchestrator.startTask() → planning
  ↓
Planner (createPlanner) → AgentPlan (steps with title/reason/expectedTools/Files/risk/requiresApproval)
  ↓
AgentPlanPreview → User approves / rejects
  ↓
Approved → executing → Bounded tool execution (read-only via Tool Registry → Permission check)
  ↓
Observation (tool, args, result, status, durationMs, step, concise summary)
  ↓
Agent proposes ChangeSet (agentObservationsToChangeset) + MultiFileDiffSession
  ↓
AI Change Review (summary, additions/deletions, deterministic risk: destructive/large/config/dependency/multiple-files, file tabs Pending/Accepted/Rejected, Open/Go to line)
  ↓
User Accept file / Accept all / Reject / Cancel
  ↓
DocumentManager.setContent (dirty, never filesystem.writeFile directly)
  ↓
Save → Filesystem (File System Access API, existing conflict protection)
```

## Orchestrator states

`idle → planning → planReady → awaitingApproval → approved → executing → observing → changesProposed → awaitingReview → completed / cancelled / failed`

Bounds: `maxSteps 10`, `maxToolRounds 4`, `contextBudget` from model window, `timeoutMs 30000`, `cancellation` via AbortSignal, `permission` via registry.

## Safety gates

- Planner only proposes, never executes.
- Tool execution only `read` via `registry.executeToolCall`; `write/delete/execute` remain approval-gated.
- ChangeSet/diff proposals never touch `filesystem.writeFile`; only `DocumentManager`.
- Dirty documents warn on close (existing save protection).
- Cancellation propagates to planner, tools, and session.
- Secrets filtered, context bounded, no telemetry/cloud/auth/db.

## UI states for the demo

Planning → Waiting for approval → Executing → Observing → Changes ready → Reviewing → Applying → Saving → Completed/Cancelled/Failed — all driven by `AgentWorkflowDemo` using the same orchestrator.

## Manual verification (M91–92)

Chrome/Edge: Open project → AI panel → Start task → Plan appears → Reject works → Approve → read tools execute → activity visible → cancel works → changeset appears → diff review → Reject/Accept → dirty → Save → filesystem updates → conflict protection.

