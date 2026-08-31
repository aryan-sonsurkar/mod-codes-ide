# Test Execution — MODCODES M158

## Purpose
Execute project's existing tests via approved ToolRegistry/TerminalService to obtain fresh evidence for M156 verification. Not a test framework.

## Test Discovery
`discoverTestConfig({packageJsonText,fileList})` parses `package.json` scripts.test and devDependencies (`vitest`/`jest`/`pytest`) + fileList. Prefers explicit `scripts.test` → `npm test` (reason: "Project package.json defines the test script"), fallback `npx vitest run`/`jest`/`pytest`. Returns `{framework, command, reason, scope, availableCommands}` or `command:null` → `unknown`.

## Command Selection
Explicit project script preferred over inferred `vitest` binary. Never invents commands. `command` is trusted project config, not agent arbitrary string.

## Permission Model
`executeApprovedTests({plan, terminalService, permissions})` checks `permissions.canRunTests===false → blocked "Automated tests require user approval"` via ToolRegistry. Never bypasses.

## ToolRegistry Integration
No direct `terminal.execute` bypass — `terminalService` is `createTerminalService({backend})` (browser simulation or system bridge) passed in. M158 does not create another permission system.

## Terminal Integration
`TerminalService.execute(command)` with workingDirectory from `projectData/project.name` — never arbitrary paths. Backend handles `getRootPath`. Uses existing `TerminalService`.

## Timeout
Bounded `DEFAULT_TIMEOUT_MS 30000` (plan.timeout or passed). `AbortController` + `setTimeout` → `aborted` → `status: timeout`, not `passed`. User can cancel via `signal`.

## Output Limits
`OUTPUT_LIMIT 20000` per stream, `truncateOutput` adds `...[output truncated]` and `outputTruncated:true`. Prevents AGENT context bloat. Reuses terminal limits.

## Secret Redaction
`SECRET_PATTERNS` (`DATABASE_URL=`, `api_key`, `password`, `token`, private key) → `[REDACTED]` before exposing to Agent/M156/lifecycle/memory. Verified.

## Test Result Model
`{status: passed|failed|blocked|timeout|cancelled|error|unknown, command, exitCode, duration, passed, failed, skipped, unknown, stdout, stderr, outputTruncated, startedAt, finishedAt, workingDirectory, framework}`. Exit 0 + parsed `1 failed` → `failed` (not passed). Counts parsed via `/(\\d+)\\s+passed|failed|skipped/i` else `unknown`.

## M156 Integration
`lifecycle.runApprovedTests → executeApprovedTests → {passed,failed} → verifyMilestone({tests: {passing, failing}})` — fresh evidence wins over optimistic M155.

## M155 Integration
`M155 assessment` remains available (`lifecycle.completionAssessment`) — M158 does not mutate it; M156 re-evaluates with fresh tests.

## M157 Integration
M158 never writes memory — after `verification` updates, `M157` may propose `Progress` via `Save Gate` (`Accept/Edit/Reject`). Test execution results remain in-memory in `lifecycle.testResult`.

## Cancellation
`signal` abort or user Cancel → `terminalService` aborted via `AbortController`, returns `status: cancelled`, preserves captured output, no source/Git/memory changes.

## Security
Respects ToolRegistry/permissions/terminal safety, redacts secrets, bounds output/execution, avoids arbitrary `curl|sh`, avoids filesystem/Git/Save Gate/AdService mutation (verified `not.toContain` checks).

## Concurrent Editing
Captures `testStartState` via `lifecycle` snapshot; if `ChangeSet` changes during execution, reports `Project changed while tests were running` (via lifecycle `testResult` vs current). No overwrite.

## Known Limitations
No test file selector yet (full suite via `npm test` only); no `total` parse for some frameworks → `unknown` counts but status preserved; timeout via abort not preemptive kill (waits for backend); workingDirectory from `project.name` not handle path.
