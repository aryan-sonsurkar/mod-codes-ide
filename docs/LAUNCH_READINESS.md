# Launch Readiness — MODCODES (M93)

**Baseline:** `f8cced5` — 363 tests, 0 lint, build pass. Providers Ollama/Bonsai stub, agent orchestrator, diff/changeset, ranking, context budget/secret filtering.

## Current architecture

- **Routing/Layout:** Next.js App Router `/`, `/projects`, `/settings`; `Workspace.jsx` routes to `IdeWorkspace` or `ProjectsPage`; layout persistence `modcodes.ide.layout.v1`, workspace recovery `modcodes.ide.workspace.v2`.
- **Projects:** localStorage `modcodes-projects`; file creation/delete/rename via File System Access API; explorer with breadcrumbs.
- **Workspace/IDE:** `IDEWorkspace.jsx` ~1600 lines owns FS, tabs (`useTabs`→DocumentManager), diagnostics, layout, command palette, Monaco editor, search/replace.
- **Filesystem:** `filesystem.js` (FileSystemDirectoryHandle/File, 2 MB cap, 8 depth, skips node_modules/.git); permission checks.
- **Terminal:** `TerminalService` + `browserSimulationBackend` only (help/echo/pwd/ls); no OS shell.
- **AI:** Provider contract → Session → Context Engine (budget, ranking cache) → Tool Registry (read only) → Diff/ChangeSet → DocumentManager → Save → Filesystem; `AIPanel` ~1100 lines, `BrowserAISection`.
- **Settings/Persistence:** `settingsStorage` (editor/files/terminal/ai) + workspace + layout + conversations `modcodes.ai.conversations.v1`.
- **Error handling:** `friendlyError`, `Toast`, `ConfirmDialog`, status `requesting/cancelled/unsupported/denied/error`.
- **Responsive:** CSS grid + flex, breakpoints 768px.
- **Security:** provider-local, Browser AI local, secret `isSecretPath`, context budget, permission `read` only, no shell.

## P0 blockers

1. **No onboarding** — new user has no guidance on filesystem permission or AI setup; must be able to skip AI.
2. **Terminal is simulation only** — product claims "terminal" but cannot run system shell; need optional localhost bridge (M97) with localhost-only + pairing or must be honest fallback.
3. **Oversized orchestration** — `AIPanel`/`IDEWorkspace` too large for launch risk; needs extraction (M94).

## P1 launch issues

- Ollama/Bonsai setup not discoverable (no copyable commands, WebGPU status not explained) — M96.
- Error recovery for FS permission denied, folder cancel, save conflict, Ollama/Bonsai unavailable, bridge unavailable needs distinct retry UI — M99.
- Performance: Monaco + AIPanel load unmeasured; duplicate FS scans on refresh/project switch — M100.
- Accessibility: palette/focus/aria on dialogs already present but not audited across new AI panels — M101.

## P2 post-launch

- Multi-file diff `acceptAll` batch UX, workspace command ranking tuning, agent history persistence encryption, real modcodes-coder runtime.

## Known browser limitations

- File System Access API: Chromium (Chrome/Edge) only; Firefox/Safari show `unsupported` status + fallback to projects list only.
- WebGPU: Chrome/Edge desktop best; Firefox/Safari may show `unsupported` — Bonsai disabled, Ollama/fallback remains.
- `navigator.deviceMemory` often `undefined`; tier shown as Unknown.
- Cache Storage quota varies; large Bonsai download may hit quota → `normalizeStorageError`.

## Security risks (pre-M97)

- Simulated terminal has no OS access — safe.
- Future system bridge, if bound to 0.0.0.0 or without auth, would expose shell — M97 must bind 127.0.0.1 + random token + user approval.
- AI `execute` permission remains disabled; ensure `agentToolExecution` never calls `write`/`execute` without approval.

## Performance risks

- Unmeasured: initial load, route transition, IDE open, folder scan, Monaco init, first AI response, context ranking. M100 must measure before memoizing.
- Context ranking for 100+ files: O(n log n) 10–20 ms observed, acceptable; avoid recompute via `createContextCache`.

## UX issues

- Landing still mentions "terminal-ready architecture" without clarifying simulation vs system terminal — fix in M95/M96/M102.
- Settings AI note duplicates but lacks cache/history clear visibility — add in M95.

## Deployment requirements

- `NEXT_PUBLIC_` env none required; `next build` must pass; static assets, `robots.txt` already; no `sitemap` needed; no credentials.

## Manual QA required (M101–102)

- Chrome/Edge: filesystem picker, Monaco, Bonsai status, Ollama connect, terminal bridge connect/disconnect, multiple sessions, agent plan approve/reject, diff accept/reject, save gate, conflict, responsive, keyboard nav, reduced motion.

No feature added beyond launch-critical in M93.

