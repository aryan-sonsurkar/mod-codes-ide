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

## Dependency Security

**Last audited**: 2026-09-10
**Next.js**: 16.3.4 (upgraded from 16.2.9 to remediate 11 advisories)
**npm audit**: 0 vulnerabilities (production and dev)

### Remediated in M172
- next@16.2.9 → 16.3.4 (11 advisories including 2 critical RCE)
- postcss (transitive, fixed by next upgrade)
- sharp (transitive, fixed by next upgrade)
- browserslist (transitive, fixed by npm audit fix)
- baseline-browser-mapping (transitive, fixed by npm audit fix)
- brace-expansion, js-yaml (dev-only, fixed by npm audit fix)

## Security Headers

Configured in `next.config.mjs`:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- `Permissions-Policy` — disables camera, microphone, geolocation
- `X-XSS-Protection: 1; mode=block` — legacy XSS filter (retained for older browsers)

## Content Security Policy

Not currently enforced. A CSP may be added in a future release. Key considerations:
- Monaco Editor uses `eval()` internally (requires `unsafe-eval` or nonce)
- WebGPU/Bonsai worker uses dynamic imports
- AdSense requires specific script sources

## Code Security Audit

**Last audited**: 2026-09-10

- No `dangerouslySetInnerHTML` usage
- No `eval()` or `new Function()` usage
- No `document.write` usage
- `innerHTML` used only to clear containers (empty string assignment)
- All `process.env` variables properly scoped (NEXT_PUBLIC_ for client, server-only for API routes)
- No server-side secrets exposed to client bundles
- AI-generated content treated as untrusted

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| No CSP headers | Medium | Security headers (X-Frame-Options etc.) partially compensate. CSP deferred due to Monaco `eval()` requirement. |
| Bridge token in localStorage | Low | Token is for localhost:8787 only, random 256-bit hex, token-gated pairing |
| Terminal bridge executes shell commands | Low | Localhost-only, token-gated, user-initiated |
| AI conversations in localStorage | Low | Client-only, no server persistence |
| Research pipeline fetches user-provided URLs | Low | Browser same-origin policy mitigates SSRF. URLs validated via `new URL()`. |
| AdSense script loaded unconditionally | Low | Script fires but no ads render without consent + config |

## Reporting Security Issues

Open an issue at https://github.com/aryan-sonsurkar/mod-codes-ide/issues with the "security" label.
