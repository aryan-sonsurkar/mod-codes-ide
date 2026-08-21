# Security + Privacy Audit — Launch (M101)

## Security

- [x] No secrets committed: `grep -r apiKey|secret|password` shows only docs/tests, no credentials.
- [x] No hardcoded credentials: bridge token is `crypto.randomBytes(32)` at runtime, never hardcoded; Ollama URL validated via `normalizeBaseUrl`.
- [x] Bridge localhost-only: `server.listen(8787, "127.0.0.1")`, `Access-Control-Allow-Origin:*` but token required, no `0.0.0.0`.
- [x] Bridge session auth: `x-bridge-token` must equal generated token; `/pair` validates.
- [x] No arbitrary remote commands: bridge narrow API (`/terminals`, `/execute`, `/kill`, `/cwd`), never `eval`, never exposes env vars.
- [x] AI cannot silently execute shell: `AI execute` permission remains disabled; `agentToolExecution` rejects non-read.
- [x] AI cannot silently write/delete: `DocumentManager.setContent` → dirty → Save gate; `filesystem.deleteEntry` requires `confirmBeforeDelete`.
- [x] Tool Registry enforced: every agent step goes via `executeToolCall({registry,...})`.
- [x] Permission layer enforced: `permissionAllows` check in `agentToolExecution`.
- [x] Context budget enforced: `budgetForModel` + `clampBudget` + inspector.
- [x] Secret filtering: `isSecretPath` blocks `.env`, `*.pem`, `credentials`, etc., in `buildContext` and ranking.
- [x] No hidden telemetry: no fetch to cloud; Bonsai/Ollama are local only.
- [x] No cloud AI: provider URLs are localhost or declared GGUF source only.
- [x] No env leakage: context never includes `process.env`.
- [x] Filesystem handles not persisted: `workspaceStorage` stores only `path/name`, `conversationStorage` sanitizes to `id/role/content/timestamp`.
- [x] localStorage sanitized: `saveConversations` slices content 10k, caps 50, `sanitizeMessage`.
- [x] Cache Storage safe: `openWeightCache` quota errors via `normalizeStorageError`.
- [x] Provider URLs validated: `normalizeBaseUrl` rejects non-http(s).

## Privacy

All local: project files (File System Access API, user-selected dir), AI conversations (`modcodes.ai.conversations.v1`), settings (`modcodes-settings`), layout (`modcodes.ide.layout.v1`), workspace (`modcodes.ide.workspace.v2`), terminal data not persisted, `onboarding.completed` flag.

- Ollama: local provider (`127.0.0.1:11434`), `fetch` to local only.
- Bonsai: browser-local inference (Worker + WebGPU), weights in Cache Storage.
- Filesystem: user-selected directory, permission revocable.

No analytics.

## Browser QA

- Chrome/Edge: FS, Monaco, Bonsai (WebGPU), Ollama (fetch), bridge (localhost), responsive, keyboard nav, settings/projects/landing all pass.
- Firefox/Safari: FS shows `unsupported` fallback, Bonsai disabled as expected.

## Accessibility

- Palette `role=dialog aria-modal`, inspector `aria-expanded`, terminal `role=log`, buttons `aria-label`, dialogs focus via `focusHandleRef`, tabs `role=tablist`, reduced motion via CSS `prefers-reduced-motion` not yet custom but animations are minimal.

Launch checklist in `LAUNCH_READINESS.md` remains P0-clean after M97–100.

