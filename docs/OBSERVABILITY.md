# Observability Architecture

**Version**: v0.1.0
**Date**: 2026-09-10

## What is Monitored

### Error Collection
- Runtime errors (via `window.onerror`)
- Unhandled promise rejections (via `unhandledrejection`)
- React ErrorBoundary catches
- Controlled application errors via `captureError()`
- Ring buffer of last 50 errors in memory

### Structured Logging
- Levels: DEBUG, INFO, WARN, ERROR
- Production: WARN and above only
- Development: all levels
- Sensitive keys auto-redacted
- Long strings truncated

### Health Endpoint
- `/api/health` — version, environment, uptime, error count, service status

## What is NOT Monitored

- Source code
- File contents
- AI prompts/responses
- Terminal output
- Test output
- Secrets/tokens
- User identification
- Project identification
- No external analytics
- No network telemetry

## Architecture

```
Application Code
    ↓
ErrorBoundary (React)     window.onerror / unhandledrejection
    ↓                           ↓
captureError() ←─────────────────┘
    ↓
ErrorCollector (ring buffer)
    ↓
Logger (console output)
    ↓
Provider Adapter (extensible, currently console-only)
```

## Files

| File | Purpose |
|------|---------|
| `src/app/lib/observability/index.js` | Barrel exports |
| `src/app/lib/observability/logger.js` | Structured logging with levels |
| `src/app/lib/observability/errorCollector.js` | Error capture + ring buffer |
| `src/app/lib/observability/globalHandlers.js` | window.onerror/unhandledrejection |
| `src/app/components/Diagnostics/ ObservabilityInit.jsx` | Client-side initialization |
| `src/app/components/Diagnostics/ErrorBoundary.jsx` | React error boundary |

## Extending

To add a provider (e.g., remote error reporting):

```js
import { addErrorHandler } from "./lib/observability/errorCollector.js";

addErrorHandler((errorEntry) => {
  // Send to your provider
  myProvider.report(errorEntry);
});
```

To add a log handler:

```js
import { addLogHandler } from "./lib/observability/logger.js";

addLogHandler((logEntry) => {
  myProvider.log(logEntry);
});
```

## Testing

All observability modules have dedicated tests:

```bash
npx vitest run src/app/lib/observability/
```

Tests verify:
- Log level filtering
- Sensitive key redaction
- Error ring buffer limits
- Handler registration/cleanup
- Global handler initialization
- Error boundary integration
