# Monetization — MODCODES

## Status: Production AdSense Integration

### Architecture

```
UI Placement → useAdSense() → adSenseProvider.renderAd() → Google AdSense
                ↓
         frequency control (cooldown per placement)
                ↓
         consent check (localStorage persisted)
                ↓
         no project data sent
```

### Production Configuration

```js
// In Vercel Environment Variables:
ADSENSE_PUBLISHER_ID=8259194534475821
ADSENSE_ENABLED=true

// Or in browser console:
window.__MODCODES_ADS_CONFIG = {
  ADSENSE_ENABLED: "true",
  ADSENSE_PUBLISHER_ID: "8259194534475821",
};
```

### Ad Placements

1. **ProjectOpenAd**: Shows when opening a project (5 min cooldown)
2. **DashboardAd**: Available for projects dashboard (10 min cooldown)
3. **IDESecondaryAd**: Below terminal in IDE (15 min cooldown, collapsible)

### Consent & Privacy

- GDPR consent banner on first visit
- Accept/Decline options
- No ads without consent
- Privacy policy link in consent banner

### Frequency Controls

- Per-placement cooldowns prevent excessive ad requests
- Cooldowns persisted in localStorage
- Configurable per placement (5-15 minutes)

### Failure Recovery

- Ad blocked → IDE fully functional
- AdSense unavailable → mock ads or no ads
- Consent denied → no ads, IDE works
- Script error → graceful degradation

### Deployment

1. Set `ADSENSE_PUBLISHER_ID` env var in Vercel
2. Set `ADSENSE_ENABLED` to `true`
3. `ads.txt` served dynamically from `/ads.txt` route
4. AdSense script in `<head>` via `next/script`
5. Meta tag verification: `google-adsense-account: ca-pub-8259194534475821`
