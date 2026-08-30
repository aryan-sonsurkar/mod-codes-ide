# Privacy + Ads — MODCODES (M150)

Ad system architecturally isolated (`lib/ads/AdService.js` never imported by `filesystem.js`, `project/modcodes.js`, `ai/session.js`, `terminal/*`, `agent/*`).

Never sent to ads: source code, filenames, project names, `.modcodes`, AI prompts/responses, terminal output, env vars, secrets, Git credentials. No targeting on project content. Research before prod (see `ADSENSE_RESEARCH.md`). Mock ads use static `MOCK_ADS` without PII; `reportImpression` counts only, no URL. Production provider requires selection + docs update before enable.
