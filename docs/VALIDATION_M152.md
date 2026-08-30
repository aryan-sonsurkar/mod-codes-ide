# M152 Full Product Validation

Flows validated via unit/integration tests + manual verification (2026-08-30):

**Flow1 Idea:** New Project (idea) → ensureModcodes → Research (quick → deep incremental, dedupe, CORS/timeout handling) → PRD (evidence R12 traceable, editable) → Roadmap (M1-M5) → dev (Monaco dirty→Save) → agent (plan→approve→executing→changes→review→Save) → Git normal.

**Flow2 Existing Codebase:** New Project (codebase) → inspectCodebase (bounded, package.json/routes/tests/confidence) → plan → approve → execute (permission + ChangeSet).

**Flow3 Hybrid:** Idea+existing → inspect → research gap/risks → architecture → plan → approval → execution.

**Flow4 Continue:** Create → close → external modify (filesChanged) → reopen → reconcile (stale-memory proposal + fileCount auto) → Continue.

**Flow5 Concurrent:** agent changeset + user dirty same path → detectConcurrentEdits (path+lastModified) → Review/Keep mine/agent/Merge.

**Flow6 Research Failure:** invalid URL → inaccessible (CORS/timeout) → error not fabricated → retry works (incremental).

**Flow7 Provider Failure:** Bonsai unsupported → diagnostics, Ollama unreachable → not switched silently, user chooses.

**Flow8 Terminal:** bridge health check → 🟢 system / 🟡 simulation, never pretends.

All: `npm test` 425/60, `npm run lint` 0, `npm run build` ✓. No secret leakage, no silent destructive, no source→ads.
