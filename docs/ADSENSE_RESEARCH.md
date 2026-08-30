# AdSense Research — MODCODES (M149)

**Status: Research only — NOT integrated. Mock ads remain.**

**Official Google sources consulted (conceptual):** AdSense Program Policies, AdSense Help Center, ads.txt spec, Consent Mode, Next.js AdSense guides.

**What Google requires:**
- Google Account + AdSense account approval (site review)
- Publisher ID `ca-pub-XXXXXXXXXXXXXXXX` via `adsbygoogle.js` + `<meta name="google-adsense-account">`
- Site eligibility: accessible, policy-compliant content, no invalid traffic, privacy policy + consent (GDPR/CCPA via Consent Mode v2 / CMP)
- `ads.txt` at domain root `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`
- Policy: no ads on empty/malformed pages, no overlapping/modifying content, labeled Sponsored, responsive formats (`data-ad-format="auto"`, `data-full-width-responsive`)
- SPA/Next.js: load script once, push `adsbygoogle` after route change, avoid duplicate pushes in dev, handle `next/script` lazyOnload
- Testing: never click own ads, use test publisher ID in dev, verification via AdSense dashboard

**What MODCODES has:**
- Mock `lib/ads/AdService.js` isolated from project/AI/terminal data
- Placements: Projects dashboard, Research sponsored, project transitions, collapsible secondary — never inside Monaco/diffs/agent controls

**What is missing for prod:**
- Domain + deployed site (required for site review)
- Publisher ID, ads.txt, privacy policy + consent banner
- `next/script` integration + AdSense component
- Policy review (no ads on code surfaces)

**Privacy implications:** Ads must never receive source/.modcodes/prompts/terminal.Current mock proves isolation; prod must pass `PRIVACY_ADS.md` review.

**Recommended architecture:**
```
UI → AdService.requestAd({placement}) → Provider (mock → AdSense)
                 ↓
            no project data
```
Dev uses mock; prod swaps provider behind same interface after approval.

**Open questions:** Domain for ads.txt? CMP choice? Allowed placements under policy for IDE? Staging vs prod publisher ID?
