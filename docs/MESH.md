# MESH — the browser harness for local models (design)

**Status:** research / design. Not shipping in v0.2.0.
**One line:** turn any browser tab on any device into a permissioned window onto
any Ollama instance — peer-to-peer, no cloud model, no server in the data path.

## 1. The problem this solves

MODCODES ships as a deployed website (`modcode.vercel.app`) with local AI. The
local part fights the web platform at three layers:

| Layer | What blocks a deployed https page from reaching `http://…:11434` |
| --- | --- |
| Mixed content | https → `http://192.168.x.x` is blocked outright. `http://localhost` is a special-cased "potentially trustworthy" URL in Chrome, but Safari blocks it. |
| CORS | Ollama only allows origins it trusts. Default: localhost. Anything else needs `OLLAMA_ORIGINS` set. |
| Private Network Access | Chrome's PNA preflight requires `Access-Control-Allow-Private-Network: true`, which Ollama does not send. |

Net effect today:

- **Same machine:** works if the user runs `OLLAMA_ORIGINS=… ollama serve` once.
  Fragile, undocumented-feeling, and Safari is out.
- **Phone / second device on the same Wi-Fi:** effectively impossible from a
  plain https page. Mixed content kills `http://LAN-IP` before CORS even runs.
  This is the single biggest gap between "local-first AI" as marketing and as
  reality — your model is stuck on the desktop it was downloaded to.

Every competitor's answer to this is "run a helper daemon" or "we host the
model." Both forfeit the thesis. A daemon is an install; a hosted model is a
quota.

## 2. The insight

**The tab that lives on the same machine as Ollama becomes a gateway — and
everything else talks to that tab, not to Ollama.**

Concretely: WebRTC data channels are origin-agnostic, encrypted end-to-end
(DTLS by spec), and peer-to-peer. A page on `https://modcode.vercel.app` can
open a data channel to another page on `https://modcode.vercel.app` on a
*different device* with zero CORS involvement — both sides are same-origin to
us, and the browser does not mediate data-channel payloads through any
network policy that cares about private IP ranges.

So the host tab does the one thing that needs a local grant (fetch
`http://localhost:11434` — one-time `OLLAMA_ORIGINS`, guided), and relays
requests/responses over the encrypted channel. The guest tab (phone, tablet,
lab PC, second laptop) never touches a LAN address, never sees mixed content,
never needs Ollama configured. It just sees a new provider in the dropdown:
**"Ollama (via Mesh — {host name})"**.

Our only server involvement: a ~50-line serverless function that shuttles
WebRTC setup messages (SDP/ICE) between two tabs that found each other by a
short code. The function sees connection metadata, never a token of
inference. The data path is device→device.

```
 ┌─────────────────────┐                        ┌─────────────────────┐
 │  HOST (laptop)      │   WebRTC data channel  │  GUEST (phone)      │
 │  modcode.vercel.app │◄───── DTLS, P2P ──────►│  modcode.vercel.app │
 │  ┌───────────────┐  │   (prompts & tokens)   │  chat / agent UI    │
 │  │ localhost:11434│  │                        │  no Ollama config   │
 │  │ (Ollama)      │  │                        │  no CORS story      │
 │  └───────────────┘  │                        └─────────────────────┘
 └──────────┬──────────┘
            │ SDP/ICE only (not prompts)
            ▼
   /api/signal  (serverless, TTL'd room, rate-limited)
```

## 3. Why this is the moat (vs Claude Code / Antigravity / Cursor)

Those are harnesses for **someone else's model**. The harness's value is
agent-loop polish, and the ceiling is their capacity notice and your monthly
bill. Your code leaves the machine by design.

Mesh makes the harness for **your model** — and then does the thing local
models never delivered: *the model follows you*. Today "local-first AI" means
"one desktop, one tab, pray the service worker holds." With Mesh:

- **Zero marginal cost holds at every seat.** One Ollama, N devices, $0.
- **No capacity wall exists to hit.** There is no upstream to throttle.
- **The trust model inverts the cloud one.** Claude Code asks you to trust a
  vendor with the keys. Mesh makes the *human* the gate: the host device
  sees every pairing, every model shared, every revocation. The permissioned
  agent gates we already ship (typed approval, blast-radius walls,
  verification receipts) are the same philosophy extended from files to the
  network.
- **The demo no one else can give:** agent runs on the desktop with the big
  GPU; approval comes from your phone on the bus; prompts never touch a
  server. That is not a feature of a cloud harness — it is structurally
  impossible for one.

We don't need to out-model them. We out-harness them *for the machine the
user already owns*.

## 4. Architecture

### 4.1 Signaling — `/api/signal` (Vercel function)

- `POST /api/signal { action: "create" }` → `{ code }` (6–8 chars, Crockford
  base32, no lookalikes). Room stored with TTL 5 min, single-use join,
  per-IP rate limit.
- `POST /api/signal { action: "join", code }` → registers guest; both sides
  then poll/long-poll or POST `action:"send"` with `{ type:"offer"|"answer"|
  "ice", payload }` and `action:"recv"`. Payloads are opaque SDP/ICE blobs.
- Store: in-memory `Map` for dev; Upstash Redis (free tier) or Vercel KV for
  production multi-instance. Nothing else persists. No accounts, no logs of
  payloads.
- Cost: KBs per pairing. Free-tier comfortable. Zero marginal cost intact.

### 4.2 Bridge — `src/app/lib/mesh/`

- `peer.js` — `RTCPeerConnection` factory. ICE servers: LAN-first (host
  candidates cover same-Wi-Fi with the internet down), Google STUN as
  fallback for across-network; no TURN in v1 (symmetric-NAT pairs may fail —
  honest error, not silent hang).
- `protocol.js` — data-channel message shapes:
  `{ v:1, t:"req", id, path, body }` / `{ v:1, t:"chunk", id, text }` /
  `{ v:1, t:"done", id, ms }` / `{ v:1, t:"err", id, message }` /
  `{ v:1, t:"hello", host, models }` / `{ v:1, t:"bye" }`.
  Ordered + reliable channel; chunk sizes ≤ 16 KiB; `bufferedAmountLowThreshold`
  for backpressure on the streaming path (Ollama NDJSON → line-split → chunks).
- `host.js` — the gateway loop. On `req`: validate path against the allowlist
  (`/api/tags`, `/api/show`, `/api/chat`, `/api/generate`, `/api/version`),
  fetch localhost Ollama, stream chunks back. Enforces per-guest turn rate
  and model allowlist. Emits meter events (`kind:"chat"`, `accounting:
  "local"`, `provider:"ollama-mesh"`) so the honest meter covers shared turns
  on the host side too.
- `guest.js` — presents the channel as a normal `{ baseUrl-like }` adapter so
  the existing chat/agent provider layer needs **no loop changes**; Mesh is
  one more entry in the provider registry.

### 4.3 UI

- Host: "Share my Ollama" panel in AI settings → shows code, connected
  devices, per-device revoke, shared-model allowlist, live shared-turn
  count. Reuses the pairing/consent visual language from onboarding.
- Guest: "Join a device" → enter code → safety phrase confirm → the provider
  appears. Until connected, the provider row is honestly labeled "waiting
  for host."
- Failure states are first-class (brand rule): "host closed the tab,"
  "pairing expired," "NAT too strict for P2P — try same Wi-Fi," "Ollama
  not reachable from the host tab" (with the one-time OLLAMA_ORIGINS
  command, per-OS).

### 4.4 Security model (non-negotiables)

1. **Chat completions only in v1.** The agent loop (file reads/writes,
   tool calls, terminal) never crosses the mesh. The phone is a chat
   remote, not an agent remote. (Phone-as-approval-oracle for a
   host-side agent is Phase 3, deliberately: it needs the typed-approval
   flow redesigned for small screens before it is safe.)
2. **Pairing is single-use, short-TTL, code-protected.** Codes are not
   secrets forever; they are secrets for five minutes.
3. **Both sides show a safety phrase** derived from the channel's DTLS
   fingerprint after connect; guest confirms before first token.
4. **Host allowlists models.** Default: none shared until the host picks.
5. **Revocation is instant** (`bye` + close), and the guest UI never
   reconnects without a fresh pairing.
6. **Prompts never touch our servers.** Signaling sees SDP only. Stated in
   PRIVACY_TELEMETRY verbatim.

### 4.5 Phasing

| Phase | Deliverable | Why this order |
| --- | --- | --- |
| 1 — Local Link | OLLAMA_ORIGINS detection, guided one-command fix modal, retry, Safari-honest error | Fixes the same-device story on the *deployed* site this month. Pure UI; no infra. |
| 2 — Mesh v1 | signaling fn, host/guest bridge, chat-only, LAN-first, safety phrase, meter integration | The wedge. Two devices, one model, zero servers in the data path. |
| 3 — Agent oracle | host-side agent + phone approval with typed confirmation | The killer demo. Only after v1 permission UX is proven. |
| 4 — Multi-hop | desktop(large GPU) ← laptop ← phone as a "model fog" | Protocol already relays; ship only if real users want it. |

## 5. What we are explicitly not doing

- Not fine-tuning a model. The harness is the product; models commoditize
  monthly and the user's Ollama already updates itself.
- Not shipping a helper daemon or browser extension. If it needs an install,
  we become every other "local AI" product.
- Not putting our servers in the inference path. Signaling-only or nothing.
- Not claiming cross-internet P2P works everywhere. LAN will be flawless;
  WAN will be honest about NAT.

## 6. Success criteria for Phase 2

- Phone on home Wi-Fi chats with laptop's Ollama through the deployed site,
  < 3 s pairing, streaming tokens, zero Ollama config on the phone.
- Host can revoke mid-stream; guest sees "host ended the session" within
  one round-trip.
- Prompts verifiably absent from our function logs (we log SDP sizes only).
- The honest meter on both devices agrees on turn counts.
