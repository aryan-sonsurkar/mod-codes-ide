# Performance Baseline

**Version**: v0.1.0
**Date**: 2026-09-10

## Measurements

### Build Performance
- **Build time**: ~6.8s (Turbopack)
- **Static pages generated**: 4
- **TypeScript check**: 154ms
- **Bundle analysis**: Not run (no @next/bundle-analyzer)

### Test Performance
- **Vitest**: 880+ tests in ~5s
- **Playwright E2E**: 151 tests in 16.1m (CI, single worker)
- **ESLint**: ~60s (cold)

### Runtime Performance
- **Landing page**: Static (prerendered)
- **Projects page**: Static (prerendered)
- **Settings page**: Static (prerendered)
- **Health API**: Dynamic (server-rendered on demand)

### Known Performance Characteristics

#### Acceptable (P2 — no action needed)
- Monaco Editor loads lazily when workspace opens
- AI panel initializes on demand, not at page load
- Context Intelligence ranks candidates in <50ms
- Bonsai model download is one-time, cached in Cache API
- Terminal bridge connects lazily

#### Monitoring Required (P2 — future optimization)
- localStorage reads in 19 files — potential for caching layer
- AI conversation storage grows with usage — no automatic cleanup
- AdSense script loads `afterInteractive` — no impact on initial render
- No duplicate network requests detected
- No unnecessary polling loops detected

### Bundle Size
- **Dependencies**: 5 runtime (next, react, react-dom, lucide-react, bitgpu)
- **Dev dependencies**: 3 (@playwright/test, eslint, vitest)
- **No analytics SDKs** — zero external tracking bundles

### Recommendations

- P2: Consider adding `@next/bundle-analyzer` for detailed bundle analysis
- P2: Consider localStorage quota monitoring
- P2: Consider conversation storage cleanup policy
- No P0 or P1 performance issues discovered
