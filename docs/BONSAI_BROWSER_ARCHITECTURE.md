# MODCODES — Bonsai Browser AI Architecture (Modules 48–57)

Status: Modules 48–57 are implemented — architecture spike (M48), WebGPU
capability detection (M49), Bonsai catalog + weight cache + model registry
(M50), browser runtime + provider (M51–M52), model downloads (M53), provider
selection/fallback + settings (M54), context limits per provider (M55),
instrumentation + device tiers (M56), and integration docs + security
regression (M57). For the user-facing feature, see [BROWSER_AI.md](./BROWSER_AI.md).

This document records the evaluation of browser runtimes for running **Bonsai
1.7B** (a ~1.7 B parameter, 1-bit / Q1_0 model on the Qwen3 architecture) in
the browser, the selected runtime, and the intended provider design.

## Decision summary

| Concern | Decision |
| --- | --- |
| Runtime | **bitgpu** v0.19.1 (MIT, zero runtime dependencies, ESM) |
| Model | `prism-ml/Bonsai-1.7B-gguf` → `Bonsai-1.7B-Q1_0.gguf` |
| Artifact format | GGUF Q1_0 (g128), read directly by the runtime (no conversion) |
| Tokenizer | Qwen3 tokenizer (`tokenizer.json` + `tokenizer_config.json`) |
| Compute | WebGPU with compute shaders (required) |
| Execution thread | Web Worker (the runtime has no DOM dependencies) |
| Weights storage | Cache Storage API (never localStorage) |
| Conversation/KV cache | IndexedDB snapshots (runtime `save()`/`restore()`) |

## Why bitgpu

bitgpu is a fast, dependency-free WebGPU runtime for **1-bit (binary-weight)
LLMs** in the browser. Its reference targets are exactly the Bonsai family
(1.7B / 4B / 8B on the Qwen3 architecture, plus the 27B Qwen3.5 hybrid), and it
is gated bit-exact against the reference forward pass on real hardware.

Specifics that matter for this product:

- **Direct GGUF Q1_0 loading.** `fromGguf(url)` fetches only the GGUF header via
  HTTP ranges (a few MB, never the weights), builds the manifest in memory, and
  streams the weights from wherever they already live (e.g. the Hugging Face
  Hub). No conversion step, no re-hosting of weights. This directly satisfies
  the requirement to load the standard `Bonsai-1.7B-Q1_0.gguf`.
- **Streaming and cancellation.** Token-by-token output, EOS stop, and
  `AbortSignal` cancellation are first-class. The chat layer also supports
  `<think>` routing and a bounded think budget.
- **Tool calling.** The Qwen3 JSON tool protocol is enforced token-by-token
  (a call cannot be malformed). Execution is always the caller's code — the
  runtime "never executes anything, never loops, never retries". This maps
  cleanly onto MODCODES' existing read-only Tool Registry.
- **Worker support.** No DOM dependencies; WebGPU is available in workers, so the
  whole stack can run off the main thread (the project ships a worker example).
- **Typed failure modes.** `WebGPUUnavailableError` (no WebGPU / no adapter) and
  `GpuOutOfMemoryError` (weight upload / KV growth) are exported, plus an
  `engine.lost` promise for device loss. These map directly onto the provider
  error normalization in Module 51.
- **Resource control.** `kvCache: 'f32' | 'f16' | 'q8'`, `maxSeqLen`, and
  `overflow: 'sinks'` (rolling window with attention sinks) keep memory bounded;
  `engine.dispose()` releases GPU resources.
- **License and maintenance.** MIT, actively maintained, zero runtime
  dependencies (WGSL kernels inlined at build time).

### Version and artifacts

- Package: `bitgpu` v0.19.1 (MIT), `npm install bitgpu`, ESM-only.
- Runtime files: the engine inlines its WGSL; the chat layer inlines
  `@huggingface/tokenizers` and `@huggingface/jinja` (both Apache-2.0) into
  `dist/chat.js`. Importing the plain engine never loads chat code.
- Model weights: `Bonsai-1.7B-Q1_0.gguf`, **248,302,272 bytes** (from the
  `prism-ml/Bonsai-1.7B-gguf` release manifest). This is the real file size; the
  UI will read it from model metadata, not from a hardcoded marketing number.
- Tokenizer: `tokenizer.json` + `tokenizer_config.json` from the
  `onnx-community/Bonsai-1.7B-ONNX` repo (same base model).

## Evaluation criteria — recorded

### bitgpu

- Browser compatibility: WebGPU with compute required. Chrome / Edge desktop
  (subgroups when uniform 32/64, else workgroup fallback), Safari 26+ (macOS/iOS,
  Metal), Firefox (workgroup fallback, higher dispatch overhead), Android Chrome
  (device-dependent). Firefox is usable but slow; Safari needs 26+.
- Next.js / React: ESM package, no DOM access at import time, no side effects —
  safe to import in a client component / worker. Engine creation must be guarded
  to the browser (never during SSR).
- Bundle size: zero runtime dependencies; WGSL and text libraries inlined. Adds a
  few hundred KB to a client/worker bundle, not megabytes of WASM.
- Model loading: streaming fetch with progress; supports Cache Storage reuse.
- Streaming: yes, token callbacks + async-generator `stream()`.
- Cancellation: `AbortSignal`; clean disposal.
- Memory usage: GPU-resident decode; KV cache `f32` ~224 KB/position on 1.7B,
  `f16` ~1/2, `q8` ~1/4. `maxSeqLen` + `overflow:'sinks'` bound memory.
- Model caching: browser cache via Cache Storage (weights) and IndexedDB
  (KV-conversation snapshots via `save()`/`restore()`).
- Tokenizer: Qwen3 BPE via inlined `@huggingface/tokenizers`.
- Context support: `maxSeqLen`; conversation snapshots survive reloads; rolling
  window for unbounded chats.
- License: MIT.
- Maintenance: active (v0.19.1, 2026); release gate is a real-GPU bit-exactness
  verification.
- API quality: typed (published `.d.ts`), explicit errors, small surface.
- Ease of integration: two functions (`createEngine` + optional `createChat`);
  DI-friendly runtime adapter for tests.
- Mobile: Android Chrome where WebGPU is exposed; VRAM limits apply. Safari iOS
  26+ on Apple GPUs.
- Failure behavior: typed errors (`WebGPUUnavailableError`,
  `GpuOutOfMemoryError`), `engine.lost` for device loss, validation of the
  manifest "loudly" at load.

### Benchmark claims (recorded as claims, not guarantees)

bitgpu's README reports (point-in-time, Apple M-series, Chrome 150, 2026-07,
same 1-bit Bonsai-1.7B weights in both engines): decode **23.8 tok/s** vs
transformers.js **17.7 tok/s**; prefill (156-token prompt) **0.9 s** vs **5.6 s**.
A third-party test of Bonsai 1.7B q1 on an M3 Pro (Chrome 148) measured
transformers.js at ~66 tok/s decode and wllama at ~60 tok/s decode with ~750 ms
load/init. These are **not** guarantees for MODCODES; Module 56 will measure on
real hardware before claiming anything.

## Rejected alternatives

1. **MLC / web-llm** — MLC-compiled runtime format, not GGUF; Bonsai's 1-bit
   Q1_0 export is not a supported prebuilt MLC config. Requires a conversion
   pipeline and does not stream the standard GGUF artifact. Rejected.
2. **transformers.js (ONNX Runtime / WebGPU)** — needs the ONNX q1 export
   (`onnx-community/Bonsai-1.7B-ONNX`, ~290 MB) instead of the GGUF; slower
   prefill in bitgpu's own comparison; heavier runtime. Kept as a documented
   fallback for CPU/WASM paths, not the primary runtime. Rejected as primary.
3. **wllama (llama.cpp WASM + WebGPU)** — direct GGUF support and a CPU fallback,
   and Bonsai 1.7B runs in a single 512 MB shard. But: WASM runtime is heavier,
   Q1_0 kernel support depends on the Prism ML llama.cpp fork integration, there
   is a single-file size limit (irrelevant for 1.7B, relevant for 4B/8B), and it
   lacks bitgpu's enforced tool-calling and device-loss typing. Rejected as
   primary; documented as a possible CPU-fallback avenue.
4. **0xBitNet** — purpose-built WebGPU runtime, but for BitNet b1.58 ternary
   (i2_s) models, a different family than Bonsai Q1_0. Not Bonsai-compatible.
   Rejected.

## Browser requirements

- WebGPU with compute shader support (`navigator.gpu` present, a usable adapter
  and device). Module 49 implements detection with the states
  `unsupported | available | initializing | failed | lost | unknown`.
- WebGPU availability is **not** sufficient — the manifest must be validated and
  the model must actually load. Capability detection and model/runtime
  compatibility are checked separately.
- Chrome / Edge 113+ (desktop recommended), Safari 26+, Firefox (slow path),
  Android Chrome (device-dependent). Recommended: Chromium on desktop.

## Model artifact format

- **Weights:** `Bonsai-1.7B-Q1_0.gguf` (GGUF Q1_0, group size 128), 1-bit sign
  packing with shared f32 scales per 128-weight group, Qwen3 architecture
  (28 decoder blocks, GQA 16Q/8KV, SwiGLU, RoPE, RMSNorm), vocab 151 936,
  context length 32 768.
- **bitgpu sidecar:** a small `manifest.json` (architecture contract + every
  tensor mapped to a byte range) and a ~30 KB `aux` file. bitgpu commits
  ready-made manifests for Bonsai under `models/bonsai-1.7b-gguf` (servable via
  jsDelivr); alternatively `fromGguf(url)` builds the manifest in memory from
  the GGUF header only, so one URL is the whole setup. Prefer the committed
  manifest when one exists (smaller, caches better).
- **Tokenizer:** Qwen3 `tokenizer.json` + `tokenizer_config.json` (from the ONNX
  repo; same base model).
- **Sizes (real, from manifests):** weights 248 302 272 bytes; bitgpu aux ~30 KB;
  manifest a few KB; chat-template files a few KB. Total browser download ≈ the
  weight file. The UI reads these from model metadata.

## Model download flow

1. User enables Browser AI and picks the model (explicit user action — never an
   automatic download).
2. WebGPU capability check (Module 49) → if unsupported, explain why.
3. Model registry (Module 50) reports state (`notDownloaded | downloading |
   downloaded | loading | ready | error | evicted | incompatible`) and reads the
   real artifact metadata (size, checksum, source, version).
4. Cache lookup: if the weights are already in Cache Storage and the version
   matches, load directly (cache hit). Otherwise stream-download with honest
   progress (bytes downloaded / total; unknown totals show "Downloading…", no
   invented percentage).
5. On success: mark `downloaded`; on failure: `error` (network, quota, checksum,
   interruption) with a retry path. Incomplete downloads are detected and not
   treated as cache hits.
6. Load runtime → load model → `ready` → chat.

## Caching strategy

- **Weights:** Cache Storage API (`caches.open("modcodes-ai-v1")`), keyed by
  model version/checksum. Never in localStorage. Cache hits avoid re-download.
- **Conversation / KV cache:** IndexedDB via the runtime's structured-cloneable
  `save()`/`restore()` snapshots (KV buffers are not JSON-safe), enabling
  resume-after-reload without re-prefill. Optional; only when the user has an
  active conversation.
- **Versioning:** cache key includes the model manifest revision + checksum so a
  changed artifact invalidates cleanly.
- **Quota:** handle storage-quota failures gracefully (`QuotaExceededError`) and
  expose them as `downloadFailed` / `storageQuota` style errors with a clear
  message; never assume unlimited disk.

## Security model

- Model weights are downloaded from **declared sources only** (the
  `prism-ml/Bonsai-1.7B-gguf` release, pinned revision, SHA-256 recorded). No
  silent substitution of third-party mirrors.
- Inference runs **entirely locally** on the user's GPU via WebGPU. No context is
  sent to any remote inference endpoint.
- After model download, source code/context stays in the browser.
- The provider never auto-downloads: every download requires explicit user
  action.
- Tool execution stays behind the existing read-only Tool Registry + permission
  system; the runtime's tool-call enforcement guarantees well-formed calls and
  the app executes them (or not) on its own terms.

## Future modcodes-coder integration

`BrowserBonsaiProvider` implements the same provider contract as
`OllamaProvider` (`getModels`, `chat`, `streamChat`, `getCapabilities`,
`testConnection`), so the AI Session, Context Engine, Tool Registry, AIPanel,
command palette, settings, and IDEWorkspace do not change when a future
`registerProvider(modcodesCoderProvider)` is added. The provider registry is the
single integration point.

## Intended module layout

- M49 `webgpu.js` — capability service (`src/app/lib/ai/browser/`).
- M50 `catalog.js` + `cache.js` — browser model registry & cache.
- M51 `provider.js` — `BrowserBonsaiProvider` behind the provider contract
  (runtime injected as an adapter for tests).
- M52 `worker.js` — worker bridge protocol.
- M53–M57 — onboarding UX, provider selection, context limits, performance,
  documentation.

## Module 48 success criteria

- [x] Runtime evaluated (bitgpu, wllama, transformers.js, MLC, 0xBitNet).
- [x] Bonsai artifact format understood (GGUF Q1_0 + manifest/aux + tokenizer).
- [x] WebGPU requirements documented.
- [x] Runtime selected (bitgpu v0.19.1).
- [x] Alternatives documented with rejection reasons.
- [x] No final UI.
- [x] No production provider yet.
- [x] Existing 198 tests remain passing.
