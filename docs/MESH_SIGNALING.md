# Mesh v1 — signaling design (Phase 2)

**Status:** design complete, implementation blocked on one choice: which
signaling transport to ship first. Everything below works with the current
₹0 / no-account / no-server-in-the-data-path constraints.
**Module:** `src/app/lib/ai/meshProtocol.js` (room codes, message grammar,
safety phrases) — pure logic, already tested.
**Parent design:** [`MESH.md`](MESH.md) §4, §7.

## 1. What signaling is allowed to see

| Allowed | Never allowed |
| --- | --- |
| Room code, SDP offer/answer, ICE candidates | Prompts, completions, file content |
| Timestamps, rough byte counts for rate limits | Model names, usage history, identity |

The relay is a dumb mailbox with a 5-minute TTL. If it leaks, an attacker
learns that two peers negotiated a connection — not what was said.

## 2. Transport options

| Option | Infra cost | Accounts | Works when | Honest downside |
| --- | --- | --- | --- | --- |
| **A. Manual pair** — host shows offer text/QR, guest pastes answer back | ₹0 | none | Always, incl. internet down | Two copy/paste steps; ugly |
| **B. Third-party relay** (e.g. a public PeerJS-style broker) | ₹0 | none | Both peers online | Third party sees SDP/metadata; availability is theirs |
| **C. Own serverless + KV** (`/api/signal`) | free tier | provider account | Both peers online | KV consistency + cold starts; verify free limits before committing |
| **D. Own WebSocket relay** (small VPS/free host) | ₹0–5 | host account | Both peers online | Ops burden; sleeps on free tiers |

Measured constraint: a real Chrome SDP with ICE is roughly **2–4 KB**. That is
too dense for a scannable QR in practice, so "QR the SDP" is not a real option;
manual pairing means copyable text (or a URL fragment for the offer only).

## 3. Recommendation

Ship **A (manual pair)** first, behind the same wizard UI, then add **C** only
if paired sessions are actually used enough to justify an account.

Why A first:

- It is the only option that keeps the "zero accounts" promise literally true
  and still works on Safari/Firefox and across networks.
- It exercises the entire protocol, safety phrase, and UI without committing to
  a relay vendor.
- When relay C lands later, the manual path stays as the fallback when the
  relay is down — a resilience story, not dead code.

Do **not** ship B by default: silently routing metadata through an unnamed
third party contradicts the trust positioning. B is acceptable as an explicit
"use community relay" toggle with a warning.

## 4. Room lifecycle

```
host                       relay (optional)                 guest
 |-- create room code ----------> store {offer} TTL 5m ----------> |
 |                                                               |
 |<----------------------- join(code) ---------------------------|
 |-- offer (SDP) ----------------> | <----------- poll ----------|
 |<------------------------------ | ------------ answer (SDP) --|
 |<============ ICE trickle both ways via same mailbox =========>|
 |<================ WebRTC data channel (DTLS) =================>|
 |-- safety phrase from fingerprints --------------------------->|
 |<----------------- guest confirms phrase ----------------------|
 |<================ chat tokens, device to device ==============>|
 |-- bye ------------------------> delete room ------------------>|
```

Rules:

1. One host, one guest per room. A second join is rejected.
2. Room dies on `bye`, on TTL expiry, or after the data channel opens (the
   mailbox is no longer needed; ICE completes over the channel's own path).
3. Code is single-use; reuse requires a new room.
4. No auto-reconnect. A dropped channel shows "Disconnected — re-pair" and the
   guest must be re-confirmed.
5. Rate limit: 10 room creations per IP per minute, 60 polls per room.

## 5. Message grammar

`v: 1`, `type: offer | answer | candidate | bye`, `room: <6-char code>`.
SDP ≤ 32 KB, candidate ≤ 2 KB, total ≤ 36 KB. `meshProtocol.js` enforces this
on both ends; the relay must reject anything failing `validateSignalMessage`.

Codes use `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no `0/O/1/I`) so a code read aloud
or typed from a photo cannot be ambiguous.

## 6. Safety phrase

Both peers derive 4 words from the sorted pair of DTLS fingerprints
(`deriveSafetyPhrase`). The guest must see the same phrase on the host screen
before the first token is sent. This catches a malicious relay that substitutes
its own peer connection: it cannot produce the same fingerprints.

If either side cannot read a fingerprint, pairing aborts — no phrase, no
session. There is no "skip verification" path.

## 7. Failure states (must be named in the UI)

| State | Message | Action |
| --- | --- | --- |
| Relay unreachable | "Pairing service is offline." | Switch to manual pair |
| Room expired | "This code expired (5 min)." | New code |
| Room full | "Someone is already connected." | Ask host to revoke |
| Phrase mismatch | "Verification failed — do not continue." | Abort, new room |
| ICE failed | "Networks block direct connections." | Retry; no TURN in v1 |
| Channel closed | "Disconnected. Re-pair to continue." | No auto-reconnect |

**No TURN in v1.** TURN relays media and would put (encrypted) traffic on a
server; that breaks the "no server in the data path" promise. State the
limitation plainly: symmetric NATs may not connect.

## 8. Meter integration

Client-side chat turns over the mesh are local inference on the host machine.
They record `$0.00` in the same receipt format, tagged `transport: "mesh"` so
the receipt is honest about where the tokens were produced. The guest's meter
must say "inference on <host label>", never imply the guest ran the model.

## 9. Build order

1. `meshProtocol.js` (done) + tests.
2. Manual-pair UI: create offer → copy text → paste answer → channel + phrase.
3. Chat-only bridge: reuse the existing Ollama provider over an RPC shim; the
   agent loop stays local to the host tab and is never exposed to the guest.
4. Host allowlist + instant revoke.
5. Only then decide on relay C, using real pairing numbers.

## 10. Open questions

- SDP compression: measure a real offer; only pursue if it gets under ~1.5 KB.
- Free-tier consistency for C: KV-style stores are eventually consistent;
  unsafe for signaling unless reads-after-write are guaranteed.
- Mobile Safari backgrounding: the guest tab must stay foreground during
  pairing; verify behaviour before promising phone support.
