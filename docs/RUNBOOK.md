# MODCODES Operational Runbook

**Version**: v0.1.0
**Date**: 2026-09-10

## "Something is wrong. What do I do?"

### Step 1: Identify the problem

| Symptom | Likely cause | Next step |
|---------|-------------|-----------|
| App won't load | Build/deploy issue | Check Vercel deployment status |
| Health endpoint down | Server crash | Check Vercel function logs |
| E2E tests failing | Stale build / Turbopack state | Rebuild from clean state |
| Unit tests failing | Code regression | Run `npm test` locally |
| Lint failing | Code style issue | Run `npm run lint` locally |
| Ads not showing | Missing env var | Check `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` |
| AI not working | Provider not running | Check Ollama / Bonsai status |
| Terminal not working | Bridge not running | Start terminal bridge |

### Step 2: Check health endpoint

```
GET https://modcodes.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "...",
  "uptime": 123,
  "services": { "ads": "configured" }
}
```

- `status: "ok"` — server is running
- `version` — deployed version (compare to expected release)
- `services.ads` — whether AdSense is configured

### Step 3: Check CI status

Visit: https://github.com/aryan-sonsurkar/mod-codes-ide/actions

All 5 jobs should pass:
1. Lint
2. Build
3. Unit Tests
4. E2E Tests
5. Dependency Audit

### Step 4: Check deployment

Visit Vercel dashboard:
- Deployments tab shows build status
- Production deployment should match latest main commit
- Preview deployments exist for PRs

### Step 5: Common failure modes

#### Stale build / Turbopack state
**Symptom**: E2E tests fail, local dev works
**Fix**:
```bash
rm -rf .next
npm run build
npm run test:e2e
```

#### Port 3000 in use
**Symptom**: `EADDRINUSE` error
**Fix**:
```bash
npx kill-port 3000
```

#### Node version mismatch
**Symptom**: Build fails with syntax errors
**Fix**: Ensure Node.js >= 20.9.0
```bash
node -v
```

#### Missing environment variable
**Symptom**: Ads not loading, `/ads.txt` returns 404
**Fix**: Set `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` in Vercel env vars

### Step 6: Rollback procedure

See [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) for full rollback procedure.

Quick rollback:
1. Go to Vercel dashboard → Deployments
2. Find the last known-good deployment
3. Click "..." → "Promote to Production"

Or via Git:
```bash
git revert <bad-commit>
git push origin main
```

Vercel will automatically deploy the reverted state.

### Step 7: Validate recovery

After any fix:
1. `npm test` — unit tests pass
2. `npm run lint` — lint passes
3. `npm run build` — build succeeds
4. `npm run test:e2e` — E2E tests pass
5. `GET /api/health` — returns `status: "ok"`
6. Manual smoke test in browser

## Observability

### Error logs
- Client-side errors are captured in the browser's ErrorCollector (ring buffer of 50)
- Check browser DevTools Console for structured error output
- Errors include severity, code, name, and component context

### Health endpoint
- `GET /api/health` — operational signal
- Returns version, environment, uptime, service status
- Updated on each request (no caching)

### What is NOT monitored
- No remote error reporting
- No analytics
- No user tracking
- All data stays in the browser

## Known Issues

1. **Port 3000 zombie process**: Stale Next.js server may respawn on port 3000. Only affects local development.
2. **E2E in CI**: `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` not set in CI, so 0 AdSense scripts exist. Tests accept this.
3. **No remote monitoring**: All observability is client-side only.
