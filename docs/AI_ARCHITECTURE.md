# MODCODES AI Architecture

Status: Modules 40–67 are implemented — architecture review (M40), provider
contract (M41), context engine (M42), Ollama provider (M43), model catalog with
hardware recommendations (M44), AI session + chat panel (M45), the AI tool
system with read-only tools and permission enforcement (M46), AI settings with
provider configuration and integration (M47), the browser AI phase (M48–M57),
and the AI developer experience phase (M58–M67). See [BROWSER_AI.md](./BROWSER_AI.md)
for the browser provider and [AI_PRODUCT_MODEL.md](./AI_PRODUCT_MODEL.md) for
the product model.

## Design principle

The IDE must not care which model is being used.

```
                    MODCODES IDE
                         │
                    AI Interface
                         │
                ┌────────┴────────┐
                │                 │
          AI Provider        Context Engine
                │                 │
        ┌───────┴───────┐         │
        │               │         │
      Ollama        Browser      │
                    Bonsai       │
                                   │
                        ┌──────────┼──────────┐
                        │          │          │
                      Files     Symbols    Diagnostics
                        │          │          │
                     Search     Graph      Editor
```

The UI talks to an AI abstraction. The abstraction talks to a provider. The
provider talks to a model. `modcodes-coder` will later plug in as just another
provider/model behind the same contract.

## Conceptual layers

1. **AI Provider** — the adapter that talks to a specific backend (Ollama,
   browser Bonsai, later modcodes-coder). Provider-neutral contract:
   `getModels`, `chat`, `streamChat`, `getCapabilities`, `testConnection`.
   Never assumes a specific backend.
2. **AI Model** — provider-neutral representation: `{ id, name, provider,
   capabilities, contextLength, metadata }`. Metadata is never fabricated.
3. **AI Request** — provider-neutral request model: `{ messages, context,
   model, options }`. No backend-specific fields leak into the core model.
4. **AI Response** — the core can represent text, streaming text, errors,
   completion state, and (later) tool requests.
5. **Context Engine** — decides what information is sent to a model. Explicit,
   bounded, priority-ordered, size-budgeted. Never dumps the whole project.
6. **Tool Registry** — declarative tools with schemas, permission levels, and
   validated `execute()` implementations. Read-only tools only initially.
7. **Permission System** — levels: `read`, `write`, `execute`, `destructive`.
   Only `read` is allowed automatically. Nothing destructive is automatic.
8. **AI Session** — one conversation: messages, selected model, provider,
   context, generation state. The session is the bridge between UI and
   provider/context/tools.

## Boundaries

- **Provider boundary**: providers speak the provider contract; the rest of the
  app never touches `fetch("ollama...")` directly. The browser Bonsai provider
  communicates with its runtime exclusively through a typed bridge; the main
  thread never imports the weight runtime.
- **Model boundary**: the UI selects a model by id; only the provider knows how
  to invoke it.
- **Context boundary**: IDE services (filesystem, code intelligence,
  diagnostics, graph, search) feed the Context Engine through explicit
  adapters; no raw filesystem handles are ever exposed to AI. The context
  budget is derived from the selected model's context window
  (`budgetForModel`) with room reserved for history and output, so a smaller
  window never overflows.
- **Tool boundary**: models request tools by name; the Tool Registry maps names
  to validated implementations; no arbitrary JavaScript from model output.
- **Permission boundary**: tools declare a permission level; only `read` runs
  automatically. `write`/`execute`/`destructive` require explicit confirmation
  in a later phase and are not implemented now.
- **Weight boundary**: model weights come from declared sources only (the
  catalog pins the repo, revision, file, and URL). Weights are verified against
  `content-length`, and a size mismatch fails loudly. Inference runs locally on
  the user's device via WebGPU; weights never leave the browser.

## Data flow

```
AI Chat (panel)
   │
   ▼
AI Session (messages, model, provider, state)
   │                          │
   ▼                          ▼
AI Provider              Context Engine
   │                          │
   ▼                    ┌──────┼───────────┐
   Model                ▼      ▼           ▼
                 Files  Symbols  Diagnostics  Graph  Search
```

Tool flow (read-only, bounded):

```
AI Model
   ▼
Tool Request
   ▼
Tool Registry → Permission Check → Tool Execution → Tool Result
   ▼
AI Model
```

The session runs this loop automatically when the provider requests tools:
executes each call through the registry (enforcing the read permission bound),
appends the results as `tool` messages, and re-asks the model. The loop is
bounded (`maxToolRounds`, default 2) so the model cannot run indefinitely, and
tools with `write`/`execute`/`destructive` permission are never auto-run.

## Security principles

- AI never automatically receives: the entire project, arbitrary filesystem
  contents, secrets, environment variables, passwords, unrelated files.
- Context is explicitly selected and bounded by the Context Engine. When a
  model has a smaller context window, the budget shrinks to match and
  truncation is visible in the UI.
- Tool execution requires permissions; only read tools exist initially.
- Arbitrary AI-generated shell commands are never executed.
- Browser-to-Ollama communication is local-only; no cloud backend, no proxy.
- The browser provider runs inference locally on-device (WebGPU/WebAssembly in
  a worker). Model weights are downloaded from declared sources only, cached in
  Cache Storage, verified by size, and never uploaded anywhere.
- Provider switching is explicit. If the browser model is not ready, the UI
  shows a clear "not ready" state and offers to switch back to Ollama; it never
  silently falls back behind the user's back.
- No remote AI inference endpoints are called from this app.

## Instrumentation

- Providers emit a `stats` stream event carrying `tokensPerSecond`,
  `outputTokens`, `prefillMs`, `decodeMs`, `durationMs`, and `finishReason`
  when the backend reports them (Ollama's `eval_count`/`eval_duration`; bitgpu's
  `ChatResult` via the worker bridge).
- The session surfaces the last request's stats to the UI, which renders them
  inline (e.g. "12.4 tok/s · 1.5s"). No telemetry is transmitted anywhere.

## Developer experience (M58–M67)

- **AIPanel** is a polished workspace with explicit conversation states (idle, loading, generating, cancelled, complete, error), provider/model selectors, streaming with caret, Stop/Clear, context indicator, and stats. It delegates all provider work to `createAiSession`; no provider logic is duplicated in the UI.
- **Conversation** (`conversation.js`) models each message with `id`, `role`, `content`, `timestamp`, optional `contextMetadata` and `toolMetadata`, and `streaming`. The panel and the session never invent messages.
- **Context Inspector** (`AIContextInspector`) shows every source (current file, selection, open files, diagnostics, symbols, graph, search), its size/priority/included-excluded state, the budget (used/available/limit), model window, and a truncation explanation. Secret paths are filtered by the shared `isSecretPath` system and never shown as sendable.
- **Code Actions** (`codeActions.js`) and **Workspace Commands** (`workspaceCommands.js`) reuse the same session. Selection-aware actions send only the bounded selection plus the model-aware context budget. They are available from the Command Palette, which opens the AI panel and sends the templated prompt.
- **Diff Engine** (`diffEngine.js`) is the only path from an AI suggestion to a dirty document. A diff `{path, original, proposed, ranges}` is previewed (original/suggested columns, changed ranges, Accept/Reject/Copy). On Accept the diff is applied through `DocumentManager.setContent`, which marks the tab dirty; the user must explicitly Save to hit the filesystem. The diff engine never calls `filesystem.writeFile` directly.
- **References** (`references.js`) parse `path:line:col` and symbol diagnostics into structured `{type, path, line, column, label}` references. `AIReferences` renders them as clickable pills; clicking opens the file, reveals the line, and focuses Monaco (`revealLineInCenter`).
- **Tool Approval** (`toolApproval.js`) keeps the registry authoritative. `read` tools auto-run; `write`/`destructive` require an explicit `AIToolApproval` dialog (Approve/Reject). `execute` remains disabled. No shell/JS/Git automation is enabled.
- **Conversation Storage** (`conversationStorage.js`) persists at most 50 conversations in `localStorage` under `modcodes.ai.conversations.v1`. Stored messages are sanitized (content sliced to 10k, no secrets, no filesystem handles, no model binaries). Users can rename, delete, create, and clear all from the AI panel and Settings. No database is introduced.
- **Performance UX** reuses `instrumentation.js`. Per-request stats (`tokensPerSecond`, `decodeMs`, `durationMs`, `outputTokens`) are shown when the runtime reports them, otherwise "Unknown". Model load/device tier info is shown from the browser and Ollama metadata. All metrics are marked as reported vs estimated vs unknown; nothing is invented.
- **Settings** (`SettingsPage`) now exposes provider, model, Browser AI status, Ollama status, context budget, tool rounds, conversation persistence, privacy notice, browser model cache clear, and history clear — all local-only.
- **Accessibility/Responsive**: the panel uses `role="log"`, `aria-live`, `aria-modal` for dialogs, focus trapping via `focusHandleRef`, keyboard shortcuts (Command Palette, Go to Line/File/Symbol), and responsive breakpoints for the inspector and settings.

## Final architecture (M68–M82) — MODCODES-CODER + agentic workflow

Validated target:

```
                    MODCODES
                       │
                 AI Application
                       │
                 AI Session
                       │
             ┌─────────┴──────────┐
             │                    │
        Context Engine        Agent Layer
             │                    │
             │              Planner / Task
             │                    │
             └─────────┬──────────┘
                       │
                 Tool Registry
                       │
                Permission Layer
                       │
                ChangeSet / Diff
                       │
                 DocumentManager
                       │
                    Save
                       │
                  Filesystem
```

Providers (all behind the same contract):

```
          ┌──────────┬──────────┬───────────────┐
          │          │          │
       Ollama      Bonsai    MODCODES-CODER
       local       browser       future (stub now)
```

- **MODCODES-CODER boundary** (`MODCODES_CODER_ARCHITECTURE.md`): stub `createModcodesCoderProvider` implements `getModels/testConnection/chat/streamChat` deterministically; real model will be a local runtime (Worker or server) with versioned manifest, checksum, and `Version Mismatch` handling. No AIPanel or DocumentManager rewrite required.
- **Capability system** (`capabilities.js`): explicit `chat/streaming/cancellation/tools/local/browser/fileEditing/statistics/...` advertised by each provider/model; UI consumes via `hasCapability`/`AIProviderCapabilities`, no `if provider === "ollama"` branching.
- **Multi-file diff** (`createMultiFileDiffSession` = `Map<path,Diff>` with per-file Pending/Accepted/Rejected, AcceptAll/RejectAll/Cancel, DocumentManager-only apply) and **ChangeSet** (`modify/create/delete/rename`, pending/approved/rejected/applied/saved/failed) are the reviewable agent surface; `AIChangeReview` shows summary, additions/deletions, deterministic risk (destructive/large/config/dependency/multiple-files), Accept file/all, Open.
- **Agent** (`AGENT_ARCHITECTURE.md`): User → Agent Session (Task/Step states, cancellation) → Planner → Context (ranked) → Tool Registry → Permission → Execution → Observation → Next. See `agentTask.js` (`createAgentTask/Step/Session`) and `AgentPlanPreview` (Approve/Reject, no auto-execution). No autonomous loop is executed.
- **Relevance-ranked context** (`relevanceRanking.js`) scores by current file, selection, same directory, imports/importers, graph neighbors, diagnostics, recent tabs, search, size; returns `ranked/included/excluded` bounded by the model window; reuses `workspaceGraph` and `codeIntelligence`. `contextPerformance.js` measures build duration and caches unchanged context.
- **Installation** (`MODCODES_CODER_INSTALLATION.md`): future flow `Not Installed → Checking → Installing → Installed → Loading → Ready / Version Mismatch / Error`, checksum-verified download into Cache Storage/OPFS, registered as `AiModel`.

## Critical questions (M82)

1. Can MODCODES-CODER be added without rewriting AIPanel? **Yes** — it registers via `registerProvider`; discovery is capability-based.
2. Can a future model use the existing context engine? **Yes** — `budgetForModel` + `rankWorkspaceContext` are provider-neutral.
3. Can an agent use existing tools without bypassing permissions? **Yes** — every tool goes through `Tool Registry → Permission Layer`.
4. Can AI-generated changes be reviewed before filesystem writes? **Yes** — diff/changeset → DocumentManager dirty → explicit Save.
5. Can multi-file changes be cancelled? **Yes** — `MultiFileDiffSession.cancel()` / `agentTask cancel()`.
6. Can a user stop an agent task? **Yes** — `AgentSession.cancel()` + provider `AbortSignal`, terminal `cancelled`.
7. Can context remain bounded? **Yes** — model window + ranking + inspector + budget display.
8. Can secrets remain filtered? **Yes** — `isSecretPath` + storage sanitization.
9. Can providers fail without crashing the IDE? **Yes** — `testConnection` + `AI_ERRORS` + isolated sessions.
10. Can the system support a future local MODCODES-CODER runtime? **Yes** — stub shares the shape; real runtime plugs in as another bridge like Bonsai.

## Future: modcodes-coder

`modcodes-coder` will implement the same provider contract (or a registry entry
pointing at its model). No IDE changes required beyond configuration. Out of scope
for 40–82: model training/fine-tuning, cloud inference, auth, database, payments,
ads, autonomous execution, and arbitrary shell/JS execution. See `MODCODES_CODER_ARCHITECTURE.md` and `AGENT_ARCHITECTURE.md`.