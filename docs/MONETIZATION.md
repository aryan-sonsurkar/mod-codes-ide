# Monetization — MODCODES

**Status: Foundation only — NOT production AdSense.**

## Current State

- Mock `AdService` provides round-robin static ads
- `AdSenseProvider` abstraction ready for real publisher ID
- All ads isolated from project data, source code, AI context, terminal, secrets
- No production AdSense integration yet

## Architecture

```
UI Placement → AdService.requestAd({placement})
                    ↓
              Provider (mock → AdSense)
                    ↓
              No project data sent
```

## AdSense Configuration

Environment-based configuration:

```js
window.__MODCODES_ADS_CONFIG = {
  ADSENSE_ENABLED: "false",        // Set "true" for production
  ADSENSE_PUBLISHER_ID: "",        // ca-pub-XXXXXXXXXXXXXXXX
  ADSENSE_ADS_TXT_PATH: "/ads.txt",
  ADSENSE_CONSENT_REQUIRED: "true",
  ADSENSE_TEST_MODE: "false",
};
```

## What Is Required for Production

1. Google AdSense account approval (site review)
2. Publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`)
3. `ads.txt` at domain root
4. Privacy policy + consent banner (GDPR/CCPA)
5. Domain with deployed site
6. Policy review (no ads on code surfaces)

## Privacy Boundaries

### Never Sent to Ads

- Source code
- `.modcodes` files
- PRD, Research, Architecture, Decisions
- AI prompts or responses
- Terminal output
- Test output
- Environment variables
- Secrets, passwords, private keys
- File names containing sensitive information

### Ad Placements (Allowed)

1. Projects dashboard
2. Research sponsored section
3. Project-open transition
4. Creation transition
5. Optional secondary IDE area

### Ad Placements (Forbidden)

- Over Monaco editor
- Inside terminal output
- Inside code
- Over error dialogs
- Over approval dialogs
- Over Save Gate
- Over agent changeset review
- Over security warnings
- Blocking development actions

## Consent

Ads require user consent when `ADSENSE_CONSENT_REQUIRED` is true.
Without consent, no ads are rendered.

## Failure Recovery

- Ad loading failure → IDE remains functional
- Ad provider unavailable → graceful fallback
- Invalid publisher ID → provider unavailable
- Script load error → `isAvailable()` returns false
