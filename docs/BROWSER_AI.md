# Browser AI — Bonsai

MODCODES includes a second local-first AI mode that runs entirely inside the
browser: **Bonsai in this browser**. No server is needed, and nothing leaves
your device.

- Ollama = a local server running next to the IDE.
- Bonsai = a model that runs on this device in a Web Worker, using WebGPU.

The two providers sit behind the same AI interface. You pick one in the AI
panel's **Provider** dropdown (also persisted in Settings → AI). Switching is
explicit — the IDE never silently swaps providers.

## Requirements

- A browser with WebGPU enabled (Chrome/Edge on Windows/macOS, recent Firefox).
- The model weights are downloaded once (~237 MB for Bonsai 1.7B) and cached
  in the browser's Cache Storage. After that, chatting works offline.
- Devices are classified into tiers by RAM (`navigator.deviceMemory`). Bonsai
  is designed to fit small and medium devices (8–16 GB+).

## First run

1. Open the **AI** panel and select **Bonsai (in this browser)**.
2. The panel shows the WebGPU status. If WebGPU is unavailable, it explains why
   and the download button stays disabled.
3. Press **Download model**. Keep the tab open while the weights download. The
   progress bar shows real bytes downloaded and total; if the server does not
   report a total, the UI never invents a percentage.
4. When the model is ready, the status turns green ("Bonsai ready") and the
   input box enables. If it is not ready yet, the panel shows an explicit
   **not ready** state with a one-click "Use Ollama instead" fallback.

## How it works (short version)

- **Runtime**: [bitgpu](https://github.com/stfurkan/bitgpu) (MIT, zero runtime
  dependencies), a WebGPU runtime purpose-built for 1-bit LLMs. It reads the
  model's Q1_0 GGUF directly. See
  [BONSAI_BROWSER_ARCHITECTURE.md](./BONSAI_BROWSER_ARCHITECTURE.md) for the
  full design and the alternatives that were considered.
- **Worker**: inference runs in a dedicated Web Worker over a typed message
  bridge (`createBrowserWorker` + `createBrowserRuntime`). The main thread
  never imports the weight runtime, so the UI stays responsive.
- **Downloads**: streaming fetch into Cache Storage, verified against
  `content-length`; a size mismatch fails loudly rather than running a corrupt
  model. Quota errors are mapped to clear messages.
- **Catalog**: `BONSAI_MODEL_TIERS` pins the model source (repo, revision, file
  URL, bytes). Only the verified 1.7B tier is advertised. Weights come from
  declared sources only.

## Context limits

Each model reports a context window. The context engine derives a safe budget
from it (`budgetForModel`), reserving room for conversation history and the
generated reply:

- Bonsai 1.7B: 32,768-token window (4096 default context), ~237 MB.
- Ollama models: a configurable default window (32k) unless the server reports
  otherwise; the IDE also sends `num_ctx` so the server matches.

When a model's window is smaller than the project context, low-priority
context is dropped first and high-priority content is truncated. The panel
shows `· truncated` and the window size so it is always visible.

## Per-request stats

After each reply the panel shows what the runtime reported: tokens/second,
duration, and output token count (from Ollama's `eval_count`/`eval_duration`
or bitgpu's `ChatResult`). This is displayed locally only — no telemetry.

## Security

- Inference is local (WebGPU in a worker). No cloud backend, no proxy.
- Weights are downloaded from declared sources and verified by size; they are
  never uploaded anywhere.
- Tools stay read-only (current file, diagnostics, open files). No model
  output is ever executed.
- Provider switching is explicit and never silent.

## Developer experience

- **Context Inspector**: the AI panel's "Context inspector" shows what was actually sent — per source (current file, selection, open files, diagnostics, symbols, graph, search), its size, priority, and included/excluded/truncated state, plus the budget (used/available/limit) and model window. Sources can be excluded per message and the preview refreshed; secret paths are never listed as sendable.
- **Code Actions** (Command Palette): Explain Selection/File, Improve Code, Find Bug, Generate Docs/Tests, Refactor — each sends only the narrow selection plus the bounded context, never the whole project. The result is shown in the chat with a diff preview (Original/Suggested, Accept/Reject/Copy). Accept marks the file dirty; you save explicitly.
- **Workspace Commands** (Command Palette): Explain Project, Find TODOs, Find Potential Bugs, Explain Architecture/Dependencies, Summarize Changes, Generate README — each reuses the existing filesystem/symbols/diagnostics/graph/search, respects the model window and secret filtering, and returns file:line references you can click to navigate.
- **Clickable references**: file:line references in AI replies (and diagnostics/symbols) are clickable and open the right tab/line via Monaco (`revealLineInCenter`).
- **Tool approval**: read tools auto-run; write/destructive show an approval card (tool, reason, args, Approve/Reject). Execute remains disabled.

## Troubleshooting

- **"WebGPU is not available"** — enable WebGPU (e.g. Chrome
  `chrome://flags/#enable-unsafe-webgpu` on older versions) or use the Ollama
  provider.
- **Download fails with a storage error** — the browser ran out of quota;
  remove the cached model or free browser storage, then retry. You can also clear the AI cache from Settings → AI & Coder.
- **Slow but working** — on smaller devices decode is slower; the stats line
  shows your real tokens/second.
- **Conversations** — stored locally in `localStorage` (`modcodes.ai.conversations.v1`), at most 50, sanitized. Clear from the AI panel or Settings; no database is involved.