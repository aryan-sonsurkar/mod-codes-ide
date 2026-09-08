# MODCODES Security

## Data Isolation

MODCODES is a local-first IDE. Your code never leaves your machine.

### What stays on your device
- All project files (via File System Access API)
- Settings and preferences (localStorage)
- AI conversation history (localStorage)
- AI model weights (Browser Cache API / IndexedDB)
- Terminal bridge auth token (localStorage, localhost-only)

### What never leaves your device
- Source code
- `.modcodes` project memory
- Prompts and AI responses
- Terminal output
- Git data
- API keys or credentials

### What is sent externally
- AdSense requests (if consented) — page URL and browser info only, never source code
- Ollama requests — localhost only, never leaves your machine
- Bonsai requests — browser WebGPU, never leaves your machine

## Security Headers

Configured in `next.config.mjs`:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- `Permissions-Policy` — disables camera, microphone, geolocation
- `X-XSS-Protection: 1; mode=block` — legacy XSS filter

## Content Security Policy

Not currently enforced. A CSP may be added in a future release. Key considerations:
- Monaco Editor uses `eval()` internally (requires `unsafe-eval` or nonce)
- WebGPU/Bonsai worker uses dynamic imports
- AdSense requires specific script sources

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Bridge token in localStorage | Medium | Token is for localhost:8787 only, random 64-char hex |
| No CSP headers | Medium | Security headers (X-Frame-Options etc.) partially compensate |
| AI conversations in localStorage | Low | Client-only, no server persistence |
| AdSense script loaded unconditionally | Low | Script fires but no ads render without consent + config |

## Reporting Security Issues

Open an issue at https://github.com/anomalyco/opencode/issues with the "security" label.
