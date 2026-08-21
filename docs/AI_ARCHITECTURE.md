# MODCODES AI Architecture

Status: Modules 40–57 are implemented — architecture review (M40), provider
contract (M41), context engine (M42), Ollama provider (M43), model catalog with
hardware recommendations (M44), AI session + chat panel (M45), the AI tool
system with read-only tools and permission enforcement (M46), AI settings with
provider configuration and integration (M47), then the browser AI phase:
WebGPU capability detection (M49), the Bonsai model catalog, weight cache, and
model registry (M50), the browser runtime adapter + provider (M51–M52), model
downloads (M53), provider selection/fallback + settings (M54), context limits
per provider (M55), instrumentation + device tiers (M56), and integration
documentation + security regression (M57). See
[BROWSER_AI.md](./BROWSER_AI.md) for the browser provider.

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

## Future: modcodes-coder

`modcodes-coder` will implement the same provider contract (or a registry entry
pointing at its model). No IDE changes required beyond configuration. Explicitly
out of scope for Modules 40–57: model training, fine-tuning, model downloads
beyond the pinned Bonsai catalog, and AI autonomous agents.