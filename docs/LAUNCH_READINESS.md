# Launch Readiness — MODCODES v0.2.0

**Current:** tag `v0.2.0` — 1100 unit tests (94 files) · 176 Playwright e2e
tests · ESLint 0 errors · production build clean · CI on every push.

> This document supersedes the M93-era baseline (363 tests, stub providers).
> Items below reflect the release candidate as verified against
`docs/RELEASE_CHECKLIST.md`.

## Current architecture

- **Routing/Layout:** Next.js App Router `/`, `/projects`, `/settings`;
  `Workspace.jsx` routes to `IdeWorkspace` or `ProjectsPage`; layout
  persistence `modcodes.ide.layout.v1`, workspace recovery
  `modcodes.ide.workspace.v2`.
- **Projects:** localStorage `modcodes-projects`; disk projects via File
  System Access API, browser-storage projects via `virtualFS` (localStorage,
  2 MB/file cap); onboarding overlay on first run.
- **Workspace/IDE:** `IDEWorkspace.jsx` (~2360 lines) owns FS, tabs
  (`useTabs`), diagnostics, layout, command palette, search/replace,
  checkpoints, run queue, ZIP import/export.
- **Filesystem:** facade over disk (`filesystem.js`) + browser storage
  (`virtualFS.js`); both prefix tree paths with the workspace root name;
  skips `node_modules`/`.git`; permission checks on every write.
- **Terminal:** `TerminalService` with browser simulation backend by
  default; optional localhost bridge (`tools/modcodes-bridge`,
  127.0.0.1 + pairing token) for a real system shell.
- **AI:** providers Ollama (local) + Bonsai (WebGPU, in-browser) → session →
  context engine (budget, ranking, secret filtering) → tool registry
  (read + approval-gated write) → verification receipts → changeset → save.
  `AIPanel.jsx` (~1760 lines) plus extracted `AgentProgress`,
  `AIToolApproval`, `AITaskMeter`, `AIActionHistory`.
- **Trust layer (v0.2.0):** session checkpoints appended to `.modcodes`
  Agent History; verification receipts required before agent Accept;
  protected-path classification (env/manifest/database/migration/memory/git)
  forces typed-confirmation approval; honest per-turn task meter with CSV
  export; honest offline agent scoping; zip-slip-guarded workspace
  ZIP export/import.
- **Settings/Persistence:** `settingsStorage` + workspace + layout +
  conversations `modcodes.ai.conversations.v1`; usage in
  `modcodes-usage` / `modcodes-usage-session`.
- **Error handling:** `friendlyError`, Toast, ConfirmDialog, distinct
  folder-status messages (requesting/cancelled/unsupported/denied/error),
  error boundary with recovery UI (e2e-covered).
- **Security:** local-only providers, secret-path filtering, context
  budget, security headers in `next.config.mjs`, CSP documented as deferred
  (Monaco `eval()`), no hardcoded secrets (scanner-verified), health endpoint
  falls back to `package.json` version on hosted runtimes.

## Resolved since M93

1. **Onboarding** — overlay with skip on first run (unit + e2e covered).
2. **Terminal honesty** — browser simulation labeled as such; optional
   localhost-only bridge with pairing token ships under `tools/`.
3. **Provider stubs** — Ollama and Bonsai are real implementations with
   status states, model management, and offline fallback copy.
4. **Ad posture** — ad-free by default; consent-gated AdSense infrastructure
   exists but is intentionally unconfigured at launch.

## Remaining risks (accepted for v0.2.0)

- **Component size** — `AIPanel` (~1760) and `IDEWorkspace` (~2360) remain
  large; extraction is worthwhile before major feature work resumes.
- **Browser support** — File System Access API is Chromium-only; Firefox and
  Safari get browser-storage projects (fallback path is e2e-covered).
- **WebGPU** — Bonsai requires Chrome/Edge desktop best case; elsewhere the
  app guides users to Ollama or stays honest about unavailability.
- **No admin dashboard** — observability logger ships, but error-rate
  monitoring is manual (host logs) for v0.2.0.
- **Domain** — `modcodes.dev` pending DNS; production is
  `modcode.vercel.app` (metadata, robots, sitemap all point there).

## Known browser limitations

- File System Access API: Chromium only; others show `unsupported` status
  and fall back to browser-storage projects.
- WebGPU: Chrome/Edge desktop preferred; Bonsai disabled gracefully.
- `navigator.deviceMemory` often `undefined`; tier shows as Unknown.
- Cache Storage quota varies; large Bonsai download may hit quota →
  `normalizeStorageError`.

## Performance

- Context ranking for 100+ files: O(n log n), cached via
  `createContextCache`; usage log capped (500 persisted / 1000 memory);
  service worker precaches the app shell (54 assets).
- Not yet instrumented in production: first AI response latency, Monaco
  init, IDE open time. Worth measuring before memoizing further.

## Manual QA before any release

- Chrome/Edge: folder picker, browser-storage project, Monaco, Bonsai
  status, Ollama connect, bridge connect/disconnect, agent plan
  approve/reject, verification run, protected-file typed approval, ZIP
  export/import, conflict dialog, responsive breakpoints, keyboard nav,
  reduced motion.
- Firefox/Safari: browser-storage fallback path, graceful AI degradation.

## Deployment

- `next build` must pass; no required `NEXT_PUBLIC_` env vars; no
  credentials in the repo. Vercel auto-deploys on push to `main`;
  verify `/api/health` reports `version: 0.1.0` after deploy.
