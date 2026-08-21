# PWA & Offline — MODCODES (M115)

**Manifest:** `public/manifest.json` — name `MODCODES — Browser IDE with Local AI`, short `MODCODES`, `display: standalone`, `start_url: /`, `theme_color #8B5CF6`, icons `file.svg`/`window.svg`, background `#22183A`.

Installability is honest: the manifest makes MODCODES installable as a PWA (standalone) without pretending filesystem APIs become universal.

**No service worker for project data:** We do **not** cache `FileSystemDirectoryHandle` contents or AI conversations via a service worker, because that would risk stale project data. The manifest alone is sufficient for "Add to Home Screen".

## What works offline (after install, no network)

- Landing, Projects, Settings (static routes) — cached by Next.js static generation.
- Workspace UI, Monaco, Explorer, Tabs, Search (in-memory) — works if project was already opened and `FileSystemDirectoryHandle` permission was granted (permission persists per browser, not via network).
- Terminal simulation (`browserSimulationBackend`) — fully offline.
- Bonsai Browser AI — after 237 MB download, weights are in Cache Storage `modcodes-ai-v1`, inference is Worker+WebGPU, fully offline.
- `localStorage` (settings, workspace, conversations) and `Cache Storage` are offline.

## What requires network

- Initial page load if not cached (first visit).
- Bonsai first download (237 MB via `fetch` + streaming into Cache Storage).

## What requires localhost

- Ollama: `fetch` to `http://127.0.0.1:11434` — requires `ollama serve` locally.
- Terminal bridge: `fetch` to `http://127.0.0.1:8787` — requires `node tools/modcodes-bridge/server.js` with `x-bridge-token`.

## What requires browser APIs

- File System Access API: Chromium only (`showDirectoryPicker`); Firefox/Safari show `unsupported` fallback.
- WebGPU: Chrome/Edge desktop for Bonsai; feature-detected via `navigator.gpu`.
- Web Worker, Cache Storage, Clipboard, Notifications: feature-detected, Diagnostics Center shows `Supported/Unavailable/Blocked`.

