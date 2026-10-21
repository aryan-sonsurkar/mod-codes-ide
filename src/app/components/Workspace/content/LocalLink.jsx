"use client";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import {
  buildJoinUrl,
  buildLanUrls,
  buildLinkCommands,
  classifyLinkFailure,
  collectLanCandidates,
  describeCrossDeviceSupport,
  detectPlatform,
  probeOllama,
} from "../../../lib/ai/localLink";
import { buildQrMatrix, pickPreferredLanUrl, qrSvgPath } from "../../../lib/qr";

function CopyButton({ text, label = "Copy", testId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      type="button"
      className="ai-local-link-copy"
      onClick={handleCopy}
      data-testid={testId}
      aria-label={label}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

function CommandBlock({ command, testId }) {
  return (
    <div className="ai-local-link-command">
      <code>{command}</code>
      <CopyButton text={command} label="Copy" testId={testId} />
    </div>
  );
}

function LanQr({ url }) {
  let code = null;
  try {
    code = qrSvgPath(buildQrMatrix(url));
  } catch {
    code = null;
  }
  if (!code) return null;

  return (
    <figure className="ai-local-link-qr">
      <svg
        viewBox={`0 0 ${code.size} ${code.size}`}
        width="128"
        height="128"
        role="img"
        aria-label={`QR code for ${url}`}
        shapeRendering="crispEdges"
      >
        <rect width={code.size} height={code.size} fill="#ffffff" />
        <path d={code.path} fill="#000000" />
      </svg>
      <figcaption>Scan to open MODCODES with this Ollama</figcaption>
    </figure>
  );
}

function readEnvironment() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let deployed = false;
  try {
    const host = new URL(origin).hostname;
    deployed = !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {}
  return {
    ua,
    origin,
    deployed,
    platform: detectPlatform(ua),
    support: describeCrossDeviceSupport(ua),
  };
}

export default function LocalLink({ baseUrl, onUseBaseUrl }) {
  const [env] = useState(readEnvironment);
  const [probe, setProbe] = useState({ kind: "idle" });
  const [showSetup, setShowSetup] = useState(false);
  const [bindLan, setBindLan] = useState(false);
  const [lan, setLan] = useState({ kind: "idle" });
  const [showLan, setShowLan] = useState(false);

  const target = baseUrl || "http://127.0.0.1:11434";
  const preferredLan = lan.kind === "done" ? pickPreferredLanUrl(lan.urls) : null;
  const joinUrl = preferredLan
    ? buildJoinUrl({ appOrigin: env.origin, ollamaUrl: preferredLan.url })
    : null;
  const commands = buildLinkCommands({
    platform: env.platform,
    origin: env.origin,
    lan: bindLan,
  });

  const handleTest = async () => {
    setProbe({ kind: "checking" });
    const result = await probeOllama(target);
    if (result.ok) {
      setProbe({
        kind: "ok",
        version: result.version,
        latencyMs: result.latencyMs,
      });
    } else {
      setProbe({ kind: "error", diagnosis: classifyLinkFailure(result) });
      setShowSetup(true);
    }
  };

  const handleDiscover = async () => {
    setLan({ kind: "checking" });
    const result = await collectLanCandidates();
    if (!result.ok) {
      setLan({ kind: "error", reason: result.reason });
      return;
    }
    setLan({ kind: "done", urls: buildLanUrls(result.addresses) });
  };

  const handleUse = (url) => {
    if (typeof onUseBaseUrl === "function") onUseBaseUrl(url);
  };

  const checking = probe.kind === "checking";

  return (
    <section className="ai-local-link" data-testid="local-link" aria-label="Local Link">
      <div className="ai-local-link-head">
        <Plug size={13} />
        <h4>Local Link</h4>
        <span className="ai-local-link-badge">
          {env.deployed ? "deployed site" : "localhost"}
        </span>
      </div>
      <p className="ai-local-link-intro">
        Let this tab reach Ollama on your machine — and your phone reach it over
        Wi-Fi. No proxy, no install.
      </p>

      <div className="ai-local-link-target">
        <code>{target}</code>
        <button
          type="button"
          className="ai-local-link-action"
          onClick={handleTest}
          disabled={checking}
          data-testid="local-link-test"
        >
          {checking ? (
            <Loader2 size={12} className="ai-local-link-spin" />
          ) : (
            <Plug size={12} />
          )}
          {checking ? "Testing" : "Test connection"}
        </button>
      </div>

      {probe.kind === "ok" && (
        <p className="ai-local-link-result ai-local-link-result-ok" data-testid="local-link-result">
          <Check size={13} /> Connected
          {probe.version ? ` · v${probe.version}` : ""} · {probe.latencyMs}ms
        </p>
      )}

      {probe.kind === "error" && (
        <div className="ai-local-link-result ai-local-link-result-error" data-testid="local-link-result">
          <div className="ai-local-link-result-title">
            <AlertTriangle size={13} />
            <strong>{probe.diagnosis.title}</strong>
          </div>
          <p>{probe.diagnosis.detail}</p>

          {probe.diagnosis.id === "unreachable" ? (
            <ol className="ai-local-link-steps">
              <li>
                <span>
                  Allow local network access when the browser asks. If it never
                  asks, open{" "}
                  <code>chrome://settings/content/localNetworkAccess</code>.
                </span>
                <button
                  type="button"
                  className="ai-local-link-action"
                  onClick={handleTest}
                  disabled={checking}
                >
                  <RefreshCw size={11} /> Retry
                </button>
              </li>
              <li>
                <span>
                  Tell Ollama to trust <code>{env.origin || "this site"}</code>{" "}
                  with the commands below, then restart Ollama.
                </span>
              </li>
            </ol>
          ) : (
            <ul className="ai-local-link-plain-steps">
              {probe.diagnosis.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        className="ai-local-link-toggle"
        onClick={() => setShowSetup((open) => !open)}
        aria-expanded={showSetup}
        data-testid="local-link-toggle"
      >
        {showSetup ? "Hide setup commands" : "Show setup commands"}
      </button>

      {showSetup && (
        <div className="ai-local-link-setup" data-testid="local-link-commands">
          <p className="ai-local-link-label">
            {env.platform === "windows"
              ? "PowerShell or Command Prompt"
              : env.platform === "linux"
                ? "Terminal (systemd)"
                : env.platform === "macos"
                  ? "Terminal"
                  : "Shell"}
          </p>
          {commands.commands.map((command, index) => (
            <CommandBlock
              key={command}
              command={command}
              testId={`local-link-command-${index}`}
            />
          ))}
          <p className="ai-local-link-note">{commands.restart}</p>
          <p className="ai-local-link-note">{commands.note}</p>

          <label className="ai-local-link-check">
            <input
              type="checkbox"
              checked={bindLan}
              onChange={(event) => setBindLan(event.target.checked)}
            />
            <span>Also accept connections from other devices (binds 0.0.0.0)</span>
          </label>
        </div>
      )}

      <div className="ai-local-link-lan">
        <button
          type="button"
          className="ai-local-link-lan-toggle"
          onClick={() => setShowLan((open) => !open)}
          aria-expanded={showLan}
          data-testid="local-link-lan-toggle"
        >
          <Wifi size={12} />
          <h5>Use it from another device</h5>
        </button>

        {showLan && (
          <>
            <p className="ai-local-link-note">{env.support.detail}</p>
            <button
              type="button"
              className="ai-local-link-action"
              onClick={handleDiscover}
              disabled={lan.kind === "checking"}
              data-testid="local-link-find-lan"
            >
              {lan.kind === "checking" ? (
                <Loader2 size={11} className="ai-local-link-spin" />
              ) : (
                <Search size={11} />
              )}
              {lan.kind === "checking" ? "Searching" : "Find this machine's LAN address"}
            </button>

            {lan.kind === "error" && (
              <p className="ai-local-link-note">{lan.reason}</p>
            )}

            {lan.kind === "done" && lan.urls.length === 0 && (
              <p className="ai-local-link-note" data-testid="local-link-lan-result">
                No LAN address found. Connect to Wi-Fi or Ethernet, then search
                again.
              </p>
            )}

            {lan.kind === "done" && lan.urls.length > 0 && (
              <>
                <ul className="ai-local-link-urls" data-testid="local-link-lan-result">
                  {lan.urls.map((entry) => (
                    <li key={entry.address}>
                      <code>{entry.url}</code>
                      <span className="ai-local-link-url-tag">
                        {entry.kind === "mdns" ? "hostname" : entry.kind}
                      </span>
                      <CopyButton text={entry.url} label="Copy" />
                      {typeof onUseBaseUrl === "function" && (
                        <button
                          type="button"
                          className="ai-local-link-use"
                          onClick={() => handleUse(entry.url)}
                        >
                          Use
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {preferredLan && joinUrl && (
                  <>
                    <div data-testid="local-link-qr">
                      <LanQr url={joinUrl} />
                    </div>
                    {!env.deployed && (
                      <p className="ai-local-link-note">
                        This QR points at this tab&apos;s origin. Open the
                        deployed site before sharing with a phone.
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            <p className="ai-local-link-note">
              The other device must be on the same network and approve the local
              network prompt. This only works while Ollama is running.
            </p>
          </>
        )}
      </div>

      <p className="ai-local-link-security">
        <ShieldCheck size={11} /> Only Ollama&apos;s API is exposed on that
        address — the site can list models and chat, nothing else.
      </p>
    </section>
  );
}
