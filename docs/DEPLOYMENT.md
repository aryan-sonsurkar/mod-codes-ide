# MODCODES Deployment Guide

## Requirements

- **Node.js**: >= 18.18.0
- **npm**: included with Node.js
- **Browser**: Chrome or Edge (recommended) for full File System Access API + WebGPU support

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start

# Tests
npm test          # unit tests (vitest)
npm run test:e2e  # end-to-end tests (playwright)
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADSENSE_PUBLISHER_ID` | No | Google AdSense publisher ID. Without this, `/ads.txt` returns 404 and no ads load. |
| `MODCODES_BRIDGE_PORT` | No | Port for the terminal bridge server (default: 8787). |

Copy `.env.example` to `.env.local` and fill in values as needed.

## Deployment

### Vercel

1. Connect repository to Vercel
2. Framework: Next.js (auto-detected)
3. Build command: `npm run build` (auto-detected)
4. Output: `.next` (auto-detected)
5. Set `ADSENSE_PUBLISHER_ID` in Vercel environment variables if ads are enabled

### Self-Hosted

```bash
npm run build
npm start
```

The app runs on port 3000 by default. Configure with `PORT` environment variable.

### Docker (not provided)

MODCODES is a client-side application. No Docker setup is required for basic deployment. The app can be served as static files from the `.next` output.

## Health Check

- **Endpoint**: `GET /api/health`
- **Response**: `{ "status": "ok", "timestamp": "...", "version": "0.1.0" }`

## Security Headers

Configured in `next.config.mjs`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-XSS-Protection: 1; mode=block`

## Architecture Notes

- **All data is local**: projects, settings, AI conversations stored in browser localStorage/IndexedDB
- **File access**: uses File System Access API (Chrome/Edge only)
- **AI providers**: Ollama (local server) and Bonsai (WebGPU browser) — both optional
- **No server-side persistence**: the Next.js server is stateless
- **No telemetry**: zero data collection

## Known Limitations

- File System Access API is Chromium-only (Firefox/Safari unsupported)
- Git integration is read-only (branch/commit metadata only)
- Terminal bridge is localhost-only, no HTTPS
- Large files (>2MB) are rejected by the filesystem module
