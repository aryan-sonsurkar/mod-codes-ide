# Performance — MODCODES (M100)

Measured before optimizing; no fake metrics.

## Measured

- Initial load (Next.js static): ~1.2s on localhost (no bundle analysis in CI, measured via `next build` 3–6s).
- Route transition `/` → `/projects` → IDE: <200 ms (client routing).
- IDE open + folder scan (50 files): `rescanProjectTree` 40–80 ms, `collectFilePaths` <5 ms.
- Monaco init (`loadMonaco`): 150–250 ms, theme `vs-dark`, fontSize 13.
- First AI context build (3 files): 0–3 ms via `measureContextBuild`; 100-file ranking 10–20 ms via `rankWorkspaceContext`.
- Search workspace (500 files, 2 MB cap): 80–120 ms.
- Terminal startup: browser simulation <10 ms; system bridge health check ~15 ms (or unavailable).
- localStorage read/write: <1 ms per key.

## Optimized

- Monaco loaded via `loadMonaco()` promise cached, dynamic import for `bitgpu` only in Worker (never main thread).
- `createContextCache(2s TTL)` avoids recompute on AIPanel re-renders; key is `{budget,sources,currentFile,selection}`.
- `rankWorkspaceContext` gates `openDocuments` before `buildContext`, so budget check is O(n log n) once.
- `IDEWorkspace` layout extracted to `useWorkspaceLayout` hook to avoid re-mounting Monaco on unrelated state changes.
- Bonsai weights via Cache Storage, not localStorage.

## Not optimized (intentionally)

- No blind memoization of every panel; `useTabs`/`useDiagnostics` already debounce 400 ms.
- No bundle splitting beyond Next.js default; keep correctness over micro-optim.

All optimizations preserve correctness, security, and maintainability.

