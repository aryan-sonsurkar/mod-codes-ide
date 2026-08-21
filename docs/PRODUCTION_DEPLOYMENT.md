# Production Deployment — MODCODES

## Required configuration

- **Next.js 16.2.9 (Turbopack)** — `next.config.mjs` is intentionally minimal; no custom `webpack` or `env` required. Static routes `/`, `/projects`, `/settings` are prerendered.
- **No environment variables** — the app has no `NEXT_PUBLIC_` secrets; Ollama URL is user-configured in `localStorage` (`modcodes-settings` → `ai.baseUrl`), Bonsai weights are in Cache Storage, bridge is `http://127.0.0.1:8787`.
- **No cloud services** — no database, auth, or analytics is required for core functionality.

## Browser requirements

- **Chromium (Chrome/Edge) recommended:** File System Access API is required for real folder access; Firefox/Safari show `unsupported` and fall back to project list only.
- **WebGPU:** Chrome/Edge desktop for Bonsai; Firefox/Safari report `unsupported` → Bonsai disabled, Ollama remains.
- **Web Worker, Cache Storage, localStorage, Clipboard:** feature-detected via `typeof` checks; unavailable → honest `Unavailable`/`Not connected` in Diagnostics Center.

## Deployment assumptions

- **Static + client:** All AI (Ollama fetch to `127.0.0.1`, Bonsai Worker) is client-side. No server component fetches Ollama/Bonsai.
- **Dynamic imports:** Monaco `loadMonaco()` and `bitgpu` are `import()`-ed dynamically and cached; missing chunk → user-readable `friendlyError` + retry, not blank screen.
- **Monaco loading:** `editor.updateOptions` is used, not remount, so settings changes are live.
- **File System Access API:** origin must be secure context (`https` or `localhost`); permission is `queryPermission`/`requestPermission` per `filesystem.js`.

## Local-only components (not deployed)

- **Ollama:** user installs locally (`ollama serve` + `ollama pull <model>`), browser fetches `http://127.0.0.1:11434` directly. No proxy.
- **Bonsai:** 237 MB GGUF streamed into Cache Storage `modcodes-ai-v1`, verified by `content-length`.
- **Terminal bridge:** `node tools/modcodes-bridge/server.js` binds `127.0.0.1:8787` only, token `x-bridge-token`, never `0.0.0.0`.

## Production limitations

- Large workspaces (>50 files, 2 MB cap per file) are truncated by `context ranking` + `budgetForModel`.
- `localStorage` quota varies; corrupted JSON is sanitized to defaults.
- Cache Storage quota varies; `normalizeStorageError` maps quota to user message.

## Origin & CORS

- App origin must be `https` (or `localhost` for dev) for File System Access.
- Bridge allows `Access-Control-Allow-Origin: *` but still requires `x-bridge-token`; CORS is localhost-only because bridge binds `127.0.0.1`.

## Localhost bridge behavior

- Bridge health `GET /health` → `{ok:true}`. Pairing `POST /pair {token}` → `{ok,paired}`. All other routes require `x-bridge-token`. Sessions `POST /terminals` → `POST /terminals/:id/execute` etc. No env var leakage.

## Checklist before `next build`

- `npm run build` must show `✓ Compiled successfully` and static routes `/, /projects, /settings`.
- No `NEXT_PUBLIC_` secrets committed; no credentials in `next.config.mjs`.

