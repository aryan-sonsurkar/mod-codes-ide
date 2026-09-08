# M167 Implementation Plan: AI Provider + Bonsai Experience Hardening

**Status**: Planning  
**Date**: Sep 7, 2026  
**Goal**: Make the AI experience production-ready without making MODCODES an AI hosting company.

## Executive Summary

M167 hardens the provider abstraction, Bonsai browser AI, Ollama local AI, chat/streaming,
error recovery, context intelligence, and lifecycle management. The core principle: if adding
a new AI provider tomorrow requires changing 3+ existing systems, the architecture needs work.

## Architecture Gap Analysis (Phase 1 Findings)

### Current State
- **Provider contract**: `getModels()`, `chat()`, `streamChat()`, `getCapabilities()`, `testConnection()`
- **State management**: Ad-hoc strings (`checking`, `connected`, `not-ready`, `unavailable`) in AIPanel
- **Capabilities**: Two separate registries (`KNOWN_PROVIDER_CAPABILITIES` in provider.js, `CAPABILITIES` in capabilities.js)
- **Bonsai states**: Rich `MODEL_STATES` in registry.js but not fully surfaced in UI
- **Error handling**: `AI_ERRORS` enum exists but error messages aren't always user-friendly
- **No retry/backoff**: Transient failures show error with no recovery path
- **No WebGPU device loss recovery**: `WEBGPU_STATES.lost` exists but isn't handled in chat flow

### Key Question
> "If we wanted to add another AI provider tomorrow, how many existing MODCODES systems would need to change?"

**Answer after M167**: Primarily provider implementation + registration + config/UI. The provider
contract, state machine, capabilities, error mapping, and lifecycle should be provider-agnostic.

---

## Implementation Phases

### Group 1: Provider Foundation (Phases 2-3)

#### Phase 2: Provider State Machine

**Goal**: Define a unified provider state enum that both Ollama and Bonsai implement.

**Current Problem**: AIPanel uses `checking`, `connected`, `not-ready`, `unavailable` strings.
Bonsai has `MODEL_STATES` (8 states) in registry.js. WebGPU has `WEBGPU_STATES` (6 states).
These don't compose cleanly.

**Plan**:
1. Create `src/app/lib/ai/providerStates.js` with unified states:
   ```
   PROVIDER_STATES = {
     unknown,        // Initial state, no check yet
     checking,       // Probing connection/capabilities
     ready,          // Connected and model available
     busy,           // Model loading or initializing
     unavailable,    // Connection failed or not reachable
     degraded,       // Connected but with warnings (e.g., no models)
     unsupported,    // Provider not available in this environment
   }
   ```
2. Add `getState()` method to provider contract (optional, backward-compatible)
3. Update `assertProviderShape()` to accept `getState` if provided
4. Update AIPanel to use `PROVIDER_STATES` instead of ad-hoc strings
5. Add `state` field to `getCapabilities()` return value
6. Create `providerStateLabel(state, providerId)` for UI display

**Files to modify**:
- `src/app/lib/ai/providerStates.js` (new)
- `src/app/lib/ai/provider.js` (add getState to contract)
- `src/app/lib/ai/providers/ollama.js` (implement getState)
- `src/app/lib/ai/browser/provider.js` (implement getState)
- `src/app/components/Workspace/content/AIPanel.jsx` (use unified states)

**Verification**: All existing tests pass, AIPanel renders correctly with new states.

#### Phase 3: Provider Capabilities Unification

**Goal**: Single source of truth for provider capabilities.

**Current Problem**: Two separate registries:
- `provider.js`: `KNOWN_PROVIDER_CAPABILITIES = {chat, streaming, tools, embeddings, vision}`
- `capabilities.js`: `CAPABILITIES = {chat, streaming, cancellation, tools, vision, largeContext, local, browser, fileEditing, structuredOutput, statistics}`

**Plan**:
1. Merge into `capabilities.js` as the single source of truth
2. Remove `KNOWN_PROVIDER_CAPABILITIES` from `provider.js`
3. Import from `capabilities.js` in provider implementations
4. Ensure `normalizeCapabilities()` handles all known capabilities
5. Update provider implementations to use merged set

**Files to modify**:
- `src/app/lib/ai/capabilities.js` (add missing from provider.js)
- `src/app/lib/ai/provider.js` (remove local set, import from capabilities)
- `src/app/lib/ai/providers/ollama.js` (update imports)
- `src/app/lib/ai/browser/provider.js` (update imports)
- `src/app/lib/ai/browser/runtime.js` (update imports)

**Verification**: `normalizeCapabilities()` returns correct set for all providers.

---

### Group 2: Bonsai Hardening (Phases 4-6)

#### Phase 4: Bonsai Environment Detection

**Goal**: Robust WebGPU detection with recovery from device loss.

**Current Problem**: `detectWebGpuCapability()` runs once on mount. If WebGPU device is lost
(`WEBGPU_STATES.lost`), there's no re-initialization path.

**Plan**:
1. Add `watchDeviceLost()` integration to AIPanel
2. On device lost, transition to `unavailable` state with recovery option
3. Add "Reinitialize WebGPU" button when device lost
4. Log adapter info (vendor, architecture) for debugging
5. Add `deviceLost` state to provider state machine
6. Expose adapter limits in BrowserAISection for transparency

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (device lost handling)
- `src/app/components/Workspace/content/BrowserAISection.jsx` (recovery UI)
- `src/app/lib/ai/browser/webgpu.js` (add reinitialize function)

**Verification**: Simulate device loss, verify recovery button appears and works.

#### Phase 5: Bonsai Download/Install UX

**Goal**: Robust download experience with resume, retry, cancel, and storage awareness.

**Current Problem**: Download can fail mid-stream. No resume capability. No storage pressure
handling. Progress may be inaccurate if Content-Length is missing.

**Plan**:
1. Add download resume: skip cached files (already done in download.js)
2. Add cancel button during download (already has abort support)
3. Add retry on failure (already has retry button)
4. Add storage pressure detection: if `navigator.storage.estimate()` shows low space,
   warn user before download
5. Add download speed calculation (bytes/sec)
6. Add ETA display during download
7. Add "Remove model" confirmation dialog before eviction
8. Handle partial downloads: show which files are cached vs pending

**Files to modify**:
- `src/app/components/Workspace/content/BrowserAISection.jsx` (UX improvements)
- `src/app/lib/ai/browser/download.js` (speed calculation, storage check)
- `src/app/lib/ai/browser/cache.js` (storage estimation)

**Verification**: Download, cancel, retry, resume all work. Storage warning appears when low.

#### Phase 6: Bonsai Model Lifecycle

**Goal**: Clean load/unload with memory management.

**Current Problem**: `loadModel()` in provider.js creates engine + chat. `dispose()` exists
but isn't called on provider switch. Memory not explicitly freed.

**Plan**:
1. Add `dispose()` call when switching away from Bonsai provider
2. Add `dispose()` call on AIPanel unmount
3. Add model memory estimation: show "Using ~X MB GPU memory"
4. Add explicit unload button: "Free GPU memory" without removing cache
5. Handle `model.dispose()` errors gracefully
6. Add state transition: `ready` → `unloading` → `notDownloaded` (for unload)
7. Add `unloading` state to MODEL_STATES

**Files to modify**:
- `src/app/lib/ai/browser/registry.js` (add unloading state)
- `src/app/lib/ai/browser/provider.js` (dispose on unload)
- `src/app/components/Workspace/content/BrowserAISection.jsx` (unload button)
- `src/app/components/Workspace/content/AIPanel.jsx` (dispose on switch/unmount)

**Verification**: Switch providers, verify Bonsai memory freed. Unload button works.

---

### Group 3: Ollama Hardening (Phases 7-8)

#### Phase 7: Ollama Connection Health

**Goal**: Detect stale connections and auto-recover.

**Current Problem**: `testConnection()` runs once on mount. If Ollama restarts or network
changes, the connection goes stale silently.

**Plan**:
1. Add periodic health check: ping `/api/version` every 30s when connected
2. On health check failure, transition to `unavailable` with retry
3. Add exponential backoff on retry: 1s, 2s, 4s, 8s, max 30s
4. Add connection quality indicator: green (healthy), yellow (slow), red (failed)
5. Add "Reconnect" button when connection lost
6. Add request timeout handling: show timeout error with retry option

**Files to modify**:
- `src/app/lib/ai/providers/ollama.js` (health check, backoff)
- `src/app/components/Workspace/content/AIPanel.jsx` (health indicator, reconnect)

**Verification**: Kill Ollama during chat, verify connection lost detection and reconnect.

#### Phase 8: Ollama Model Discovery

**Goal**: Better model listing with refresh, size info, and tag parsing.

**Current Problem**: Model list fetched once on connect. No refresh. Size info from
`/api/tags` not always accurate. Tag parsing is basic.

**Plan**:
1. Add "Refresh models" button in model selector
2. Show model size in MB/GB in dropdown
3. Show quantization level (Q4, Q5, Q8, etc.)
4. Add model family detection (qwen, llama, codellama, etc.)
5. Sort models by size (ascending) by default
6. Add model search/filter in dropdown
7. Show "Pull model" hint when no models available

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (refresh, search, display)
- `src/app/lib/ai/providers/ollama.js` (model metadata enrichment)

**Verification**: Refresh button works, models show size/quantization, search filters.

---

### Group 4: Chat & Streaming (Phases 9-11)

#### Phase 9: AI Chat State/Streaming

**Goal**: Robust streaming with proper state transitions.

**Current Problem**: `CONVERSATION_STATES` has `idle`, `generating`, `complete`, `error`,
`cancelled`. Streaming uses `requestAnimationFrame` for updates. No intermediate states
like `prefill` or `toolExecution`.

**Plan**:
1. Add `CONVERSATION_STATES` enum to a shared location (not just AIPanel)
2. Add `prefill` state: model is processing input before first token
3. Add `toolExecution` state: model requested tool, executing
4. Add `streaming` state: receiving tokens (distinct from `generating`)
5. Add streaming robustness: handle mid-stream disconnects
6. Add partial response recovery: if streaming stops, save what we have
7. Add streaming speed display: "12.4 tok/s" during generation

**Files to modify**:
- `src/app/lib/ai/conversation.js` (shared states)
- `src/app/components/Workspace/content/AIPanel.jsx` (state transitions)
- `src/app/lib/ai/session.js` (intermediate states)

**Verification**: Stream starts, shows prefill → streaming → toolExecution → complete.

#### Phase 10: AI Cancellation

**Goal**: Clean abort propagation with partial response handling.

**Current Problem**: `session.stop()` calls `controller.abort()`. Partial text may be lost.
Tool execution doesn't check abort signal.

**Plan**:
1. Add `signal` propagation to tool runner
2. Add abort check before each tool execution
3. Save partial response on abort (already done for cancelled state)
4. Add "Generation stopped" message with option to retry
5. Add abort reason tracking: user-initiated vs timeout vs error
6. Ensure streaming generator respects abort signal

**Files to modify**:
- `src/app/lib/ai/session.js` (signal propagation)
- `src/app/lib/ai/browser/provider.js` (abort handling in stream)
- `src/app/lib/ai/providers/ollama.js` (abort handling in stream)
- `src/app/components/Workspace/content/AIPanel.jsx` (abort UI)

**Verification**: Cancel mid-stream, verify partial response saved, no errors.

#### Phase 11: Error Mapping/Recovery

**Goal**: User-friendly error messages with clear recovery actions.

**Current Problem**: Errors show raw messages like "Ollama request failed with status 500".
No retry guidance. No distinction between transient and permanent errors.

**Plan**:
1. Create `src/app/lib/ai/errorMessages.js` with user-friendly mappings:
   - `connectionFailed` → "Cannot reach Ollama at localhost:11434. Is it running?"
   - `modelNotFound` → "Model not found. Pull it with: ollama pull <model>"
   - `timeout` → "Request timed out. The model may be overloaded."
   - `rateLimited` → "Too many requests. Wait a moment and retry."
   - `unsupported` → "WebGPU is not available. Use Chrome or Edge."
   - `notReady` → "Model not downloaded yet. Download it first."
   - `gpuOutOfMemory` → "GPU ran out of memory. Try a smaller model."
2. Add `retryable` flag to errors (already exists in AiError)
3. Show "Retry" button for retryable errors
4. Show "Learn more" link for permanent errors
5. Add error context: include provider name, model name in error display

**Files to modify**:
- `src/app/lib/ai/errorMessages.js` (new)
- `src/app/lib/ai/errors.js` (add message mapping)
- `src/app/components/Workspace/content/AIPanel.jsx` (error display)

**Verification**: Each error type shows user-friendly message with correct action.

---

### Group 5: Context & Actions (Phases 12-14)

#### Phase 12: Context Intelligence Integration

**Goal**: Provider-aware context sizing.

**Current Problem**: Context budget is calculated from model context length. Bonsai models
have fixed context sizes. Ollama models vary. No provider-specific adjustments.

**Plan**:
1. Add provider-specific context budget rules:
   - Bonsai: use model's declared `contextLength` directly
   - Ollama: use `num_ctx` option or model's reported context length
2. Add context overflow detection: warn when approaching limit
3. Add context truncation visibility: show "Context truncated to 8k tokens"
4. Add context source priority: current file > selection > open files > diagnostics
5. Ensure context rebuilds correctly on provider switch

**Files to modify**:
- `src/app/lib/ai/context/` (budget rules)
- `src/app/components/Workspace/content/AIPanel.jsx` (context display)

**Verification**: Context budget adjusts per provider, truncation visible.

#### Phase 13: Context Visibility

**Goal**: Context inspector shows accurate, real-time information.

**Current Problem**: Context inspector shows sections and counts. May not reflect
actual token usage or truncation.

**Plan**:
1. Add token count estimation per section
2. Add "Refresh context" button that rebuilds from current editor state
3. Add context source toggles (already exists)
4. Add context export: "Copy context as JSON" for debugging
5. Show context budget utilization bar: "2.1k / 8k tokens used"

**Files to modify**:
- `src/app/components/Workspace/content/AIContextInspector.jsx`
- `src/app/lib/ai/contextIntelligence.js`

**Verification**: Context inspector shows accurate counts, refresh works.

#### Phase 14: AI Actions

**Goal**: Action history is accurate and provider-attributed.

**Current Problem**: Action history tracks "Improve code" actions. Provider and model
info included but not always accurate.

**Plan**:
1. Add action types: `chat`, `improveCode`, `findBugs`, `explainCode`, `generateDocs`
2. Add provider attribution: show which provider/model was used
3. Add action duration tracking
4. Add action success/failure status
5. Add "Replay action" button: re-run same action with same context
6. Add action export: "Copy as markdown"

**Files to modify**:
- `src/app/lib/ai/actionHistory.js` (enrichment)
- `src/app/components/Workspace/content/AIActionHistory.jsx` (UI)

**Verification**: Actions show correct provider, model, duration, status.

---

### Group 6: Lifecycle & Safety (Phases 15-18)

#### Phase 15: Lifecycle Integration

**Goal**: Provider and session cleanup on unmount and provider switch.

**Current Problem**: `session.stop()` called on clear. Provider `dispose()` not called
on switch. Bonsai engines may leak memory.

**Plan**:
1. Add cleanup on AIPanel unmount:
   - Stop active generation
   - Dispose Bonsai provider if active
   - Clear streaming state
2. Add cleanup on provider switch:
   - Stop active generation
   - Dispose old provider if Bonsai
   - Clear session messages
   - Reset UI state
3. Add cleanup on page unload:
   - Abort all active requests
   - Dispose Bonsai engines

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (cleanup effects)
- `src/app/lib/ai/browser/provider.js` (dispose)

**Verification**: Switch providers, no memory leaks. Unmount, no errors.

#### Phase 16: Save Gate Protection

**Goal**: Ensure Save Gate blocks unauthorized memory writes.

**Current Problem**: Save Gate is the sole persistence path for .modcodes. AI should
never write directly to filesystem.

**Plan**:
1. Verify AI actions never bypass Save Gate
2. Verify agent changes go through approval flow
3. Verify context intelligence never writes to filesystem
4. Add audit log: "AI attempted to write [file]" (blocked)
5. Verify no direct `fs.writeFile` calls from AI modules

**Files to verify** (read-only audit):
- `src/app/lib/ai/agent/` (agent changes)
- `src/app/lib/ai/codeActions.js` (code actions)
- `src/app/lib/ai/context/` (context builders)

**Verification**: Grep for `fs.writeFile` in AI modules, verify none exist.

#### Phase 17: Usage Integration

**Goal**: Usage tracker properly connected to AI panel.

**Current Problem**: `useUsageTracker` hook exists. `UsageIndicator` component exists.
Connection may have gaps.

**Plan**:
1. Verify usage tracking on every chat completion
2. Verify usage persists across page reloads
3. Verify usage resets on day boundary
4. Add usage display in AI panel: "Session: 1.2k tokens"
5. Add usage breakdown by provider

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (usage display)
- `src/app/hooks/useUsageTracker.js` (verify integration)

**Verification**: Usage tracks correctly, persists, resets daily.

#### Phase 18: Usage Limits

**Goal**: Daily/session/project limits enforced.

**Current Problem**: Limits exist in usage tracker. Enforcement may not block chat.

**Plan**:
1. Check limits before sending message
2. Show "Limit reached" message when exceeded
3. Add "Reset session" button to clear session count
4. Add limit configuration in Settings
5. Add limit warning at 80% usage

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (limit check)
- `src/app/components/Workspace/content/AISetup.jsx` (limit config)

**Verification**: Chat blocked when limit reached, reset works.

---

### Group 7: UX & Settings (Phases 19-23)

#### Phase 19: Explicit Provider Switching

**Goal**: No silent fallbacks, confirm on switch.

**Current Problem**: Provider switch immediately clears conversation. No confirmation.
No warning about unsaved context.

**Plan**:
1. Add confirmation dialog: "Switch provider? Current conversation will be cleared."
2. Show "Unsaved context" warning if context inspector has data
3. Add "Switch and save" option: persist conversation before switch
4. Disable switch during active generation
5. Show provider capabilities comparison on switch

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (switch confirmation)

**Verification**: Switch shows confirmation, blocks during generation.

#### Phase 20: Security/Data-Flow Audit

**Goal**: Provider boundary, no secret leaks.

**Current Problem**: AI never receives secrets. Provider boundary should be verified.

**Plan**:
1. Audit: No `process.env` in AI modules
2. Audit: No `localStorage` reads of secrets in AI modules
3. Audit: No `fetch` to external URLs (except Ollama localhost and Bonsai model CDN)
4. Audit: Provider boundary — UI never touches `fetch("ollama...")` directly
5. Audit: Context never includes `.env`, `node_modules`, or sensitive files
6. Document audit results

**Files to audit** (read-only):
- `src/app/lib/ai/**/*.js`
- `src/app/lib/ai/providers/*.js`
- `src/app/lib/ai/browser/*.js`

**Verification**: Grep for `process.env`, `fetch(` external URLs, `.env` in AI modules.

#### Phase 21: Privacy UX

**Goal**: Telemetry-free confirmation, local-only messaging.

**Current Problem**: MODCODES is local-first. Users should see confirmation that
no data leaves their machine.

**Plan**:
1. Add "Local only" badge in AI panel: "All inference runs on your machine"
2. Add privacy note in Settings: "No data is sent to external servers"
3. Add network activity indicator: show when Ollama or Bonsai is active
4. Add "Export conversation" button: save chat as markdown
5. Verify no analytics/telemetry in AI modules

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (privacy badge)
- `src/app/components/Settings/AISettings.jsx` (privacy note)

**Verification**: No telemetry code in AI modules, privacy badge visible.

#### Phase 22: AI Settings

**Goal**: Provider config persistence, model selection memory.

**Current Problem**: Settings persisted via `SettingsContext`. Provider and model
selection saved. May need validation.

**Plan**:
1. Verify provider selection persists across reloads
2. Verify model selection persists per provider
3. Add Ollama base URL config in Settings
4. Add Bonsai model selection in Settings
5. Add "Reset to defaults" button
6. Validate settings on load: if invalid, reset to defaults

**Files to modify**:
- `src/app/contexts/SettingsContext.jsx` (validation)
- `src/app/components/Settings/AISettings.jsx` (UI)

**Verification**: Settings persist, invalid settings reset to defaults.

#### Phase 23: Offline Experience

**Goal**: Graceful degradation when offline.

**Current Problem**: Ollama requires local server. Bonsai requires WebGPU.
No offline-specific handling.

**Plan**:
1. Detect `navigator.onLine` status
2. When offline, show "Offline mode" banner
3. When offline, disable Ollama (requires server)
4. When offline, check if Bonsai model is cached (can work offline)
5. When offline, offer "Use cached Bonsai model" if available
6. Add offline indicator in AI panel

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (offline detection)
- `src/app/components/Workspace/content/BrowserAISection.jsx` (cached model)

**Verification**: Go offline, verify Ollama disabled, Bonsai works if cached.

---

### Group 8: Performance & Testing (Phases 24-27)

#### Phase 24: Performance

**Goal**: Streaming latency, model load time, context build speed.

**Plan**:
1. Measure streaming latency: time to first token
2. Measure model load time: Bonsai engine creation
3. Measure context build time: context intelligence calculation
4. Add performance budget: first token < 2s, model load < 10s
5. Optimize context build: cache unchanged sections
6. Optimize streaming: batch updates, avoid unnecessary re-renders

**Files to modify**:
- `src/app/components/Workspace/content/AIPanel.jsx` (rendering optimization)
- `src/app/lib/ai/contextIntelligence.js` (caching)

**Verification**: First token < 2s, model load < 10s, no jank during streaming.

#### Phase 25: Browser/E2E Testing

**Goal**: Playwright tests for AI panel.

**Plan**:
1. Create `e2e/16-ai-provider.spec.js`:
   - Test provider switching
   - Test model selection
   - Test connection status display
   - Test error messages
   - Test cancellation
   - Test context inspector
2. Create `e2e/17-bonsai.spec.js`:
   - Test WebGPU detection
   - Test model download
   - Test model load/unload
   - Test device lost recovery

**Files to create**:
- `e2e/16-ai-provider.spec.js`
- `e2e/17-bonsai.spec.js`

**Verification**: All E2E tests pass.

#### Phase 26: Unit/Integration Tests

**Goal**: Vitest for provider, session, capabilities.

**Plan**:
1. Add tests for `providerStates.js` (state transitions)
2. Add tests for unified `capabilities.js` (normalization)
3. Add tests for `errorMessages.js` (message mapping)
4. Add tests for provider `getState()` implementations
5. Add tests for session abort propagation
6. Add tests for usage limit enforcement

**Files to create/modify**:
- `src/app/lib/ai/providerStates.test.js` (new)
- `src/app/lib/ai/errorMessages.test.js` (new)
- `src/app/lib/ai/capabilities.test.js` (expand)
- `src/app/lib/ai/session.test.js` (expand)

**Verification**: All vitest tests pass, coverage > 80% for new code.

#### Phase 27: Regression Protection

**Goal**: Snapshot tests, contract tests.

**Plan**:
1. Add provider contract snapshot test
2. Add capabilities snapshot test
3. Add error mapping snapshot test
4. Add provider state machine contract test
5. Ensure existing snapshots still pass

**Files to create/modify**:
- `src/app/lib/ai/__snapshots__/` (new)
- Existing test files (expand)

**Verification**: Snapshots match, contract tests pass.

---

### Group 9: Finalization (Phases 28-31)

#### Phase 28: Documentation

**Goal**: AI architecture docs, provider guide.

**Plan**:
1. Update `docs/AI_ARCHITECTURE.md` with new state machine
2. Update `docs/BROWSER_AI.md` with lifecycle changes
3. Create `docs/PROVIDER_GUIDE.md`: how to add a new provider
4. Update `docs/KEYBOARD_SHORTCUTS.md` with AI shortcuts
5. Add inline JSDoc for new functions

**Files to modify**:
- `docs/AI_ARCHITECTURE.md`
- `docs/BROWSER_AI.md`
- `docs/PROVIDER_GUIDE.md` (new)

**Verification**: Docs accurate, no stale information.

#### Phase 29: Final Security Review

**Goal**: Provider boundary, error boundary, permission check.

**Plan**:
1. Re-audit provider boundary after all changes
2. Verify error boundary catches all AI errors
3. Verify permission check on all tool executions
4. Verify no new secret leak vectors
5. Verify Save Gate integrity

**Files to audit** (read-only):
- All modified AI files
- All modified component files

**Verification**: Security checklist passes.

#### Phase 30: Final Validation

**Goal**: Full E2E run, build check, lint check.

**Plan**:
1. Run full vitest suite: `npx vitest run`
2. Run full E2E suite: `npx playwright test`
3. Run build: `npm run build`
4. Run lint: `npm run lint`
5. Fix any failures

**Verification**: All checks pass.

#### Phase 31: Final Report/Git

**Goal**: Commit, push, summary.

**Plan**:
1. Stage all changed files
2. Commit with message: "M167: AI Provider + Bonsai Experience Hardening"
3. Push to main
4. Create summary report

**Verification**: Git clean, pushed, summary accurate.

---

## Execution Order

**Week 1**: Phases 2-6 (Provider Foundation + Bonsai)
**Week 2**: Phases 7-11 (Ollama + Chat/Streaming)
**Week 3**: Phases 12-18 (Context + Lifecycle + Safety)
**Week 4**: Phases 19-27 (UX + Testing)
**Week 5**: Phases 28-31 (Finalization)

## Risk Mitigation

1. **Bonsai complexity**: Browser AI is inherently complex. Start with Phase 4-6 early.
2. **WebGPU variability**: Test on Chrome, Edge, Firefox (if available).
3. **Ollama versioning**: Test with Ollama 0.1.x and 0.2.x if possible.
4. **Performance**: Profile streaming early, optimize if needed.
5. **Testing**: E2E tests for AI are hard. Focus on unit tests for logic, E2E for UX.

## Success Criteria

1. Adding a new provider requires only: provider implementation + registration + config/UI
2. All error messages are user-friendly with clear recovery actions
3. Bonsai download/retry/cancel/resume all work reliably
4. Ollama connection health is monitored and auto-recovered
5. Streaming is robust with proper abort handling
6. All tests pass (vitest + playwright)
7. Build passes
8. No security regressions
