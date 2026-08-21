# MODCODES — AI Product Model (Modules 58–67)

Status: Modules 58–67 are implemented — polished AI panel, context inspector,
editor code actions, safe diff engine, workspace commands, navigable
references, tool approval, conversation management, resource UX, and full
integration. See [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) for the layered
design and [BROWSER_AI.md](./BROWSER_AI.md) for the browser provider.

## Product principle

MODCODES should NOT feel like "an IDE with a ChatGPT sidebar."

It should feel like "an IDE where AI understands the developer's code and can safely assist them."

AI is user-controlled. It never silently modifies/deletes files, executes
commands/JS, performs Git operations, or exposes secrets. Every file change
passes through an explicit Accept → dirty → Save flow.

## Providers

| Provider | Runtime | Where it runs | Privacy |
| --- | --- | --- | --- |
| Ollama | Ollama server | Local machine (`http://127.0.0.1:11434`) | Files sent to local server only |
| Bonsai / Browser AI | bitgpu in a Worker + WebGPU | This browser tab + GPU | Nothing leaves the device |

Both implement the same contract: `getModels`, `chat`, `streamChat`,
`getCapabilities`, `testConnection`. The UI selects a provider/model by id; the
session routes to the right provider. Switching is explicit — no silent
fallback.

Future provider 3 is **MODCODES-CODER**. It will be another provider entry
behind the same contract. No fine-tuning, cloud AI, auth, or database is
included in this phase.

## AI architecture (short)

```
AIPanel
  ↓
createAiSession (messages, model, provider, systemPrompt, generation state)
  ↓                ↘
Provider           Context Engine (budgetForModel, priority, secrets filtered)
  ↓                ↓
Model         Context preview + inspector
```

## Context engine

- Sources: current file, selection, explicit files, symbols, open documents, search results, diagnostics, workspace graph. Each has a type, priority, and file/path.
- Budget: `budgetForModel(model)` derives the limit from the model's `contextLength` (reserving output + history, headroom 0.8, clamp 2k–200k chars). When the window is smaller, low-priority sources are dropped, high-priority content is truncated, and `truncated`/`limitedBy` are surfaced.
- Secret filtering: `isSecretPath` blocks `.env`, keys, credentials before any transmission.
- Inspector: the panel shows per-source included/excluded/truncated state, size, priority, the budget (used/available/limit, model window), and an explanation when truncated. Sources can be excluded and the preview refreshed. Nothing hidden.

## Tools and permissions

- Registry: `createTool`/`createToolRegistry` with schemas, permission levels, validated `execute()`.
- Built-ins (read-only): `ide.current-file`, `ide.diagnostics`, `ide.open-files`. All are `read`. The session's tool loop is bounded (`maxToolRounds`, default 2).
- Permissions: `read` < `write` < `execute` < `destructive`. `read` may auto-run; `write`/`destructive` require an `AIToolApproval` dialog (tool, reason, args, Approve/Reject); `execute` remains disabled. The registry remains authoritative; arbitrary shell/JS/browser automation and autonomous Git are not enabled.

## Diff / edit flow

```
User selects code → Code Action → AI suggestion (code block) → Diff preview (Original/Suggested, ranges, Accept/Reject/Copy) → Accept → DocumentManager.setContent (dirty) → User Save → filesystem.writeFile
```

The diff engine (`diffEngine.js`: `createDiff`, `computeChangedRanges`, `acceptDiff`, `createDiffSession`) never calls `filesystem.js` directly. Single-file Accept/Reject is supported; partial acceptance is out of scope. `filesystem.writeFile` is only reached through the explicit Save path.

## References and navigation

- Types: file, line, symbol, diagnostic, search, graph. References carry `path`, `line`, `column`, `symbol`, `label`.
- `parseReferencesFromText` extracts `path:line:col` from AI text; `referencesFromDiagnostics`/`referencesFromSymbols` do the same from structured data.
- `AIReferences` renders clickable pills. Clicking opens the file if needed, activates the tab, reveals the line in Monaco (`revealLineInCenter`), and focuses the editor. Monaco, Go-to-Line/File/Symbol, and breadcrumbs are reused; no duplicate navigation is created.

## Conversations

- Persistence: `localStorage` key `modcodes.ai.conversations.v1`, at most 50 conversations, each with sanitized messages (content ≤10k, no passwords/keys/tokens/env vars/filesystem handles/model binaries). The AI panel lists conversations (New/Rename/Delete/Clear), restores on select by rehydrating the session, and persists on each assistant reply.
- Privacy: users can clear history from the panel or Settings → AI & Coder. No database, no telemetry.

## Performance and resources

- `instrumentation.js` normalizes per-request stats: `tokensPerSecond`, `prefillMs`, `decodeMs`, `durationMs`, `outputTokens`, `finishReason`. Ollama stats come from `eval_count`/`eval_duration`; browser stats from bitgpu's `ChatResult` via the worker bridge.
- The panel shows the last run's honed stats when available, otherwise "Unknown"/"Not available". Device tier (`hardwareTier` from `navigator.deviceMemory`) and the Browser AI download/cache state are shown when hardware info is available. All metrics are labeled as reported/estimated/unknown; nothing is invented. The data is never uploaded.

## Settings

Under **Settings → AI & Coder**:

- Provider (Ollama / Bonsai), Ollama base URL + Test connection
- Context budget (chars) and max tool rounds
- A privacy note (local storage only, secrets never sent)
- **Clear AI cache** (Cache Storage `modcodes-ai-v1` + local AI keys)
- **Clear conversation history** (`modcodes.ai.conversations.v1`)
- An explanatory note that Browser AI runs via WebGPU locally and Ollama runs as a local server

## Landing and product claims

The landing page now positions MODCODES as "A browser-based development environment with local-first AI" and lists only shipped features: Monaco, file explorer, local filesystem access, Bonsai, Ollama, AI-assisted code actions, workspace commands, privacy-first architecture. No claim of autonomous coding, cloud AI, or proprietary models is made.

## Security review (explicit)

- [x] No arbitrary shell execution — not implemented, `execute` permission disabled.
- [x] No arbitrary JS execution — no AI output is ever `eval`ed or executed; tools are declarative.
- [x] No silent filesystem writes — only `DocumentManager.setContent` (dirty) → explicit `save` → `filesystem.writeFile`.
- [x] No silent filesystem deletion — deletions require user confirmation via the existing files/projects confirm flow.
- [x] No secret context transmission — `isSecretPath` filters `.env`, keys, tokens; secrets are not stored in conversations.
- [x] No environment variable leakage — context sources are bounded filesystem/code intelligence only.
- [x] Secret paths filtered — verified by `context/secrets` and the inspector's "Secret paths are never sent" note.
- [x] Context budget enforced — `budgetForModel` + `clampBudget` + inspector budget display.
- [x] Tool rounds bounded — `maxToolRounds` in session, default 2, configurable 0–4.
- [x] Write/destructive require approval — `toolApproval.js` + `AIToolApproval` UI; `permissionAllows` remains authoritative.
- [x] Provider destination visible — AI panel and Settings both show the selected provider/baseUrl; switching is explicit.
- [x] Browser AI remains local after download — bitgpu Worker, Cache Storage, no fetch after model is cached.
- [x] Ollama receives only intended context — inspector shows exactly what is sent; secret filtering applies.
- [x] No hidden telemetry, auth, database, cloud inference — verified by inspection; instrumentation never uploads.

## Tests, lint, build

- Tests: 315 → `npm test` (31 files) includes `conversation` (M58), `codeActions` (M60), `diffEngine` (M61), `references` (M63), `instrumentation` (M56), `context` (M55/M59), and all prior suites.
- Lint: `npm run lint` (eslint) — clean.
- Build: `npm run build` (Next.js Turbopack) — `✓ Compiled successfully`.

## Bonsai / Ollama status

- **Bonsai**: catalog pins `prism-ml/Bonsai-1.7B-gguf@210a9e9` → `Bonsai-1.7B-Q1_0.gguf` (237 MB) via `WaveCut/Bonsai-web-GGUF`. Runtime is bitgpu v0.19.1 (MIT, zero deps). The model is advertised only when downloaded; context window 32k (4096 default) is shown in the panel.
- **Ollama**: provider speaks `POST /api/chat` streaming (JSON lines), supports `num_ctx` from the model's window. TestConnection hits `/api/version`; connection failures are surfaced explicitly.

## Known limitations and debt

- Code Actions currently use the panel's Monaco selection via `selectionHandleRef`; multi-cursor and very large selections are truncated by the context budget.
- Diff preview compares the current file content against the first code block in the AI reply; multi-file edits and partial acceptance are out of scope.
- Workspace commands synthesize a prompt from the tree/diagnostics/symbols; they do not run a separate analysis — they reuse whatever intelligence is already available.
- Conversation rehydration restores messages into the session via `addMessage`; tool-call history is not fully replayed.
- Instrumentation marks unknown metrics as Unknown; a richer "model load time / first-token latency" breakdown for Bonsai would require additional runtime spans.

## Recommended next architecture phase

Without re-committing to modcodes-coder yet, the clean next phase is:

1. **modcodes-coder provider stub** — a third provider entry that returns a deterministic local response (or a small quantized model) behind the same contract, so all of the above UX can be exercised end-to-end without inventing metrics.
2. **Multi-file diff session** — extend `diffEngine` to hold a map of `path → diff` and a preview that navigates file-by-file, still gated by explicit Save per file.
3. **Workspace context ranking** — a lightweight relevance scorer (symbol distance from active file + graph edges) so workspace commands trim to the most relevant 8–12 files instead of the first 50.
