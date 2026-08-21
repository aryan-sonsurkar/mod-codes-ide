# MODCODES Local Bridge

**Security-sensitive.** This bridge replaces the browser simulation with an **optional** local system terminal. It never bypasses browser security.

## Architecture

```
Browser (IDE)  --localhost:8787-->  Local Bridge (127.0.0.1)  -->  System shell (bash/zsh/powershell/cmd)
```

- Binds **only** to `127.0.0.1` (never `0.0.0.0`).
- Narrow API: `/health`, `/pair`, `/terminals`, `/terminals/:id/execute`, `/terminals/:id/kill`, `/terminals/:id/cwd`.
- Streams stdout/stderr, returns exit code, maintains `cwd`, supports termination.
- Never exposes unrestricted env vars, never persists shell history, never auto-executes.

## Pairing (explicit trust)

```
Bridge starts → generates 32-byte hex token → logs to console
User approves → browser prompts for token → stored in localStorage modcodes.bridge.token
Browser sends x-bridge-token on every request → bridge validates
```

- Token is `crypto.randomBytes(32).toString("hex")`.
- Short-lived session: restart bridge to rotate token.
- No `?token=1234`, no hardcoded secret.

## Protocol

- `start` → `POST /terminals {cwd}` → `{id,cwd}`
- `input` → `POST /terminals/:id/execute {command,cwd}` → `{stdout,stderr,exitCode}`
- `stdout`/`stderr`/`exit` → JSON response
- `kill` → `POST /terminals/:id/kill`
- `cwd` → `GET /terminals/:id/cwd`
- `resize` → `POST /terminals/:id/resize` (stub)

## TerminalService backend

`SystemTerminalBackend` implements the same contract as `browserSimulationBackend`:

```js
createSystemTerminalBackend({ bridgeUrl, getBridgeToken }) → { label, reset, execute }
```

`TerminalService` (`lib/terminal/TerminalService.js`) is reused; `IDEWorkspace` switches backends based on bridge availability.

## Fallback

If bridge unreachable: UI shows **"Local terminal bridge is not connected. Using browser simulation."** — never pretends system terminal is active.

## AI security

System terminal is **USER-ONLY**. `AI execute` permission remains disabled (`permissionAllows` check). Future AI shell would require explicit permission model.

## Running

```bash
node tools/modcodes-bridge/server.js
# or
MODCODES_BRIDGE_PORT=8787 node tools/modcodes-bridge/server.js
```
