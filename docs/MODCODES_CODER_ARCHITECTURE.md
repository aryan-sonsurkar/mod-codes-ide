# MODCODES-CODER Architecture Boundary (M68)

Status: Design-only. No model weights are distributed. MODCODES-CODER is a provider target behind the existing contract.

## Review scope (M68)

Inspected: `src/app/lib/ai` provider/registry/request/response/session, `context/*` builder/budget/preview/secrets, `tools/*`, `browser/*` (webgpu, cache, registry, runtime, bridge), `model.js`, `hardware.js`, `instrumentation.js`, `conversation.js`, `codeActions.js`, `diffEngine.js`, `references.js`, `workspaceCommands.js`, `conversationStorage.js`, `AIPanel.jsx`, `BrowserAISection.jsx`, `AIContextInspector.jsx`, `DocumentManager` (`lib/editor/documents.js`), diagnostics, codeIntelligence, workspaceGraph, `SettingsPage`.

Finding: abstractions are provider-neutral; no AIPanel/provider-specific branching beyond explicit `providerId` select (gated by M70 capability work); DocumentManager is the only filesystem-adjacent mutation path.

## Target layering

```
AI Provider (Ollama | Bonsai | MODCODES-CODER stub)
    ↓
AI Session (messages, model, systemPrompt, generationState, cancel, tool loop)
    ↓
Context Engine (budgetForModel, priority, secret filter, inspector)
    ↓
Tool Registry (permission levels; read auto, write/destructive gated)
    ↓
ChangeSet / Diff (createDiff / MultiFileDiffSession, no filesystem bypass)
    ↓
DocumentManager (dirty → Save)
    ↓
Filesystem (File System Access API, permission checked)
```

MODCODES-CODER plugs into `AI Provider` via `createModcodesCoderProvider()` behind `registerProvider`. No AIPanel, DocumentManager, or filesystem rewrite; no provider-specific UI or context system.

## Provider contract (what MODCODES-CODER must implement)

- `id`, `name`, `getCapabilities() → { id, name, capabilities, details }`
- `getModels() → AiModel[]`
- `testConnection() → { ok, message }`
- `chat(request) → { ok, text }` and `streamChat(request) → AsyncIterable<chunk>`
- Chunks: `{type: "text"|"done"|"error"|"tool"|"stats"}`
- Cancellation: `request.signal` (AbortSignal) must abort generation promptly; partial text is preserved by session.
- Errors: normalized via `AI_ERRORS` (`cancelled`, `unavailable`, `unsupported`, ...), never throw raw.

## Model lifecycle (future, not executed now)

```
Not Installed → Checking → Installing → Installed → Loading → Ready
                                    ↘ Version Mismatch / Unavailable / Error
```

## Request / streaming / cancellation

- `session.sendMessage({content, context, options, tools, toolRunner, onDelta, onTool})` builds `request = {messages, context, model, options, tools, signal}`.
- Providers serialize context via `serializeContextItems`, stream text chunks, optional tool chunks, terminal `stats`/`done` or `error`.
- Session bounds tool rounds (`maxToolRounds`), executes only via registry + permission layer, appends `tool` messages, re-asks.

## Context

- Bounded, priority-ordered, budget derived from `contextLength` (`budgetForModel`), inspectable via `AIContextInspector`, secrets filtered (`isSecretPath`). Provider never sees raw handles.

## Tool calls, permissions

- Tools declare `permission` (`read|write|execute|destructive`). `read` may auto-run; `write/destructive` require `AIToolApproval`; `execute` remains disabled. No bypass of registry.

## Local execution expectations

- MODCODES-CODER is local-first like Ollama/Bonsai: inference on device, no cloud fallback, no telemetry. Stub returns deterministic text; a future runtime would run in a Worker (like Bonsai) or local server (like Ollama), still behind the same provider surface.

## Future distribution / installation (see M80)

- Distribution is not downloading model weights in this phase. Future: versioned manifest (repo/revision/file/bytes/sha256), compatibility check (RAM, WebGPU if browser), streaming download into Cache Storage/OPFS, checksum verification, registry registration; `Version Mismatch` if catalog mismatches installed bytes.

## Version compatibility

- `AiModel.metadata.versionKey` (from catalog `modelVersionKey`) pins the model revision. Storage (`conversationStorage`) is versioned (`modcodes.ai.conversations.v1`) and sanitized on load.

## What is NOT changing

- AIPanel keeps the same provider-agnostic props (`getContextData`, `externalPrompt`, `onApplyDiff`, `onNavigate`); discovery is via registry + capability checks, not `if (provider === "...")`.
- DocumentManager remains the mutation gate; filesystem permission boundaries stay enforced.
- Provider switching stays explicit.

This boundary satisfies: MODCODES-CODER can be added without an AIPanel or DocumentManager rewrite, without provider-specific UI/context, and without a filesystem bypass.

