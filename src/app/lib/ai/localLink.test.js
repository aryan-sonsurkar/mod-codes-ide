import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_NETWORK_ACCESS_MIN_VERSION,
  OLLAMA_DEFAULT_PORT,
  buildLanUrls,
  buildLinkCommands,
  classifyLinkFailure,
  collectLanCandidates,
  describeCrossDeviceSupport,
  detectBrowser,
  detectPlatform,
  isLoopbackHostname,
  isPrivateHostname,
  normalizeProbeUrl,
  parseIceCandidate,
  probeOllama,
  supportsLocalNetworkAccess,
} from "./localLink";

const CHROME_142 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const EDGE_142 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";

function versionResponse(version) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ version }),
  };
}

describe("detectPlatform", () => {
  it("detects the three supported desktop platforms", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "windows"
    );
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe(
      "macos"
    );
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectPlatform("")).toBe("other");
  });
});

describe("browser capability detection", () => {
  it("identifies Chromium browsers and their major version", () => {
    expect(detectBrowser(CHROME_142)).toEqual({
      name: "chrome",
      major: 142,
      chromium: true,
    });
    expect(detectBrowser(EDGE_142)).toEqual({
      name: "edge",
      major: 142,
      chromium: true,
    });
    expect(detectBrowser(FIREFOX)).toEqual({
      name: "firefox",
      major: 141,
      chromium: false,
    });
    expect(detectBrowser(SAFARI)).toEqual({
      name: "safari",
      major: 18,
      chromium: false,
    });
  });

  it("only treats Chromium at or above the LNA version as capable", () => {
    expect(LOCAL_NETWORK_ACCESS_MIN_VERSION).toBe(142);
    expect(supportsLocalNetworkAccess(CHROME_142)).toBe(true);
    expect(supportsLocalNetworkAccess(EDGE_142)).toBe(true);
    expect(
      supportsLocalNetworkAccess(
        CHROME_142.replace("Chrome/142", "Chrome/141")
      )
    ).toBe(false);
    expect(supportsLocalNetworkAccess(FIREFOX)).toBe(false);
    expect(supportsLocalNetworkAccess(SAFARI)).toBe(false);
  });

  it("describes cross-device support honestly", () => {
    expect(describeCrossDeviceSupport(CHROME_142)).toMatchObject({
      supported: true,
      label: "Chrome 142",
    });
    const firefox = describeCrossDeviceSupport(FIREFOX);
    expect(firefox.supported).toBe(false);
    expect(firefox.detail).toContain("Chrome/Edge 142+");
    expect(firefox.detail).toContain("WebRTC Mesh");
  });
});

describe("host classification", () => {
  it("recognises loopback and private addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("192.168.1.10")).toBe(false);

    expect(isPrivateHostname("10.0.0.5")).toBe(true);
    expect(isPrivateHostname("172.16.4.2")).toBe(true);
    expect(isPrivateHostname("172.32.4.2")).toBe(false);
    expect(isPrivateHostname("192.168.1.20")).toBe(true);
    expect(isPrivateHostname("169.254.1.1")).toBe(true);
    expect(isPrivateHostname("macbook.local")).toBe(true);
    expect(isPrivateHostname("modcode.vercel.app")).toBe(false);
  });

  it("normalises probe URLs and rejects unsupported schemes", () => {
    expect(normalizeProbeUrl("http://127.0.0.1:11434/")).toBe(
      "http://127.0.0.1:11434"
    );
    expect(normalizeProbeUrl("  https://ollama.example.com  ")).toBe(
      "https://ollama.example.com"
    );
    expect(normalizeProbeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeProbeUrl("not a url")).toBeNull();
    expect(normalizeProbeUrl("")).toBeNull();
  });
});

describe("buildLinkCommands", () => {
  it("builds macOS commands and only binds LAN when asked", () => {
    const sameDevice = buildLinkCommands({
      platform: "macos",
      origin: "https://modcode.vercel.app",
    });
    expect(sameDevice.commands).toEqual([
      'launchctl setenv OLLAMA_ORIGINS "https://modcode.vercel.app"',
    ]);

    const lan = buildLinkCommands({
      platform: "macos",
      origin: "https://modcode.vercel.app",
      lan: true,
    });
    expect(lan.commands).toContain(
      'launchctl setenv OLLAMA_HOST "0.0.0.0:11434"'
    );
  });

  it("builds Windows and Linux commands with the detected origin", () => {
    const windows = buildLinkCommands({
      platform: "windows",
      origin: "https://example.test",
      lan: true,
    });
    expect(windows.commands).toEqual([
      'setx OLLAMA_ORIGINS "https://example.test"',
      'setx OLLAMA_HOST "0.0.0.0:11434"',
    ]);
    expect(windows.restart).toContain("reopen");

    const linux = buildLinkCommands({ platform: "linux", lan: true });
    expect(linux.commands[0]).toContain(
      'Environment="OLLAMA_ORIGINS=https://modcode.vercel.app"'
    );
    expect(linux.commands[0]).toContain(
      'Environment="OLLAMA_HOST=0.0.0.0:11434"'
    );
    expect(linux.commands).toContain("sudo systemctl restart ollama");
  });

  it("falls back to a shell invocation on unknown platforms", () => {
    const other = buildLinkCommands({ platform: "other", lan: true });
    expect(other.commands[0]).toBe(
      "OLLAMA_ORIGINS=https://modcode.vercel.app OLLAMA_HOST=0.0.0.0:11434 ollama serve"
    );
    expect(OLLAMA_DEFAULT_PORT).toBe(11434);
  });
});

describe("classifyLinkFailure", () => {
  it("names both requirements when a browser hides the cause", () => {
    const diagnosis = classifyLinkFailure({ kind: "unreachable" });
    expect(diagnosis.id).toBe("unreachable");
    expect(diagnosis.detail).toContain("local-network permission");
    expect(diagnosis.detail).toContain("CORS");
    expect(diagnosis.steps).toHaveLength(3);
  });

  it("distinguishes timeouts, proxies, and invalid URLs", () => {
    expect(classifyLinkFailure({ kind: "timeout" }).id).toBe("timeout");

    const proxy = classifyLinkFailure({ kind: "http", status: 403 });
    expect(proxy.id).toBe("proxy");
    expect(proxy.title).toContain("403");

    const invalid = classifyLinkFailure({ kind: "invalid" });
    expect(invalid.id).toBe("invalid");
  });

  it("reports generic HTTP failures without inventing a cause", () => {
    const diagnosis = classifyLinkFailure({ kind: "http", status: 500 });
    expect(diagnosis.id).toBe("http");
    expect(diagnosis.detail).toContain("rejected");
  });
});

describe("probeOllama", () => {
  it("requests /api/version with the LNA hint and returns the version", async () => {
    const fetchImpl = vi.fn(async () => versionResponse("0.12.3"));

    const result = await probeOllama("http://127.0.0.1:11434/", {
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: true, version: "0.12.3" });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/version");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.targetAddressSpace).toBe("local");
  });

  it("tolerates a version payload that is not JSON", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    const result = await probeOllama("http://127.0.0.1:11434", { fetchImpl });
    expect(result).toMatchObject({ ok: true, version: null });
  });

  it("classifies HTTP errors without throwing", async () => {
    const fetchImpl = async () => ({ ok: false, status: 403 });
    const result = await probeOllama("http://127.0.0.1:11434", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "http", status: 403 });
  });

  it("classifies network failures and rejects invalid URLs", async () => {
    const fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };
    const result = await probeOllama("http://127.0.0.1:11434", { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("unreachable");
    expect(result.message).toContain("Failed to fetch");

    const invalid = await probeOllama("nope", { fetchImpl });
    expect(invalid).toEqual({ ok: false, kind: "invalid" });
  });

  it("aborts and reports a timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });

      const pending = probeOllama("http://127.0.0.1:11434", {
        fetchImpl,
        timeoutMs: 50,
      });
      await vi.advanceTimersByTimeAsync(60);
      const result = await pending;
      expect(result.ok).toBe(false);
      expect(result.kind).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("parseIceCandidate", () => {
  it("keeps host candidates that are reachable from another device", () => {
    expect(
      parseIceCandidate(
        "candidate:1 1 UDP 2122260223 192.168.1.20 54321 typ host"
      )
    ).toEqual({ address: "192.168.1.20", kind: "ipv4" });

    expect(
      parseIceCandidate(
        "candidate:2 1 udp 41885439 8f1c1a2b-1234.local 53000 typ host generation 0"
      )
    ).toEqual({ address: "8f1c1a2b-1234.local", kind: "mdns" });

    expect(
      parseIceCandidate(
        "candidate:3 1 UDP 2122260223 2001:db8::1 54321 typ host"
      )
    ).toEqual({ address: "2001:db8::1", kind: "ipv6" });
  });

  it("drops loopback, wildcard, link-local, and non-host candidates", () => {
    expect(
      parseIceCandidate("candidate:1 1 UDP 2122260223 127.0.0.1 5000 typ host")
    ).toBeNull();
    expect(
      parseIceCandidate("candidate:1 1 UDP 2122260223 0.0.0.0 5000 typ host")
    ).toBeNull();
    expect(
      parseIceCandidate("candidate:1 1 UDP 2122260223 ::1 5000 typ host")
    ).toBeNull();
    expect(
      parseIceCandidate("candidate:1 1 UDP 2122260223 fe80::1 5000 typ host")
    ).toBeNull();
    expect(
      parseIceCandidate(
        "candidate:1 1 UDP 2122260223 203.0.113.4 5000 typ srflx"
      )
    ).toBeNull();
    expect(parseIceCandidate("")).toBeNull();
    expect(parseIceCandidate(null)).toBeNull();
    expect(parseIceCandidate("garbage")).toBeNull();
  });
});

describe("collectLanCandidates", () => {
  function makePeer(candidates, { closeThrows = false } = {}) {
    const pc = {
      iceGatheringState: "gathering",
      createDataChannel: vi.fn(),
      createOffer: async () => ({ type: "offer", sdp: "v=0" }),
      setLocalDescription: async () => {
        setTimeout(() => {
          for (const candidate of candidates) {
            pc.onicecandidate({ candidate: { candidate } });
          }
          pc.onicecandidate({ candidate: null });
        }, 0);
      },
      close: vi.fn(() => {
        if (closeThrows) throw new Error("already closed");
      }),
    };
    return pc;
  }

  it("dedupes host candidates and closes the peer connection", async () => {
    const pc = makePeer([
      "candidate:1 1 UDP 2122260223 192.168.1.20 54321 typ host",
      "candidate:2 1 UDP 2122260223 192.168.1.20 54322 typ host",
      "candidate:3 1 UDP 2122260223 10.0.0.9 54323 typ host",
      "candidate:4 1 UDP 2122260223 127.0.0.1 54324 typ host",
    ]);

    const result = await collectLanCandidates({
      createPeerConnection: () => pc,
      timeoutMs: 250,
    });

    expect(result.ok).toBe(true);
    expect(result.addresses.map((entry) => entry.address).sort()).toEqual([
      "10.0.0.9",
      "192.168.1.20",
    ]);
    expect(pc.close).toHaveBeenCalledTimes(1);
  });

  it("reports browsers without WebRTC instead of throwing", async () => {
    const result = await collectLanCandidates({ createPeerConnection: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("WebRTC unavailable");
  });

  it("survives a peer connection that throws", async () => {
    const result = await collectLanCandidates({
      createPeerConnection: () => {
        throw new Error("blocked");
      },
    });
    expect(result).toEqual({
      ok: false,
      addresses: [],
      reason: "blocked",
    });
  });

  it("still returns addresses when close throws", async () => {
    const pc = makePeer(
      ["candidate:1 1 UDP 2122260223 192.168.1.20 54321 typ host"],
      { closeThrows: true }
    );
    const result = await collectLanCandidates({
      createPeerConnection: () => pc,
      timeoutMs: 250,
    });
    expect(result.addresses).toHaveLength(1);
  });
});

describe("buildLanUrls", () => {
  it("builds HTTP URLs for IPv4, mDNS, and IPv6 addresses", () => {
    const urls = buildLanUrls(
      [
        { address: "192.168.1.20", kind: "ipv4" },
        { address: "macbook.local", kind: "mdns" },
        "2001:db8::1",
        null,
      ],
      11434
    );

    expect(urls).toHaveLength(3);
    expect(urls[0]).toMatchObject({
      url: "http://192.168.1.20:11434",
      kind: "ipv4",
    });
    expect(urls[1]).toMatchObject({
      url: "http://macbook.local:11434",
      kind: "mdns",
    });
    expect(urls[2]).toMatchObject({
      address: "2001:db8::1",
      url: "http://[2001:db8::1]:11434",
    });
  });

  it("returns an empty list for non-array input", () => {
    expect(buildLanUrls(null)).toEqual([]);
  });
});
