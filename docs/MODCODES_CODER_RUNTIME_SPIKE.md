# MODCODES-CODER Runtime Spike (M90)

Status: Spike — evaluated, no production runtime committed. Stub provider remains `modcodes-coder:dev`.

## What was inspected

- Existing runtimes: Bonsai browser runtime (bitgpu, WebGPU, Worker, Q1_0 GGUF ~237 MB, 32k context) and Ollama local server (OpenAPI `POST /api/chat`, streaming JSON lines, `num_ctx` option).
- Browser capabilities available in MODCODES: WebGPU capability detection (`detectWebGpuCapability`), `navigator.deviceMemory`, Worker bridge (`createBrowserWorker/createBrowserRuntime`), Cache Storage.
- File System Access API is for user files, not model weights; weights stay in Cache Storage/OPFS as with Bonsai.
- No real MODCODES-CODER weights, download URL, or quantized format were invented. No hosting URL is hardcoded.

## Benchmark categories considered

- WebGPU inference in Worker (like Bonsai/bitgpu)
- WASM inference in Worker
- Local server (like Ollama) accessed via fetch

Only WebGPU/Worker paths were inspected for browser feasibility; no download was performed.

## Measurements actually observed

- `npm test` context build via `measureContextBuild`: 0–5 ms for typical 3-file context, 10–20 ms for 100-file synthetic ranking (see `contextPerformance.test.js`).
- Bonsai reference measurements from `docs/BONSAI_BROWSER_ARCHITECTURE.md` remain the only real runtime numbers (237 MB, 32k window, tier small/medium). No MODCODES-CODER model size, load time, first-token latency, or tokens/sec is reported because no model is loaded.
- `navigator.deviceMemory` and WebGPU `maxStorageBufferBindingSize` are read when available; otherwise shown as Unknown.

## Adapter design (spike)

```
MODCODES-CODER Provider
  ↓
Runtime Adapter (interface: createEngine/createChat, like Bonsai)
  ↓
Local Model Runtime (future: WebGPU or WASM; today: stub)
```

- Interface is provider-agnostic; AIPanel never imports runtime.
- `src/app/lib/ai/providers/modcodesCoderRuntime.js` is the spike adapter: it exposes `checkRequirements()` (RAM, WebGPU, Worker support) and `getMeasurements()` (all Unknown until a real artifact exists). No fake metrics are returned.

## Decision

Keep `createModcodesCoderProvider` stub. Do not pretend the real model works. Document requirements, version pinning (`modelVersionKey`), and future Cache Storage flow in `MODCODES_CODER_ARCHITECTURE.md`/`MODCODES_CODER_INSTALLATION.md`.

