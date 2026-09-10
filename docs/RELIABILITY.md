# Reliability Matrix

**Version**: v0.1.0
**Date**: 2026-09-10

## Subsystem Failure Modes

| Subsystem | Failure Condition | User Behavior | Recovery Path | Logging | Offline Works? | Isolated? |
|-----------|------------------|---------------|---------------|---------|----------------|-----------|
| **Onboarding** | localStorage full | Shows error message | Clear browser data | console.error | Yes | Yes |
| **Project Creation** | File System API unavailable | Shows browser unsupported message | Use Chromium | console.error | Yes | Yes |
| **File System** | Permission denied | Shows permission error | Re-grant access | ErrorCollector | Yes | Yes |
| **Monaco Editor** | Load failure | Shows "Editor failed" | Refresh page | ErrorBoundary | Yes | Yes |
| **Ollama** | Server unreachable | Shows "AI provider unavailable" | Start Ollama | ErrorCollector | Yes (no AI) | Yes |
| **Bonsai/WebGPU** | Not supported | Falls back gracefully | Use Ollama | ErrorCollector | Yes (no AI) | Yes |
| **Terminal Bridge** | Not running | Shows "Terminal unavailable" | Start bridge | ErrorCollector | No (sim) | Yes |
| **Git** | No .git directory | Shows "not a git repo" | Init repo | - | Yes | Yes |
| **Settings** | Corrupted localStorage | Shows settings error | Reset settings | ErrorBoundary | Yes | Yes |
| **AdSense** | Script blocked | Ads don't render | None needed | - | Yes (no ads) | Yes |
| **Consent** | localStorage unavailable | Banner re-appears | Accept/decline again | - | Yes | Yes |
| **AI Context** | Context build fails | Shows error in AI panel | Retry | ErrorCollector | Yes | Yes |
| **Lifecycle** | Agent fails | Shows failure state | Retry milestone | ErrorCollector | Yes (no AI) | Yes |
| **Memory Proposal** | Concurrent modification | Rejects proposal | Refresh and retry | - | Yes | Yes |
| **Usage Tracker** | localStorage full | Limits stop tracking | Clear data | - | Yes | Yes |
| **IndexedDB** | Unavailable | Model cache disabled | None (downgrade) | - | Yes | Yes |
| **AI Streaming** | Connection drops | Shows error | Retry | ErrorCollector | Yes | Yes |

## Key Findings

1. **No P0 reliability issues discovered** — all major subsystems have failure paths
2. **Terminal bridge** is the only subsystem that requires external service
3. **Offline mode** works for all features except Ollama/Bonsai AI
4. **All failures are isolated** — no cascading failures detected
5. **localStorage corruption** can affect settings/projects but has recovery paths
6. **File System Access API** is the primary dependency — requires Chromium

## Recommendations

- P2: Consider localStorage quota monitoring before writes
- P2: Add retry logic for terminal bridge reconnection
- P1: Document Chromium requirement more prominently
