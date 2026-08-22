# React Render Audit — MODCODES (M134)

**Largest components:** `IDEWorkspace` (1595 lines), `AIPanel` (~1100 lines), `FileExplorer` (~300), `TabBar` (~200), `EditorPane` (130), `MonacoEditor` (311), `SettingsPage` (498), `Workspace` (122).

## Findings

- **IDEWorkspace:** `useTabs` `getSnapshot()` returns new array each `emit`; `tabs` identity changes on every `updateDocument` (even for unrelated path) → `EditorPane`, `FileExplorer`, `SearchPanel`, `AIPanel` (via `getAiContext` `openDocuments` map) all re-render. `getAiContext` creates new `openDocuments` array each call, unstable for `AIPanel` `useCallback` deps.
- **AIPanel:** `messages` state change re-renders entire panel including `BrowserAISection` and `Terminal` (separate right tab, but still mounted). `streamingText` updates 20–50×/s cause `AIPanel` + `IDEWorkspace` to re-render due to `getAiContext` closing over `tabs`.
- **FileExplorer:** `tree` prop new object each `rescan` (sorting creates new children arrays) → entire tree re-renders, not just expanded node. `onFileSelect` unstable (new arrow each render).
- **TabBar:** `tabs` array new ref → all tabs re-render on any tab dirty change.
- **EditorPane/MonacoEditor:** `file` prop new object each `activeTab` change (from `tabs.find`), but `MonacoEditor` correctly reuses `editorRef` and `modelsRef`; however `syncActiveModel` is recreated via `useCallback([])` with stale `fileRef` indirection — okay but `openPathsKey` stringifies all paths on every `tabs` change → `useEffect` prunes models even when only content changed.
- **SettingsPage:** `settings` object new ref on every `updateSetting` (via `saveSettings` → `setSettings` new object) → all `NumberRow` re-render, but cheap.
- **Workspace:** `projects` new array each `addProject` → `ProjectsPage` re-renders, acceptable.

## Unstable patterns

- `useCallback` with missing deps (`setLayout` at 3 sites, `settings` at 1) — fixed in M103–112 batch (now 0 warnings).
- `useMemo` for `terminalProvider` depended on `tree` only, but `bridgeAvailable` was outer scope — fixed via ref + `useEffect` sync.
- Derived state: `activeTab = tabs.find(...)` computed each render (cheap, 50 tabs <0.1ms).
- Duplicate state: `layout` persisted both in `useWorkspaceLayout` and `IDEWorkspace` effect — deduped in M94.

## Plan (M135–137)

- Stabilize `tabs` snapshot via `useMemo` with shallow compare on `tabs` length + `activePath` + `dirty` flags, not new array on every `emit`.
- Memoize `FileExplorer` with `React.memo` + `areEqual` on `tree` reference + `selectedFilePath`.
- Memoize `TabBar` and `EditorPane`.
- Make `getAiContext` stable via `useRankedContext` cache already, plus `openDocuments` derived from `rankedContext.included` not new map each call.
- `MonacoEditor`: keep one editor, reuse models, `updateOptions` only when values actually changed (diff before call), `openPathsKey` only when `openPaths` set changes (already stringified, okay).
- `AIPanel` streaming: batch `onDelta` updates via `requestAnimationFrame` 32ms, not per token.

No blind `useMemo/useCallback` added; only measured paths.

