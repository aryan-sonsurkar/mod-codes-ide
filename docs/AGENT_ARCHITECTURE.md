# Agent Architecture (M75 — design only)

Status: Contracts defined. No autonomous loop is executed.

## Flow

```
User
 ↓
Agent Session (task + steps + cancellation)
 ↓
Planner (produces Plan = Step[])
 ↓
Context (ranked, budget-aware, secret-filtered)
 ↓
Tool Registry (permission check)
 ↓
Execution (bounded, observable)
 ↓
Observation (tool result / diff)
 ↓
Next step or Approval or Completion
```

The agent is bounded and user-controlled, not "AI can execute anything."

## Concepts

- **Task** — user goal, e.g. "Add authentication". States: idle → planning → awaitingApproval → executing → observing → completed/failed/cancelled.
- **Plan** — ordered `Step[]`. Each step has `title`, `reason`, `expectedTools`, `expectedFiles`, `risk`, `approvalRequirement`.
- **Step** — pending → running → waitingApproval → completed/failed/rejected/cancelled.
- **ToolCall** — `{toolName, arguments}` via registry, validated.
- **ToolResult** — `{ok, content}` observable.
- **Observation** — tool result or file diff.
- **ChangeSet** — proposed file operations (modify/create/delete/rename) with status pending/approved/rejected/applied/saved/failed. See `changeset.js`.
- **Approval** — explicit user gate before write/destructive/planning.
- **Completion / Failure / Cancellation** — terminal states.

## Bounds

- `maxSteps` 10, `maxToolRounds` 2–4, `context budget` from model window, `timeout` per tool/plan, `cancellation` via AbortSignal, `permission` via registry. No step executes without Approval if it would write outside bounds.

## Data model (M76)

See `src/app/lib/ai/agentTask.js`: `createAgentTask`, `createAgentStep`, `createAgentSession({task})` with `start/addStep/updateStep/setState/complete/fail/cancel/serialize/getTask`.

No arbitrary tool execution; this is state architecture.

## Plan preview (M77)

`AgentPlanPreview` shows Step, Reason, Expected tools/files, Risk, Approval requirement with Approve/Reject/Edit. Planning only; no automatic execution.

## Safety

- Agent never bypasses `Tool Registry` or `DocumentManager`.
- No `execute` permission is auto-granted.
- Changes remain as `ChangeSet`/`Diff` until Accept → dirty → Save.
- Cancellation propagates to every step and to the provider signal.
- Secrets, handles, and raw prompts are not persisted beyond the sanitized action history.

This architecture satisfies the 10 critical questions in M82 without implementing the loop.

