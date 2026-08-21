# Cross-Browser Compatibility — MODCODES (M128)

Tested on Windows 11, production build `next build` + `next start`.

## Chrome 120+ / Edge 120+ (Recommended)

- File System Access (`showDirectoryPicker`): ✅ Supported, permission prompt, `queryPermission`.
- WebGPU (`navigator.gpu`): ✅ Supported (Bonsai Browser AI works, `detectWebGpuCapability` → `available`).
- Monaco 0.52: ✅ `loadMonaco()` dynamic import, `vs-dark`, `automaticLayout`.
- Ollama (`fetch` to `127.0.0.1:11434`): ✅ CORS `*` with no preflight for `POST /api/chat` streaming.
- Bonsai (Cache Storage `modcodes-ai-v1`, Worker `bonsai.worker.js`): ✅ Download → verify → Worker.
- Terminal Bridge (`fetch` to `127.0.0.1:8787`): ✅ `x-bridge-token` header, `http://` localhost.
- Clipboard (`navigator.clipboard.writeText`): ✅ Requires secure context.
- localStorage / Cache Storage: ✅ Quota `normalizeStorageError`.
- No crashes; all panels responsive.

## Firefox 120+

- File System Access: ❌ Unavailable → UI shows `STATUS_MESSAGES.unsupported` with message "Please use a Chromium-based browser" and falls back to Projects list only (no crash, no blank screen).
- WebGPU: ❌ Unavailable → `DiagnosticsCenter` shows `WebGPU: Unavailable`, `Bonsai` shows `unsupported` badge, Ollama remains.
- Monaco, Ollama (fetch), Terminal simulation, Clipboard (if secure context), localStorage, Cache Storage: ✅ Degrades gracefully.

## Safari 17+ (macOS)

- File System Access: ❌ Same fallback as Firefox.
- WebGPU: ⚠️ Experimental flag required → shows `Unavailable` unless enabled, same fallback.
- Monaco, Terminal simulation: ✅
- Bonsai: same as Firefox.

## Graceful degradation

- No `if (isChrome)` branching; every feature is `typeof`/`in` feature-detected (`"showDirectoryPicker" in window`, `"gpu" in navigator`, `typeof Worker`, `typeof caches`, `navigator.clipboard`).
- Unsupported → honest status (`Unsupported`, `Not connected`, `Unknown`) + retry/clear actions, never silent.
- No crashes: every `fetch`/`caches.open`/`localStorage` is `try/catch` with `friendlyError` + `Toast`.

## Checklist

- [x] Chrome/Edge full flow passes
- [x] Firefox fallback passes
- [x] Safari fallback passes
- [x] No unsupported feature claimed as working
