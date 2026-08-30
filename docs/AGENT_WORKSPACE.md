# Agent Workspace — MODCODES

Uses existing controlled agent (`agentOrchestrator`, `agentPlanner`, `ToolRegistry`, `permission`, `ChangeSet`, `DiffEngine`, `Save Gate`).

User → understand context → create plan → **user approval** → execute approved plan → observe → propose changes → review → dirty → Save → filesystem.

Workspace shows Task/Plan/Progress/Current step/Files/Tool activity/Observations/Tests/Errors/Changes/Git + controls Pause/Resume/Cancel/Review. IDE remains usable while agent works. Concurrent edits detected via `lib/project/concurrent.js` — show Review/Keep mine/agent/Merge, prefer user. No auto-push, no silent writes, budget/timeout/cancellation boundaries.
