# Release Checklist — MODCODES v0.1.0

Use this checklist before tagging a release.

**Status: v0.1.0 verified and tagged.** Audits below were executed against the
release commit; results and exceptions are recorded inline.

## Pre-Release

- [x] `npm run lint` — clean (0 errors, 1 pre-existing warning `ErrorBoundary.jsx:144`)
- [x] `npm run build` — passes (Turbopack production build)
- [x] `npm run test:unit` — all tests pass (1100 tests, 94 files)
- [x] `npm run test:e2e` — all tests pass (176 tests, Chromium, fresh production server)
- [x] No `TODO` or `FIXME` in production source (excluding docs) — only the
  "AI: Find TODOs" feature string in `workspaceCommands.js`, not an open item
- [x] No `console.log` in production source — only two hits, both intentional:
  the dev-only branch of `observability/logger.js` (guarded by
  `_environment !== "production"`) and the virtual-FS starter file template
- [x] Version in `package.json` matches `/api/health` — route now falls back to
  `package.json` when `npm_package_version` is unset (fixes `version: "unknown"`
  on Vercel runtime)
- [x] `.env.example` documents all required env vars (AdSense publisher ID and
  bridge port, both optional)
- [x] `.env` is gitignored (`.env*` with `!.env.example` exception); no `.env` present
- [x] No hardcoded secrets or API keys in source — scanner hits are the
  secret-redaction patterns in `logger.js` and their tests/docs
- [x] CSP decision documented in `docs/SECURITY.md` — deferred (Monaco
  `eval()` requirement), headers partially compensate

## Domain & Metadata

- [x] `metadataBase` matches production domain (`https://modcode.vercel.app`)
- [x] OpenGraph tags are correct (`layout.js` metadata export)
- [x] `robots.txt` allows crawling and points at the production sitemap
- [x] `sitemap.xml` exists and is correct (`/`, `/projects`, `/settings`)
- [x] `ads.txt` route returns correct format (404 when publisher ID unconfigured)

## Security Headers

- [x] `X-Frame-Options: DENY` (`next.config.mjs`)
- [x] `X-Content-Type-Options: nosniff`
- [x] `Referrer-Policy` set (`strict-origin-when-cross-origin`)
- [x] `Permissions-Policy` restricts camera/microphone/geolocation

## Release

- [x] Commit all changes
- [x] Create git tag `v0.1.0`
- [x] Push to origin
- [ ] Create GitHub Release — **manual step** (no `gh` CLI in release
  environment; create from the tag in the GitHub UI)
- [x] Verify deployment at `modcode.vercel.app` (custom domain `modcodes.dev` is pending DNS)

## Post-Release

- [x] Monitor error rates (observability logger wired; no admin dashboard yet)
- [x] Verify health endpoint returns correct version (fixed for hosted runtime)
- [x] Check AdSense setup — intentionally unconfigured (ad-free launch)
