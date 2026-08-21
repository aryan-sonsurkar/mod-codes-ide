# Design System — MODCODES

**Goal:** Consistent, developer-focused, dark, premium, technical, minimal, purple-accented. No generic SaaS cards, excessive gradients, or huge rounded cards.

## Tokens (`src/app/globals.css`)

**Backgrounds**
- `--sidebar-bg: #18122B`
- `--workspace-bg: #22183A`
- `--surface-bg: #2A1F4D`
- `--background: #0a0a0a` (dark fallback)

**Surfaces & Borders**
- `--surface-bg` for cards/rows
- `--border-color: #3B2E5A`
- `--hover-color: #4a21aa`
- `--active-color: #100232`

**Text**
- `--primary-text: #F8FAFC`
- `--secondary-text: #B8B5C5`
- `--muted-text: #8B8BA7` (new)

**Accent & Semantic**
- `--accent-color: #8B5CF6` (purple)
- `--accent-hover: #7C3AED`
- `--success-color: #22C55E`
- `--danger-color: #EF4444`
- `--warning-color: #F59E0B` (new)
- `--focus-color: #A78BFA` (new, for outlines)

**Spacing / Radius / Shadows**
- `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-xl: 12px`
- `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 12px`, `--space-lg: 16px`, `--space-xl: 24px`
- `--shadow-sm: 0 1px 2px rgba(0,0,0,0.2)`, `--shadow-md: 0 4px 12px rgba(0,0,0,0.3)`, `--shadow-lg: 0 8px 32px rgba(0,0,0,0.4)`

**Typography**
- `--font-sans: Inter, system-ui, sans-serif`
- `--font-mono: Consolas, "Courier New", monospace`
- `--text-xs: 11px`, `--text-sm: 13px`, `--text-base: 14px`, `--text-lg: 16px`, `--text-xl: 22px`

## Usage

- Landing/Projects/Settings/Workspace all use same tokens; no one-off colors.
- Buttons: `background: var(--accent-color)`, hover `var(--accent-hover)`, focus `outline: 2px solid var(--focus-color)`.
- Inputs: `border: 1.5px solid var(--border-color)`, focus `var(--focus-color)`.
- Dialogs: `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-lg)`.
- Spacing: `gap: var(--space-sm)` etc, not hardcoded 6px scattered.

All components audited: Landing, Projects, Settings, Workspace, Explorer, Tabs, Terminal, AI, Dialogs, Toasts, Onboarding — use tokens.

