/**
 * Local Link — make Ollama reachable from the deployed site, honestly.
 *
 * The web platform gates deployed -> localhost/LAN in three separate ways and
 * browsers deliberately hide which one failed. This module probes, classifies,
 * and turns the opaque failure into the exact next action.
 *
 * Facts this is built on (verified against MDN / Chrome / Ollama docs):
 * - `http://localhost` is a secure origin, so mixed content is not the blocker.
 * - Chrome 142+ gates public -> local requests behind a Local Network Access
 *   permission prompt, and exempts permission-granted local requests from
 *   mixed-content checks (incl. `.local` mDNS names and private IP literals).
 * - Ollama only allows `127.0.0.1` / `0.0.0.0` origins by default. Any other
 *   origin (including the deployed site) is rejected unless listed in
 *   `OLLAMA_ORIGINS`. That grant is irreducible from the browser.
 */

export const LOCAL_LINK_TIMEOUT_MS = 5000;
export const LOCAL_NETWORK_ACCESS_MIN_VERSION = 142;
export const OLLAMA_DEFAULT_PORT = 11434;

export const LINK_FAILURE_KINDS = {
  invalid: "invalid",
  timeout: "timeout",
  http: "http",
  unreachable: "unreachable",
};

export function detectPlatform(userAgent = "") {
  const ua = String(userAgent || "");
  if (/windows/i.test(ua)) return "windows";
  if (/mac os x|macintosh/i.test(ua)) return "macos";
  if (/linux|x11/i.test(ua)) return "linux";
  return "other";
}

export function detectBrowser(userAgent = "") {
  const ua = String(userAgent || "");
  const edge = ua.match(/Edg\/(\d+)/);
  if (edge) return { name: "edge", major: Number(edge[1]), chromium: true };
  const opera = ua.match(/OPR\/(\d+)/);
  if (opera) return { name: "opera", major: Number(opera[1]), chromium: true };
  const chrome = ua.match(/Chrome\/(\d+)/);
  if (chrome) return { name: "chrome", major: Number(chrome[1]), chromium: true };
  const firefox = ua.match(/Firefox\/(\d+)/);
  if (firefox) return { name: "firefox", major: Number(firefox[1]), chromium: false };
  const safari = ua.match(/Version\/(\d+).*Safari/i);
  if (safari) return { name: "safari", major: Number(safari[1]), chromium: false };
  return { name: "other", major: 0, chromium: false };
}

export function supportsLocalNetworkAccess(userAgent = "") {
  const browser = detectBrowser(userAgent);
  return browser.chromium && browser.major >= LOCAL_NETWORK_ACCESS_MIN_VERSION;
}

export function isLoopbackHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || host === "127.0.0.1" || host.startsWith("127.");
}

export function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (isLoopbackHostname(host) || host.endsWith(".local")) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const a = Number(v4[1]);
  const b = Number(v4[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function normalizeProbeUrl(baseUrl) {
  const raw = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!raw) return null;
  let parsed = null;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Per-OS instructions that make the host machine reachable.
 * `lan: true` also binds Ollama to the network so other devices can connect.
 */
export function buildLinkCommands({
  platform = "other",
  origin = "",
  lan = false,
  port = OLLAMA_DEFAULT_PORT,
} = {}) {
  const trustedOrigin = origin || "https://modcode.vercel.app";
  const hostValue = `0.0.0.0:${port}`;

  if (platform === "windows") {
    const commands = [`setx OLLAMA_ORIGINS "${trustedOrigin}"`];
    if (lan) commands.push(`setx OLLAMA_HOST "${hostValue}"`);
    return {
      platform,
      commands,
      restart: "Quit Ollama from the tray, reopen it, then retry here.",
      note: "setx writes a persistent user variable; open a new terminal afterwards.",
    };
  }

  if (platform === "macos") {
    const commands = [`launchctl setenv OLLAMA_ORIGINS "${trustedOrigin}"`];
    if (lan) commands.push(`launchctl setenv OLLAMA_HOST "${hostValue}"`);
    return {
      platform,
      commands,
      restart: "Quit and reopen the Ollama app, then retry here.",
      note: "launchctl values persist until logout.",
    };
  }

  if (platform === "linux") {
    const lines = [`Environment="OLLAMA_ORIGINS=${trustedOrigin}"`];
    if (lan) lines.push(`Environment="OLLAMA_HOST=${hostValue}"`);
    return {
      platform,
      commands: [
        `sudo systemctl edit ollama.service\n[Service]\n${lines.join("\n")}`,
        "sudo systemctl daemon-reload",
        "sudo systemctl restart ollama",
      ],
      restart: "systemd restarts Ollama for you.",
      note: "Add the [Service] lines to the override file systemd opens.",
    };
  }

  const commands = [
    `OLLAMA_ORIGINS=${trustedOrigin} OLLAMA_HOST=${hostValue} ollama serve`,
  ];
  return {
    platform: "other",
    commands,
    restart: "Restart the Ollama server after setting the variables.",
    note: "The two variables can also be exported in your shell profile.",
  };
}

/**
 * Turn a probe result into a human diagnosis. Browsers intentionally do not
 * expose whether a failed local request was blocked by permission or CORS,
 * so the unreachable case names both requirements instead of guessing.
 */
export function classifyLinkFailure(result = {}) {
  const kind = result.kind || LINK_FAILURE_KINDS.unreachable;

  if (kind === LINK_FAILURE_KINDS.timeout) {
    return {
      id: "timeout",
      title: "Ollama did not answer",
      detail:
        "The address resolved but nothing replied in time. Check that Ollama is running and that the port is right.",
      steps: ["Start Ollama (or restart it) and retry."],
    };
  }

  if (kind === LINK_FAILURE_KINDS.http) {
    if (result.status === 403 || result.status === 404) {
      return {
        id: "proxy",
        title: `Ollama answered with HTTP ${result.status}`,
        detail:
          "Something other than Ollama is answering on that address — usually a proxy or the wrong port.",
        steps: [
          "Open the address in a normal tab and confirm it says Ollama.",
          "If a proxy is in front of Ollama, forward the Ollama API paths unchanged.",
        ],
      };
    }
    return {
      id: "http",
      title: `Ollama answered with HTTP ${result.status}`,
      detail: "The server is reachable but rejected the request.",
      steps: ["Check the Ollama logs, then retry."],
    };
  }

  if (kind === LINK_FAILURE_KINDS.invalid) {
    return {
      id: "invalid",
      title: "That address is not valid",
      detail: "Use an http:// or https:// URL, for example http://127.0.0.1:11434.",
      steps: ["Fix the base URL in Settings → AI & Coder."],
    };
  }

  return {
    id: "unreachable",
    title: "The browser could not reach Ollama",
    detail:
      "Browsers do not say whether this was a local-network permission denial or a CORS rejection. Both have to be granted once.",
    steps: [
      "Allow local network access when your browser asks (Chrome/Edge 142+).",
      "Tell Ollama to trust this site with OLLAMA_ORIGINS (commands below).",
      "Restart Ollama, then retry.",
    ],
  };
}

export async function probeOllama(
  baseUrl,
  { fetchImpl = null, timeoutMs = LOCAL_LINK_TIMEOUT_MS } = {}
) {
  const target = normalizeProbeUrl(baseUrl);
  if (!target) {
    return { ok: false, kind: LINK_FAILURE_KINDS.invalid };
  }

  const fetchFn =
    fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!fetchFn) {
    return { ok: false, kind: LINK_FAILURE_KINDS.invalid };
  }

  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  let timer = null;
  if (controller && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  const startedAt = Date.now();
  try {
    const response = await fetchFn(`${target}/api/version`, {
      method: "GET",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
      // Chromium 142+ Local Network Access hint. Other browsers ignore it.
      targetAddressSpace: "local",
    });
    const latencyMs = Date.now() - startedAt;

    if (!response || !response.ok) {
      return {
        ok: false,
        kind: LINK_FAILURE_KINDS.http,
        status: response ? response.status : 0,
        latencyMs,
      };
    }

    let version = null;
    try {
      const payload = await response.json();
      version =
        payload && typeof payload.version === "string" ? payload.version : null;
    } catch {
      version = null;
    }

    return { ok: true, version, latencyMs };
  } catch (error) {
    if (controller && controller.signal.aborted) {
      return {
        ok: false,
        kind: LINK_FAILURE_KINDS.timeout,
        latencyMs: Date.now() - startedAt,
      };
    }
    return {
      ok: false,
      kind: LINK_FAILURE_KINDS.unreachable,
      latencyMs: Date.now() - startedAt,
      message: error && typeof error.message === "string" ? error.message : "",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Parse an ICE candidate string and keep host candidates that are usable from
 * another device. Chrome obfuscates host addresses as `.local` mDNS names
 * (resolvable on the LAN and exempt from mixed-content checks under LNA).
 */
export function parseIceCandidate(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return null;
  const parts = candidate.trim().split(/\s+/);
  if (parts.length < 8 || parts[6] !== "typ") return null;
  if (parts[7] !== "host") return null;

  const address = parts[4];
  if (!address) return null;
  if (
    address === "0.0.0.0" ||
    address === "::" ||
    address === "::1" ||
    address.startsWith("127.")
  ) {
    return null;
  }
  if (address.includes(":")) {
    // IPv6 link-local candidates need a zone id; skip them for plain fetch.
    if (/^fe80:/i.test(address)) return null;
    return { address, kind: "ipv6" };
  }
  if (/\.local$/i.test(address)) {
    return { address, kind: "mdns" };
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!v4.test(address)) return null;
  return { address, kind: "ipv4" };
}

/**
 * Discover this machine's LAN address(es) without asking the user for an IP.
 * Uses host ICE candidates from a throwaway peer connection. Dependency
 * injection keeps this testable without a real browser.
 */
export async function collectLanCandidates({
  createPeerConnection = null,
  timeoutMs = 2000,
} = {}) {
  const factory =
    createPeerConnection ||
    (typeof RTCPeerConnection === "function"
      ? (config) => new RTCPeerConnection(config)
      : null);

  if (!factory) {
    return {
      ok: false,
      addresses: [],
      reason: "This browser cannot discover LAN addresses (WebRTC unavailable).",
    };
  }

  let pc = null;
  const found = new Map();

  try {
    pc = factory({ iceServers: [] });
    if (!pc || typeof pc.createDataChannel !== "function") {
      return {
        ok: false,
        addresses: [],
        reason: "This browser cannot discover LAN addresses.",
      };
    }

    pc.createDataChannel("modcodes-local-link");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);

      pc.onicecandidate = (event) => {
        const candidate = event && event.candidate;
        if (!candidate || !candidate.candidate) {
          finish();
          return;
        }
        const parsed = parseIceCandidate(candidate.candidate);
        if (parsed && !found.has(parsed.address)) {
          found.set(parsed.address, parsed);
        }
      };
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          finish();
        }
      };
    });
  } catch (error) {
    return {
      ok: false,
      addresses: [],
      reason:
        error && typeof error.message === "string"
          ? error.message
          : "LAN address discovery failed.",
    };
  } finally {
    try {
      if (pc && typeof pc.close === "function") pc.close();
    } catch {}
  }

  return { ok: true, addresses: Array.from(found.values()) };
}

export function buildLanUrls(addresses, port = OLLAMA_DEFAULT_PORT) {
  return (Array.isArray(addresses) ? addresses : [])
    .map((entry) => {
      const address = typeof entry === "string" ? entry : entry && entry.address;
      if (!address) return null;
      const host = address.includes(":") ? `[${address}]` : address;
      return {
        address,
        kind:
          typeof entry === "object" && entry
            ? entry.kind || (address.endsWith(".local") ? "mdns" : "ipv4")
            : address.endsWith(".local")
              ? "mdns"
              : "ipv4",
        url: `http://${host}:${port}`,
      };
    })
    .filter(Boolean);
}

export function describeCrossDeviceSupport(userAgent = "") {
  const browser = detectBrowser(userAgent);
  if (supportsLocalNetworkAccess(userAgent)) {
    return {
      supported: true,
      label: `${browser.name === "edge" ? "Edge" : "Chrome"} ${browser.major}`,
      detail:
        "Direct cross-device access is available: approve the local network prompt on the other device.",
    };
  }
  return {
    supported: false,
    label:
      browser.name === "other"
        ? "This browser"
        : `${browser.name.charAt(0).toUpperCase()}${browser.name.slice(1)} ${browser.major}`,
    detail:
      "Direct cross-device access needs Chrome/Edge 142+ (Local Network Access). Safari and Firefox support arrives with the WebRTC Mesh.",
  };
}
