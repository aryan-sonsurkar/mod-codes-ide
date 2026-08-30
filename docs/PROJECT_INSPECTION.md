# Project Inspection — MODCODES (M137-M138)

Bounded, reusable service `lib/project/inspect.js` used by New Project (codebase/hybrid), Continue, Research, Agent, Overview.

Inspects: package.json (deps/devDeps, framework detection Next.js/React), lockfiles, tsconfig/next.config/vite, source dirs, entry points (index.js/app.js/page.js/layout.js), routes (`app/**/page.js`), configs, dependency graph via `buildWorkspaceGraph({files})`, README, tests (vitest/jest detection), env templates (.env*), architecture indicators.

Respects: MAX_FILE_SIZE 2MB, SKIPPED_DIRECTORIES, context budgets, performance (walk limited, analysis capped 5 files, fileContents Map sampled). Produces: Project Overview, Technology Stack, Entry Points, Architecture Summary, Dependencies, Testing Setup, Potential Risks, Unknowns, Confidence (low/medium/high). Never reads every file blindly. Recommendation always approval-gated.

Reuses: `workspaceGraph`, `codeIntelligence/analyzer`, `diagnostics`, `relevanceRanking` — no duplication.
