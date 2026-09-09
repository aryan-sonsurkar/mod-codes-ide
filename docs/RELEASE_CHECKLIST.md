# Release Checklist — MODCODES v0.1.0

Use this checklist before tagging a release.

## Pre-Release

- [ ] `npm run lint` — clean (0 errors)
- [ ] `npm run build` — passes
- [ ] `npm run test:unit` — all tests pass
- [ ] `npm run test:e2e` — all tests pass (clean `.next`, production server)
- [ ] No `TODO` or `FIXME` in production source (excluding docs)
- [ ] No `console.log` in production source
- [ ] Version in `package.json` matches version in `src/app/api/health/route.js`
- [ ] `.env.example` documents all required env vars
- [ ] `.env` is gitignored
- [ ] No hardcoded secrets or API keys in source
- [ ] CSP decision documented in `docs/SECURITY.md`

## Domain & Metadata

- [ ] `metadataBase` matches production domain
- [ ] OpenGraph tags are correct
- [ ] `robots.txt` allows crawling
- [ ] `sitemap.xml` exists and is correct
- [ ] `ads.txt` route returns correct format

## Security Headers

- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy` set
- [ ] `Permissions-Policy` restricts camera/microphone/geolocation

## Release

- [ ] Commit all changes
- [ ] Create git tag `v0.1.0`
- [ ] Push to origin
- [ ] Create GitHub Release
- [ ] Verify deployment at `modcodes.dev`

## Post-Release

- [ ] Monitor error rates
- [ ] Verify health endpoint returns correct version
- [ ] Check AdSense setup (if configured)
