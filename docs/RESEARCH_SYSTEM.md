# Research System — MODCODES

Local-first, incremental, provider-neutral (Bonsai/Ollama). UI is `ResearchWorkspace.jsx`; source of truth is `.modcodes#Research` + `#Sources`.

Flow: `idea/Project → runResearch({depth:quick|deep}) → findings → Sources (numbered, URL+accessedAt+summary) → generate PRD`. `Research this deeper` reuses existing `sections.Research` and appends (no restart). `lib/research/pipeline.js` currently mocks web fetch with local findings; prod will use provider session + browser fetch, no remote DB. Stored locally in `.modcodes`, editable.
Sections: Overview, Problem, Users, Existing Solutions, Competitors, Market/Context, Feasibility, Tech Options, Risks, Open Questions, Sources, History.
