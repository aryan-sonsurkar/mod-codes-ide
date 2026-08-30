# Project Memory Updates — MODCODES M157

## Purpose
Controlled mechanism for updating `.modcodes` after verified work — AI proposes, user Accept/Edit/Reject, Save Gate persists.

## Memory Ownership
`M157 owns: generating proposals, classifying, diffs, Accept/Edit/Reject, validation, Save Gate routing. Does NOT own filesystem raw, lifecycle, verification, Git.`

## Proposal Model
`{id, section, operation: append|update|remove, before, after, reason, evidence[≤5], requires:[Accept,Edit,Reject], status: pending|accepted|edited|rejected|saved|failed, createdAt, milestoneId, beforeHash}` — `createMemoryProposal` / `createProgressProposal`.

## Accept/Edit/Reject
- Accept: pending → accepted → validation → Save Gate → saved
- Edit: pending → edited (newAfter validated, secret-checked) → Save Gate
- Reject: pending → rejected (non-persistent, disappears)
- Invalid transitions throw.

## Save Gate
Only path: `Proposal → Accept/Edit → validateProposal → detectConcurrentModification → setSection → saveModcodes({rootName,data}) → .modcodes`. Never `filesystem.writeFile` directly (verified: no `writeFile` in `memoryProposal.js`).

## Evidence
`reason: "Milestone M2 verified"`, `evidence: ["auth.test.ts","verification:M2"]` — traceable to verification criteria.

## Verification Relationship
Only when `verification.status==="verified"` → propose `Progress: - M2 verified`; `failed → "verification failed"`, `partially_verified → "5/7 passed"`, `blocked → "blocked"`, `unknown → no proposal (avoid noise)`. `likely_complete` does NOT auto-become verified.

## Progress Updates
Primary target `Progress`. Example before `- M1 setup`, after `... + "- M2 verified (2026-08-30)"`. Duplicate detection: if `Progress` already contains `M2 ... verified`, `createProgressProposal` returns `null` (idempotent).

## Stale Memory
If `Progress` says `M2 incomplete` but verification says `verified`, proposal updates `incomplete → verified` with reason `Current project verification contradicts existing Progress`.

## Concurrency
`detectConcurrentModification(proposal, currentProjectData)` compares `proposal.before` vs current `getSection` — if changed since proposal → `Project memory changed — Review/Rebase/Cancel`, no blind overwrite. Reuses `concurrent` concept.

## Secret Protection
`SECRET_VALUE_PATTERNS` (`DATABASE_URL=`, `api_key`, `password`, `BEGIN PRIVATE KEY`) — `containsSecretValue(after)` → `validateProposal` fails, `editProposal` throws, never persisted. `.env` not in `memoryProposal.js`.

## Security
No `AdService` import, no project memory → ads, no `commit/push/terminal`, respects `Save Gate`/`ChangeSet`/`Git safety`. Read-only until Accept/Edit.

## Lifecycle Integration
`lifecycle: review` exposes `memoryProposal` alongside `completionAssessment/verification` in `getSnapshot()`. Flow: `Agent changesProposed → assessment → verification → memoryProposal (pending) → user Accept/Edit/Reject → Save Gate → .modcodes`. `lifecycle.acceptMemoryProposal/edit/reject` methods delegate to `memoryProposal` helpers.

## Error Handling
Malformed `.modcodes` → `validateProposal` fails `invalid section`; missing `.modcodes` → `missing projectData`; invalid section/secret → rejected; concurrent → `concurrent`; save failure → `failed` preserved for retry; duplicate → `null`; verification unavailable → no proposal.

## Known Limitations
Only `Progress` auto-proposed; Decisions/Architecture require explicit evidence; Research/PRD not auto-rewritten; no auto Git commit/push; proposal in-memory until saved.

**AI never silently writes project memory — developer remains authoritative.**
