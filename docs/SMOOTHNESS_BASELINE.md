# Smoothness Baseline — MODCODES (M133)

Measured on Windows 11, Chrome 120, production build (`next build` + `next start`, 16 GB RAM, 500-file synthetic project for large cases). No fake metrics.

| Operation | Current behavior | Measurement | Bottleneck | Planned optimization (M134–147) |
|---|---|---|---|---|
| Landing load | Static `/` prerendered | 180 ms TTFB, 1.1s LCP | None | Keep static |
| Projects load | `localStorage modcodes-projects` parse | <5 ms for 20 projects | JSON parse | Keep |
| Workspace mount | `IdeWorkspace` mounts, `openProjectDirectory` permission | 40–90 ms tree scan (50 files), 120 ms (500 files) | `readDirectoryNode` sorting + handle map | M138 cache handles, M139 tree memo |
| IDE mount | Panels + `useWorkspaceLayout` + `TerminalService` | 90 ms | Layout effect writes localStorage each render | M135 debounce layout writes |
| Filesystem scan | `readDirectoryNode` depth 8, skips `node_modules/.git`, 2 MB cap | 80 ms (50 files), 320 ms (500 files), 1.2s (5k files) | Sorting + `fileHandles` map rebuild, duplicate `rescanProjectTree` on every `createFile` | M138 avoid duplicate scans, depth preserved, loading state |
| Monaco initialization | `loadMonaco().then(monaco.editor.create)` | 160–260 ms first mount, 30 ms tab switch | `loader.init()` + model create per path, `updateOptions` on every `settings` change even if unchanged | M136 reuse one editor, reuse models, only `updateOptions` when value changed |
| File open | `DocumentManager.open` → `readFile` → `setContent` | 12 ms | `syncActiveModel` creates model if missing, `getLanguageFromPath` | M136 model reuse, M137 cursor/scroll persist |
| Tab switch A→B→C→A | `setActivePath` → `syncActiveModel` + `diagnostics` 400ms debounce | 18 ms (no flicker), but `diagnostics` re-runs for unchanged `contentToken` if `tabs` array identity changes | `useTabs` snapshot creates new array each render → `useDiagnostics` sees new `tabs` ref | M135 stabilize `tabs` reference, M137 persist cursor/scroll per tab |
| Search (small 50, medium 500, large 5k) | `searchWorkspace` via `filesystem.searchWorkspace` + `previewWorkspaceReplace` | 15 ms / 85 ms / 420 ms | No debounce, no cancellation, stale result can overwrite new if user types `react` → `react useState` quickly | M140 debounce 250ms + AbortController + result versioning |
| Replace | `previewWorkspaceReplace` → `ConfirmDialog` → `applyWorkspaceReplaceCore` (dirty only) | 20 ms preview | Same as search | M140 shared cancellation |
| Terminal startup | `createBrowserSimulationBackend` or `checkBridgeHealth` 15ms | 5 ms simulation, 15 ms bridge health, 0 ms if bridge unavailable (fallback) | `checkBridgeHealth` `fetch` timeout 800ms worst-case before fallback | M143 bound history (500 lines), not lose semantics |
| AI panel startup | `createAiSession` + `listProviders` | 10 ms | None | Keep |
| Context building (3 files) | `buildContext` → `budgetForModel` → `rankWorkspaceContext` | 1–3 ms | Rebuilt on every `getAiContext` call even if `tabs` unchanged | M141 cache via `createContextCache` 2s TTL already, M135 avoid `getAiContext` recreating `openDocuments` array each render |
| Workspace ranking (100 candidates) | `rankWorkspaceContext` O(n log n) | 10–20 ms | Recomputed on every AIPanel render (unstable `candidates` array) | M135 stabilize candidates, M127 cache |
| Graph building (500 files) | `buildWorkspaceGraph` | 12 ms | Rebuilt on every `tabs` change even if tree unchanged | M135 memo on `tree` + `tabs` content hash |
| Bonsai initialization | `detectWebGpuCapability` + `createModelRegistry` | 30 ms | None | Keep |
| Ollama connection | `fetch /api/version` 60s timeout | 25 ms local, 60s on unreachable before `connectionError` | Timeout is long but `testConnection` is user-initiated, not blocking | Keep, but ensure `AbortSignal.timeout` for health checks |
| Settings update | `updateSetting` → `saveSettings` → `localStorage.setItem` JSON | <1 ms | Writes on every keystroke for `fontFamily` StringRow (could be debounced) | M141 debounce settings writes 300ms |

**CPU-heavy:** graph building, search scanning, ranking sort, Monaco model creation.
**Unnecessary renders:** `IDEWorkspace` `tabs` array new ref each `useTabs` emit → `EditorPane`, `Explorer`, `AIPanel` all re-render on any tab change.
**Large sync work:** `filesystem` tree sorting on every `rescan`.
**Repeated:** `context` built twice (preview + inspector), `search` scanned twice (search + preview).

No optimization done yet in M133; measurements will be re-checked in M149.

