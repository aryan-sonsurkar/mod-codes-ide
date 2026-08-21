# Final Security Audit — MODCODES v1 (M129)

**Scope:** filesystem permissions, terminal bridge, bridge token, Ollama, Bonsai, AI tools, Agent, ChangeSet, Diff, Context, secret filtering, localStorage, Cache Storage, Clipboard, URLs, external requests.

## Filesystem

- Permission is `queryPermission` → `requestPermission` per `filesystem.js`; `openProjectDirectory` requires user gesture (`showDirectoryPicker`). No `0.0.0.0` exposure.

## Terminal bridge

- Binds `127.0.0.1:8787` only (`server.listen(PORT, "127.0.0.1")`), never `0.0.0.0`.
- Token `crypto.randomBytes(32).hex`, `POST /pair` + `x-bridge-token` on every request, short-lived (restart rotates). No `?token=1234`, no hardcode.
- Narrow API: `/health`, `/pair`, `/terminals`, `/terminals/:id/execute|kill|cwd|resize` — no env var exposure, no history persistence.

## AI

- **No remote shell:** `AI execute` permission disabled; `executeAgentTool` rejects non-`read`.
- **No arbitrary code:** no `eval`, no `new Function`, tool calls via `Tool Registry` only.
- **No hidden telemetry:** no `fetch` to cloud; Ollama `127.0.0.1`, Bonsai Worker+Cache Storage.
- **No secret transmission:** `isSecretPath` blocks `.env`/`*.pem`/`credentials`; `excludeSecretPaths` in context ranking; `conversationStorage`/`actionHistory` sanitize to `id/action/provider/model/timestamp/target/accepted/files` only.
- **No silent writes/deletes:** `createDiff`/`ChangeSet` → `DocumentManager.setContent` → dirty → Save → `filesystem.writeFile`; `deleteEntry` requires `confirmBeforeDelete` + `ConfirmDialog`.
- **No autonomous agent:** `AgentOrchestrator` bounded (`maxSteps 10`, `maxToolRounds 4`, `budget`, `timeout`), `AgentPlanPreview` requires Approve/Reject, `cancel()` propagates `AbortSignal`.
- **No provider bypass:** every provider implements `getModels/chat/streamChat/testConnection`; `hasCapability` checks, no `if provider==="ollama"` branching for features.

## Storage

- `localStorage` keys: `modcodes-settings`, `modcodes-projects`, `modcodes.ide.layout.v1`, `modcodes.ide.workspace.v2`, `modcodes.onboarding.completed`, `modcodes.bridge.token`, `modcodes.ai.*`; all `try/catch` + `sanitizeSettings` + `sanitizeMessage`.
- `Cache Storage` `modcodes-ai-v1` quota via `normalizeStorageError`; no project data in service worker (no service worker for project data).

## URLs

- `normalizeBaseUrl` rejects non-`http(s)`, `new URL` validation for Ollama baseUrl and bridge `127.0.0.1`.

## Verdict

- **No credentials committed:** `git log --all -p | grep -i apiKey` clean.
- All M129 checklist items pass.

