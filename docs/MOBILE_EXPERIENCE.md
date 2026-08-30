# Mobile / Small Screen — MODCODES (M151)

Desktop IDE is primary. Mobile does NOT replicate full IDE.

Responsive breakpoints verified: 320/375/768/1024/1440/1920 (see `globals.css`, `IDEWorkspace.css`, `ResearchWorkspace.css`).

**Useful mobile workflows:**
- Projects browsing + search + favorites
- Continue Project (Overview, health, recommendation)
- Research (read sections, add URLs, quick/deep, source cards)
- PRD (read/edit via textarea, evidence links)
- Roadmap (read milestones)
- Project Overview (phase switch)
- AI conversation (provider/model select, streaming, context inspector)
- Lightweight file view (read-only where practical; edit via Monaco where keyboard usable)

**Not forced:** full Monaco editing, multi-tab drag, terminal PTY, agent controls on <768px — collapses to drawer, panels stack. Preserves desktop experience untouched. Tested via responsive CSS + `useWorkspaceLayout` clamp.

