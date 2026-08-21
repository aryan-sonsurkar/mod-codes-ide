# Accessibility Audit — MODCODES v1 (M130)

Tested: Chrome/Edge + keyboard-only, screen reader semantics where practical.

## Keyboard-only

- **Focus order:** `Tab` cycles Landing→Projects→Settings→Workspace (Explorer, Search, Editor, AI, Terminal, Command Palette). `Shift+Tab` reverse.
- **Shortcuts:** `Ctrl+P` Go to File, `Ctrl+G` Go to Line, `Ctrl+F` Find, `Ctrl+S` Save, `Ctrl+B` Toggle Explorer, `Ctrl+Tab` Recent, `Ctrl+Shift+O` File symbols, `Ctrl+T` Workspace symbols, `Ctrl+Shift+P` Palette, `Escape` closes dialogs/palette, `Enter` selects, `Arrows` navigate.
- **No trap:** `CommandPalette`, `GoTo*Dialog`, `CreateProjectModal`, `Onboarding`, `ConfirmDialog` all close on `Escape` and return focus via `monacoFocusRef`/`focusHandleRef`.

## Focus

- `*:focus-visible { outline: 2px solid var(--focus-color) }` in `globals.css`.
- `Settings` toggles `role=switch aria-checked`, `CommandPalette` `role=dialog aria-modal`, `AIPanel` `role=log aria-live`, `Terminal` `role=log`.

## Dialogs/Tabs/Menus/Tree

- `Dialog` `role=dialog aria-modal`, `Tabs` `role=tablist` + `role=tab aria-selected`, `Tree` nodes `role=treeitem`, `Menus` via `ConfirmDialog` buttons.

## Forms/Settings

- Every `StringRow`/`NumberRow`/`SelectRow` has `label` + `description` + `control` + `current value`; `SelectRow` has `label htmlFor`.

## AI panel/Terminal/Toasts

- `AI panel` messages `role=log`, streaming `aria-live=polite`, error `role=alert`.
- `Terminal` body `role=log`, input `aria-label` via placeholder, `Copy` button `aria-label`.
- `Toast` `role=status` (existing `ToastContext`).

## Contrast/Reduced motion

- Dark palette `primary #F8FAFC` on `workspace #22183A` → 14:1, `secondary #B8B5C5` → 7:1, `accent #8B5CF6` on dark passes. No `prefers-reduced-motion` custom, but animations are only caret blink `1s steps(1)` and progress indeterminate `1.2s`, both minimal and not essential.

## Fixes in M130

- Added `aria-label` to terminal Copy/Clear/Kill, `aria-expanded` to inspector, `aria-modal` to onboarding, `role=list` to capabilities.

