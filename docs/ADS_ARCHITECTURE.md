# Ads Architecture — MODCODES

## M160/M161 Summary

### Components

- **AdService.js** (`lib/ads/AdService.js`): Mock ad service for development. Round-robin `MOCK_ADS` labeled `Sponsored`. Never accesses project data.
- **adSenseProvider.js** (`lib/ads/adSenseProvider.js`): Google AdSense provider abstraction. Reads from `window.__MODCODES_ADS_CONFIG`. Supports `ca-pub-8259194534475821` publisher ID.
- **AdContainer.jsx** (`components/Ads/AdContainer.jsx`): React components for ad placement. Responsive, dismissable, accessible.
- **ads.txt route** (`app/ads.txt/route.js`): Dynamic ads.txt endpoint for deployment.

### Ad Placements

- **ProjectOpenAd**: Shows during project open transition. Non-blocking.
- **DashboardAd**: Shows on projects dashboard.
- **IDESecondaryAd**: Collapsible ad in IDE. Never between editor/terminal, editor/explorer, line numbers, AI input, agent/diff controls.

### Configuration

```js
// In browser console or before app loads:
window.__MODCODES_ADS_CONFIG = {
  ADSENSE_ENABLED: "true",
  ADSENSE_PUBLISHER_ID: "8259194534475821",
  ADSENSE_TEST_MODE: "false",
};
```

### Isolation

- AdService/adSenseProvider have NO imports from `../project` or `../ai`
- Ads never access source code, .modcodes, prompts, terminal, or secrets
- Ad failure never blocks project opening, Save Gate, agent approval, or test execution
- Usage tracker works independently of ad state

### Privacy

- Consent required by default (GDPR)
- Script loads once, handles error states
- Config summary masks publisher ID
- Unknown token usage remains `null`
