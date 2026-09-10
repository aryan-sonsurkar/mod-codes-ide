# Privacy-First Telemetry Design

**Status**: Design only — no implementation.
**Date**: 2026-09-10
**Version**: v0.1.0

## Privacy Boundary

MODCODES is a local-first, privacy-first IDE. No user data leaves the browser without explicit consent.

### What is COLLECTED (zero currently)

Nothing. MODCODES v0.1.0 sends zero telemetry, analytics, or tracking data.

### What is PROHIBITED

- Source code
- File contents
- `.modcodes` project memory
- AI prompts or responses
- Terminal output
- Test output
- Secrets, tokens, API keys
- User identification
- Project identification
- Filesystem paths with sensitive information
- localStorage contents
- IndexedDB contents
- Network request contents

### What COULD be safely measured (future consideration)

Only if explicitly consented, opt-in, and local-first:

| Event | Necessary? | Contains user data? | Identifies user? | Leaks source? | Works offline? | Consent required? |
|-------|-----------|---------------------|-------------------|---------------|----------------|-------------------|
| `onboarding_completed` | No | No | No | No | Yes | Yes |
| `project_created` | No | No | No | No | Yes | Yes |
| `ai_provider_selected` | No | No | No | No | Yes | Yes |
| `ai_request_completed` | No | No | No | No | Yes | Yes |
| `test_run_completed` | No | No | No | No | Yes | Yes |

### Requirements for any future telemetry

1. Must be opt-in (explicit consent)
2. Must work without network access
3. Must not collect source, prompts, or project data
4. Must not identify the user
5. Must not identify the project
6. Must be disableable at any time
7. Must not be a functional dependency
8. Must not use Google Analytics, Mixpanel, or similar

### Current implementation

- `src/app/lib/observability/errorCollector.js` — in-memory ring buffer only
- `src/app/lib/observability/logger.js` — console output only
- No `navigator.sendBeacon`
- No `XMLHttpRequest` for tracking
- No external analytics SDKs
