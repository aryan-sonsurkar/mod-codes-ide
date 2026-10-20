# MESH — the browser harness for local models (design)

**Status:** Phase 1 (Local Link, incl. QR) shipped in v0.2.0. Phase 2 signaling design complete — see [`MESH_SIGNALING.md`](MESH_SIGNALING.md). Phases 3–4 research / design.
**One line:** turn any browser tab on any device into a permissioned window onto
any Ollama instance — no daemon, no extension, no server in the data path.

## 1. What the web platform actually allows (verified October 2026)

Three separate gates get conflated. Only one of them is a hard wall:

| Gate | Reality | Consequence |
| --- | --- | --- |
| **Mixed content** | Per MDN, loopback (`http://localhost`, `http://127.0.0.1`) is a *secure origin* — an https page may fetch it with no mixed-content block. Private LAN IPs are not exempt by default, **but** Chrome's Local Network Access permission exempts permission-gated requests when the hostname is a private IP literal, a `.local` name, or the fetch is annotated `targetAddressSpace: "local"`. | Same-device: fine everywhere. Cross-device: Chrome only, with one permission prompt. Safari/Firefox: blocked. |
| **Local Network Access (LNA)** | Chrome 142 (Sept 2025) ships a per-site prompt — "Look for and connect to any device on your local network" — gating public→local/loopback requests. Grant once per site, stored per origin. | The **deployed site can reach LAN Ollama with zero install.** |
| **CORS** | Ollama allows only `127.0.0.1` / `0.0.0.0` origins by default. Any other origin, including `https://modcode.vercel.app`, is rejected unless listed in `OLLAMA_ORIGINS`. | Irreducible: the host grants our origin once. No browser trick bypasses it — LNA does **not** waive CORS. |

**The honest baseline:** deployed site + local Ollama = **one-time host grant +
one browser permission prompt.** No daemon, no extension, no tunnel, no account.
That is already less friction than every web "local AI" product that ships a
companion server.

## 2. The two-command grant (make it feel like nothing)

Host machine, once:

```bash
OLLAMA_HOST=0.0.0.0:11434        # reachable by other devices (skip for same-device only)
OLLAMA_ORIGINS=https://modcode.vercel.app   # trust the deployed site
```

Per-OS presentation (copy buttons, not prose):

- **macOS app:** `launchctl setenv OLLAMA_HOST …` / `launchctl setenv OLLAMA_ORIGINS …`, restart Ollama.
- **Linux:** `systemctl edit ollama.service` → `Environment=` lines, `daemon-reload`, `restart`.
- **Windows:** Quit Ollama → "Edit environment variables for your account" → add both → relaunch.

Then a **Local Link wizard** that names each failure precisely instead of
showing "failed to fetch":

| Symptom | Diagnosis | UI |
| --- | --- | --- |
| `TypeError` on first fetch, no HTTP | LNA prompt denied or never shown | "Allow local network access" + retry |
| `TypeError` after LNA granted | CORS — host grant missing | The exact command above, with our origin pre-filled |
| HTTP 11434, empty model list | Up, no models | "Run `ollama pull <model>`" |
| HTTP 403/404 | Ollama behind a proxy | Proxy guidance |
| Timeout | Wrong LAN address | Re-discover, see §3 |

This wizard is pure frontend — it ships without any new infrastructure.

## 3. Transport A — Direct LAN (Chrome 142+, the primary path)

This is the path that needs no signaling server at all.

1. Host opens the deployed site. The wizard finds Ollama on loopback.
2. **Address discovery without asking the user for IPs:** the host tab opens a
   throwaway `RTCPeerConnection` and reads its own host ICE candidates. Chrome
   obfuscates those as random `.local` mDNS names (resolvable on the LAN and
   explicitly LNA-exempt); other browsers expose the `192.168.x.x` literal
   (also LNA-exempt). Either form is a valid fetch target.
3. Host shows a QR code + the address (shipped).
4. Guest (phone, tablet, lab PC) scans it, the deployed site fetches
   `http://<host>:11434` → LNA prompt once → tokens stream directly
   device→device. No server sees prompts; works with the internet down as long
   as both devices are on the same Wi-Fi.

Trade-off, stated honestly in the UI: **Chrome/Edge only.** Safari and Firefox
have neither LNA nor a LAN-IP mixed-content exemption. Those users take
Transport B.

## 4. Transport B — Mesh (any network, Safari included)

WebRTC data channel between the host tab and the guest tab; a ~50-line
serverless function shuttles SDP/ICE only (TTL'd, single-use code). The host
tab is the gateway to Ollama, so the guest never touches a LAN address and no
mixed-content or LNA gate applies. Covers across-the-internet P2P and every
browser with data channels. Same host grant as §2. This is the original Mesh
design, retained for cross-network and non-Chromium guests. Concrete protocol,
room lifecycle, and the relay decision are in
[`MESH_SIGNALING.md`](MESH_SIGNALING.md).

```
 ┌─────────────────────┐                        ┌─────────────────────┐
 │  HOST (laptop)      │   WebRTC data channel  │  GUEST (any device) │
 │  modcode.vercel.app │◄───── DTLS, P2P ──────►│  modcode.vercel.app │
 │  ┌───────────────┐  │   (prompts & tokens)   │  no Ollama config   │
 │  │ localhost:11434│  │                        │  no CORS story      │
 │  └───────────────┘  │                        └─────────────────────┘
 └──────────┬──────────┘
            │ SDP/ICE only (never prompts)
            ▼
   /api/signal  (serverless, TTL'd room, rate-limited)
```

## 5. Transport C — Bookmarklet (the zero-CORS escape hatch)

If the host refuses environment variables entirely: a bookmarklet run while
the tab is on `http://localhost:11434` executes **in the localhost origin**.
That origin is same-origin to the API, so **CORS never applies at all** — the
one hard wall disappears. It then relays to the guest over a data channel or
WebSocket.

- Cost: one drag to the bookmarks bar, no install, no admin rights.
- Caveat: depends on Ollama's built-in page staying CSP-free; version-fragile.
  Ship it as a labeled power-user escape hatch, not the default.

## 6. Why this is the moat (vs Claude Code / Antigravity / Cursor)

Those are harnesses for **someone else's model**. The harness's value is
agent-loop polish, and the ceiling is their capacity notice and your monthly
bill. Your code leaves the machine by design.

Mesh makes the harness for **your model** — and then does the thing local
models never delivered: *the model follows you*.

- **Zero marginal cost holds at every seat.** One Ollama, N devices, $0.
- **No capacity wall exists to hit.** There is no upstream to throttle.
- **The trust model inverts the cloud one.** Claude Code asks you to trust a
  vendor with the keys. Mesh makes the *human* the gate: the host device sees
  every pairing, every shared model, every revocation. The permissioned agent
  gates we already ship (typed approval, blast-radius walls, verification
  receipts) are the same philosophy extended from files to the network.
- **The demo no one else can give:** agent runs on the desktop with the big
  GPU; approval comes from your phone on the bus; prompts never touch a
  server. Structurally impossible for a cloud harness.

We don't need to out-model them. We out-harness them *for the machine the user
already owns*.

## 7. Security model (non-negotiables)

1. **Chat completions only in v1.** The agent loop (file reads/writes, tool
   calls, terminal) never crosses a transport. The phone is a chat remote, not
   an agent remote. (Phone-as-approval-oracle is Phase 3, deliberately: it
   needs the typed-approval flow redesigned for small screens first.)
2. **Pairing is single-use, short-TTL** (5 min), rate-limited per IP.
3. **Both sides show a safety phrase** derived from the DTLS fingerprint
   (Mesh) or the wizard session (Direct); guest confirms before the first token.
4. **Host allowlists models.** Default: none shared until the host picks.
5. **Revocation is instant** and the guest never auto-reconnects.
6. **Prompts never touch our servers.** Every transport keeps the data path
   device→device; the signaling function sees SDP sizes only.
7. **Direct mode exposes exactly one port to the LAN**, only while the host's
   tab is open, and only for the Ollama API paths on the allowlist.

## 8. Phasing

| Phase | Deliverable | Why this order |
| --- | --- | --- |
| 1 — Local Link | Detection, per-OS grant wizard, LNA permission handling, LAN address discovery, direct transport | **Shipped in v0.2.0.** Pure frontend; no infra. QR deferred to a later patch. |
| 2 — Mesh v1 | manual-pair first, then optional relay; host/guest bridge, chat-only, safety phrase, meter integration | Design complete in [`MESH_SIGNALING.md`](MESH_SIGNALING.md). Cross-network + Safari parity. |
| 3 — Agent oracle | host-side agent + phone typed-approval remote | The killer demo. Only after v1 permission UX is proven. |
| 4 — Multi-hop | desktop (large GPU) ← laptop ← phone as a "model fog" | Protocol already relays; ship only if real users want it. |

## 9. What we are explicitly not doing

- Not fine-tuning a model. The harness is the product; models commoditize
  monthly and the user's Ollama already updates itself.
- Not shipping a helper daemon or requiring a browser extension. If it needs an
  install, we become every other "local AI" product.
- Not putting our servers in the inference path. Signaling-only or nothing.
- Not claiming Safari/Firefox direct-LAN works. They get Mesh, labeled.
- Not changing Ollama config on the user's behalf. We guide, they own it.

## 10. Success criteria for Phase 1

- A user on the deployed site runs the wizard, grants LNA, and chats with
  Ollama without touching a terminal — same device.
- A phone on the same Wi-Fi scans the host's QR (or copies the address) and
  chats through the laptop, with one permission prompt and zero Ollama config
  on the phone (Chrome/Edge).
- Every failure state names its cause and the exact next action.
- The honest meter records mesh/direct turns as local `$0.00` with the same
  receipt format as in-tab inference.

### What shipped (v0.2.0)

- `src/app/lib/ai/localLink.js` — probe (`/api/version` with
  `targetAddressSpace: "local"`), failure classification, per-OS grant
  commands, LAN discovery from host ICE candidates (keeps `.local` mDNS names).
- `src/app/components/Workspace/content/LocalLink.jsx` — the wizard inside the
  AI panel's Ollama setup: probe, honest diagnosis, copyable per-OS commands,
  LAN address discovery with copy / "Use" (writes `ai.baseUrl`), and a locally
  rendered QR for the preferred address (`src/app/lib/qr.js`).
- `SettingsPage` connection test now uses the same probe off-localhost and no
  longer claims Ollama is localhost-only.
- QR codes render locally via `qrcode-generator`; the payload never leaves the
  machine. Everything in the Phase 1 plan now ships.
