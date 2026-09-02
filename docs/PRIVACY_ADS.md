# Privacy & Ads — Consent Lifecycle

## Consent States

| State | Value | Description |
|-------|-------|-------------|
| `UNKNOWN` | `0` | Initial state — consent required but not yet given |
| `ACCEPTED` | `1` | User consented to personalized ads |
| `DECLINED` | `2` | User declined personalized ads |

## Lifecycle

```
UNKNOWN → ACCEPTED → (user revokes in Settings) → UNKNOWN
UNKNOWN → DECLINED → (user accepts in Settings) → ACCEPTED
```

- Consent is persisted to `localStorage` (`modcodes-ad-consent`)
- Consent banner shown only when state is `UNKNOWN`
- Without consent, AdSense script does NOT load
- Revoking consent removes ad containers and resets state

## Ad Placement Cooldowns

| Placement | Cooldown | Storage Key |
|-----------|----------|-------------|
| `project-open` | 5 minutes | `modcodes-ad-freq-project-open` |
| `dashboard` | 10 minutes | `modcodes-ad-freq-dashboard` |
| `ide-secondary` | 15 minutes | `modcodes-ad-freq-ide-secondary` |

## Data Isolation

Ad components have **zero access** to:
- `source/` (user's project files)
- `.modcodes` (project memory)
- `prompts/` (AI prompts)
- `secrets` (env vars, credentials)

Ad tracking uses anonymous UUIDs. No PII collected.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ADSENSE_PUBLISHER_ID` | Google AdSense publisher ID (for `ads.txt` route) |
| `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` | Client-side publisher ID (used by AdSenseContext) |

## Settings

- **Settings → Privacy**: Accept/Decline/Revoke consent
- **Settings → Data Access**: Shows what ad components can/cannot access
