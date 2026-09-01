# Ads Architecture — MODCODES

## M162 Summary: Production Ad Placement & Monetization UX

### Components

- **AdService.js** (`lib/ads/AdService.js`): Mock ad service for development. Round-robin `MOCK_ADS` labeled `Sponsored`. Never accesses project data.
- **adSenseProvider.js** (`lib/ads/adSenseProvider.js`): Google AdSense provider abstraction. Reads from `window.__MODCODES_ADS_CONFIG`. Publisher ID `ca-pub-8259194534475821`.
- **adFrequency.js** (`lib/ads/adFrequency.js`): Frequency control utility. Tracks ad impressions per placement with configurable cooldowns. Uses localStorage persistence.
- **AdContainer.jsx** (`components/Ads/AdContainer.jsx`): React components for ad placement. Responsive, dismissable, accessible, frequency-controlled.
- **AdsProvider.jsx** (`components/Ads/AdsProvider.jsx`): Client wrapper that combines AdSenseProvider + ConsentBanner.
- **ConsentBanner.jsx** (`components/Ads/ConsentBanner.jsx`): GDPR consent banner. Fixed to bottom of screen. Accept/Decline options. Persisted to localStorage.
- **ads.txt route** (`app/ads.txt/route.js`): Dynamic ads.txt endpoint for deployment.

### Ad Placements

| Placement | Location | Cooldown | Behavior |
|-----------|----------|----------|----------|
| `project-open` | Workspace.jsx, above IDE | 5 min | Shows when project opens |
| `dashboard` | ProjectsPage (available) | 10 min | Shows on dashboard |
| `ide-secondary` | IDEWorkspace.jsx, below terminal | 15 min | Collapsible, never blocks editor |

### Frequency Controls

- Each placement has a configurable cooldown (default 5 min)
- Cooldowns tracked in localStorage via `adFrequency.js`
- `canShowAd(placement, cooldownMs)` checks if ad can show
- `recordAdShown(placement)` records impression timestamp
- `resetAdFrequency(placement)` / `resetAllAdFrequency()` clear tracking

### Consent Model

- Consent banner shown on first visit when AdSense is available
- Accept/Decline options persisted to localStorage
- Consent state drives ad rendering (no consent = no ads)
- `ConsentBanner` positioned at bottom, non-blocking

### Integration Points

- **layout.js**: AdSense script in `<head>` via `next/script` with `beforeInteractive`
- **AdsProvider.jsx**: Wraps app in AdSenseProvider + ConsentBanner
- **Workspace.jsx**: `ProjectOpenAd` shown when project selected
- **IDEWorkspace.jsx**: `IDESecondaryAd` shown below terminal area

### Isolation

- Ad components have NO imports from `../project` or `../ai`
- Ads never access source code, .modcodes, prompts, terminal, or secrets
- Ad failure never blocks project opening, Save Gate, agent approval, or test execution
- Usage tracker works independently of ad state

### Privacy

- Consent required by default (GDPR)
- Script loads once, handles error states
- Config summary masks publisher ID
- Unknown token usage remains `null`
