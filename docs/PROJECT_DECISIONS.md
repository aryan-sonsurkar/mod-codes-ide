# Project Decisions — MODCODES (M144)

Structured decision records in `.modcodes#Decisions`. Added via `lib/project/decisions.js` `addDecision({decision, reason, alternatives[], evidence[], status})`.

Format:
```
### 2026-08-30 — PostgreSQL
- **Reason:** Relational model fits
- **Alternatives:** MongoDB, SQLite
- **Evidence:** Research R12, R18
- **Status:** Accepted
```

Preserves WHAT/WHY/alternatives/evidence/date/status. No hidden chain-of-thought — concise evidence only. UI can render via `listDecisions`. Meaningful decisions require Accept/Edit/Reject, never silently rewritten.
