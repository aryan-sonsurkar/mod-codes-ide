# Settings Audit — MODCODES (M103)

**Date:** M103 audit. Traced `Settings UI → SettingsProvider → settingsStorage → consumer → actual behavior`.

**Storage key:** `modcodes-settings`. Defaults in `src/app/lib/settings/settingsStorage.js`.

## Editor

| Setting | Storage key | Default | Consumer | Current behavior | Expected | Status |
|---|---|---|---|---|---|---|
| fontSize | `editor.fontSize` | 13 | `MonacoEditor` `editor.updateOptions({fontSize})` + `TerminalPanel` not | Live update via `updateOptions`, persists, Monaco reflects immediately | Same | ✅ Works |
| tabSize | `editor.tabSize` | 2 | `MonacoEditor` `tabSize` | Live update, persists | Same | ✅ Works |
| wordWrap | `editor.wordWrap` | false | `MonacoEditor` `wordWrap: "on"/"off"` | Live update | Same | ✅ Works |
| minimap | `editor.minimap` | false | `MonacoEditor` `minimap.enabled` | Live update | Same | ✅ Works |
| lineNumbers | `editor.lineNumbers` | true | `MonacoEditor` `lineNumbers: "on"/"off"` | Live update | Same | ✅ Works |
| fontFamily | — | — | Not in storage/UI | Should control `fontFamily` via Monaco `updateOptions` | Add or mark unavailable | ⚠️ Missing — add in M104 |
| insertSpaces | — (derived from tabSize) | true | Monaco `insertSpaces` | Not exposed, but tabSize implies spaces; explicit toggle would be clearer | Add `insertSpaces` boolean | ⚠️ Missing |
| cursorBlinking/cursorStyle | — | — | Monaco `cursorBlinking`/`cursorStyle` | Not exposed | Add or mark unavailable | ⚠️ Missing |
| smoothScrolling | — | — | Monaco `smoothScrolling` | Not exposed | Add | ⚠️ Missing |

**Verdict:** 5/5 visible editor settings work. Missing `fontFamily` etc are not shown, so no fake setting — but to meet "every visible setting must work" we will **add** fontFamily/insertSpaces/cursor/smoothScrolling and wire live.

## Terminal

| Setting | Key | Default | Consumer | Behavior | Status |
|---|---|---|---|---|---|
| fontSize | `terminal.fontSize` | 13 | `TerminalPanel` `style --terminal-font-size` | Live, persists | ✅ Works |
| fontFamily | — | — | Not in UI | Should affect `fontFamily` if terminal supports it (system bridge uses xterm-like, but our panel is div, so CSS `fontFamily`) | ⚠️ Missing — add |
| cursorBlink | — | — | Not exposed | Optional | Mark unavailable |

## Files/Projects

| Setting | Key | Default | Consumer | Behavior | Status |
|---|---|---|---|---|---|
| files.confirmBeforeDelete | `files.confirmBeforeDelete` | true | `FileExplorer` delete flow → `ConfirmDialog` if true | Works | ✅ |
| projects.confirmBeforeDelete | `projects.confirmBeforeDelete` | true | `ProjectsPage` delete | Works | ✅ |
| sort/favorites/view | — (stored in `modcodes-projects` as `favorite`, `lastOpened`) | — | `ProjectsPage` sort by `lastOpened`/`favorite` | Works via project data, no dedicated setting | ✅ No setting needed |

## AI

| Setting | Key | Default | Consumer | Behavior | Status |
|---|---|---|---|---|---|
| provider | `ai.provider` | `ollama` | `AIPanel` `providerId` + `SettingsPage` select | Live, persists, switches provider/session | ✅ |
| baseUrl | `ai.baseUrl` | `http://127.0.0.1:11434` | `createOllamaProvider` + `ConnectionRow` test | Live, validated via `normalizeBaseUrl` | ✅ |
| defaultModel | `ai.defaultModel` | `""` | `AIPanel` `setModel` + `updateSetting` | Persists, used as initial model | ✅ |
| contextBudget | `ai.contextBudget` | 24000 | `getAiContext` → `clampBudget` → `buildContext` | Live, budget derived via `budgetForModel` | ✅ |
| maxToolRounds | `ai.maxToolRounds` | 2 | `AIPanel` → `session.sendMessage` | Live, bounds tool loop | ✅ |
| privacy (no storage) | — | — | `conversationStorage` sanitized | No secrets persisted | ✅ |

## Onboarding

| Setting | Key | Default | Consumer | Behavior | Status |
|---|---|---|---|---|---|
| completed | `modcodes.onboarding.completed` | `null` → show | `Workspace` `isOnboardingCompleted()` | Shows once, skip works, persists | ✅ |

## Implementation plan (M104–105)

1. **M104:** Add `editor.fontFamily` (`"Consolas, Menlo, monospace"` default), `editor.insertSpaces` (true), `editor.cursorBlinking` (`"blink"`), `editor.smoothScrolling` (false) to `DEFAULT_SETTINGS`, `sanitizeSettings`, `SettingsPage` controls, and wire to `MonacoEditor` via `editor.updateOptions` live (no remount). Verify via `MonacoEditor.test` if possible, otherwise manual.
2. **M105:** Add `terminal.fontFamily` to `DEFAULT_SETTINGS` and wire to `TerminalPanel` CSS; ensure `provider`/`defaultModel`/`contextBudget`/`maxToolRounds` already live (add test that changing `defaultModel` triggers new session). Ensure `files.confirmBeforeDelete` actually gates `deleteEntry` (add test).
3. Remove/mark unavailable any setting without consumer — none currently visible, so no fake to remove.

No fake visible settings found; missing fontFamily etc will be added and made functional before launch.

