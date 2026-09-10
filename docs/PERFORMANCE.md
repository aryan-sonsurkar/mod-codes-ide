# Performance Baseline

**Version**: v0.1.0
**Date**: 2026-09-10
**Updated**: M173 (2026-09-10)

## Measurements

### Build Performance
- **Build time**: ~1.5s compile + ~1.3s static generation (Turbopack, next@16.3.4)
- **Static pages generated**: 4
- **TypeScript check**: 23ms
- **Bundle analysis**: Not run (no @next/bundle-analyzer)

### Test Performance
- **Vitest**: 890 tests in ~7s
- **Playwright E2E**: 151 tests in ~16m (CI, single worker)
- **ESLint**: ~10s (warm)

### Runtime Performance
- **Landing page**: Static (prerendered)
- **Projects page**: Static (prerendered), Workspace dynamically loaded client-side
- **Settings page**: Static (prerendered)
- **Health API**: Dynamic (server-rendered on demand)

### M173 Performance Optimizations

#### Applied
- **Dynamic panel loading**: AIPanel, GraphPanel, GitPanel converted to `next/dynamic` with `ssr: false`
  - These heavy panels (AIPanel: 1238 lines, GraphPanel: workspace graph analysis, GitPanel: git detection) are now code-split into separate chunks
  - Only loaded when their respective right-panel tab is activated
  - Reduces initial workspace bundle size
- **Workspace already dynamically imported**: `projects/page.js` uses `next/dynamic` for the entire Workspace component

#### Verified No-Action
- **Workspace graph computation**: Lightweight O(files) with regex import parsing — fast for typical projects
- **ObservabilityInit**: Minimal (1 useEffect, 1 function call)
- **AdsProvider**: Lightweight wrapper
- **Landing page**: Pure static, no client JS beyond React
- **Font loading**: Geist fonts use `next/font/google` (optimized by Next.js)

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
- **Code splitting**: Workspace, AIPanel, GraphPanel, GitPanel dynamically loaded

### Recommendations

- P2: Consider adding `@next/bundle-analyzer` for detailed bundle analysis
- P2: Consider localStorage quota monitoring
- P2: Consider conversation storage cleanup policy
- No P0 or P1 performance issues discovered
