# MODCODES-CODER Installation Architecture (M80 — design only)

No model is distributed or downloaded in this phase.

## Settings target

```
AI
├── Ollama
├── Bonsai
└── MODCODES-CODER
    ├── Not Installed
    ├── Checking
    ├── Installing (future)
    ├── Installed (future)
    ├── Loading (future)
    ├── Ready (future)
    ├── Unavailable
    ├── Version Mismatch
    └── Error
```

Today the provider is the deterministic stub (`createModcodesCoderProvider`) behind the existing registry; no download occurs.

## Future installation concept (not executed now)

```
User chooses Install MODCODES-CODER
  ↓
Compatibility check (RAM, WebGPU if browser, disk quota)
  ↓
Download manifest (versioned: repo/revision/file/bytes/sha256, declared source)
  ↓
Streaming download → Cache Storage / OPFS (like Bonsai)
  ↓
Checksum verification (sha256, content-length) — mismatch fails loudly
  ↓
Store locally (version key pinned from catalog)
  ↓
Register model (AiModel) + provider capabilities
  ↓
Ready
```

No hosting URL is invented; the catalog remains the source of truth.

## Versioning and integrity

- `modelVersionKey` (`revision:sha256`) pins the exact artifact.
- Stored version is compared on startup; mismatch → `Version Mismatch`.
- Verification is deterministic: size + sha256; no silent fallback.

## Provider registration

- On Ready, `registerProvider(createModcodesCoderProvider({ model }))` makes the model discoverable via `listProviders`/`getModels` like Ollama/Bonsai. AIPanel discovers it without special-case code; capabilities (chat/streaming/local/… ) are shown via `hasCapability`.

## States and UI

- Settings shows the state with an explicit label; installation/download buttons are hidden until a real artifact exists. Errors are surfaced with retry, not auto-retried.

This satisfies M80 without distributing weights or assuming a final model format.

