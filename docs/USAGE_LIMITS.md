# Usage Limits — MODCODES

## Philosophy

MODCODES does not host AI inference. Users run local providers (Ollama, Bonsai).
Usage limits are provider-neutral and honest about what can be measured.

## Token Counting

Providers report tokens differently:

| Provider | Input Tokens | Output Tokens | Total |
|----------|-------------|---------------|-------|
| Ollama | Reported | Reported | Known |
| Bonsai | Unknown | Unknown | Unknown |
| MODCODES-CODER | N/A (stub) | N/A (stub) | Unknown |

When a provider cannot report tokens, usage is recorded as `unknown`.
MODCODES never pretends character count equals tokens.

## Limit Types

### Daily Limit

Resets at midnight (local time).
Tracked per-session, persists in memory only.

### Session Limit

Resets when user starts a new session.
Cleared on explicit reset.

### Project Limit

Accumulates across sessions for a project.
Persists in memory only.

## Limit Behavior

When a limit is reached:

1. **Do NOT crash**
2. **Do NOT silently switch providers**
3. **Do NOT send data elsewhere**
4. Show honest message: "Usage limit reached for this provider."
5. Offer legitimate options:
   - Wait for reset
   - Use another configured provider
   - Use local provider
   - Adjust settings if permitted

## Configuration

```js
const tracker = createUsageTracker({
  limits: {
    daily: 100000,     // null = unlimited
    session: 50000,
    project: 500000,
  }
});
```

## API

```js
// Track usage
tracker.trackUsage({
  provider: "ollama",
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,  // optional, computed if not provided
});

// Check status
const status = tracker.getLimitStatus();
// { status: "ok" } or { status: "limit_reached", type: "daily", message: "..." }

// Get usage breakdown
const usage = tracker.getUsage();
// { session: { total, limit }, daily: { total, limit }, project: { total, limit } }

// Reset
tracker.resetSession();  // clear session only
tracker.resetAll();      // clear everything
```

## Privacy

Usage data stays in memory only.
Usage data is never sent to ads.
Usage data is never sent to external services.
