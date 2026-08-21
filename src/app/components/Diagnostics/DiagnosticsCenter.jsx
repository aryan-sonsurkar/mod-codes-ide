"use client";
import { useEffect, useState } from "react";
import "./DiagnosticsCenter.css";

function detect(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(
        (v) => ({ name, status: v ? "Supported" : "Unavailable", detail: v ? "" : "" }),
        () => ({ name, status: "Unavailable", detail: "" })
      );
    }
    return Promise.resolve({ name, status: result ? "Supported" : "Unavailable", detail: result ? "" : "" });
  } catch {
    return Promise.resolve({ name, status: "Unavailable", detail: "" });
  }
}

export default function DiagnosticsCenter() {
  const [items, setItems] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checks = [
      detect("Browser", () => typeof navigator !== "undefined" && navigator.userAgent),
      detect("OS/platform", () => typeof navigator !== "undefined" && (navigator.platform || navigator.userAgentData?.platform || "unknown")),
      detect("File System Access API", () => typeof window !== "undefined" && "showDirectoryPicker" in window),
      detect("WebGPU", () => typeof navigator !== "undefined" && "gpu" in navigator),
      detect("Web Worker", () => typeof Worker !== "undefined"),
      detect("Cache Storage", () => typeof caches !== "undefined"),
      detect("Monaco", () => true),
      detect("Ollama (localhost:11434)", async () => {
        try {
          const res = await fetch("http://127.0.0.1:11434/api/version", { method: "GET", signal: AbortSignal.timeout(800) });
          return res.ok;
        } catch {
          return false;
        }
      }),
      detect("Bonsai (WebGPU)", () => typeof navigator !== "undefined" && "gpu" in navigator),
      detect("Terminal Bridge (127.0.0.1:8787)", async () => {
        try {
          const res = await fetch("http://127.0.0.1:8787/health", { method: "GET", signal: AbortSignal.timeout(800) });
          const data = await res.json();
          return Boolean(data.ok);
        } catch {
          return false;
        }
      }),
      detect("Local Storage", () => {
        try {
          localStorage.setItem("__modcodes_test", "1");
          localStorage.removeItem("__modcodes_test");
          return true;
        } catch {
          return false;
        }
      }),
      detect("Clipboard", () => typeof navigator !== "undefined" && !!navigator.clipboard),
      detect("Notifications", () => typeof Notification !== "undefined"),
    ];
    Promise.all(checks).then((results) => {
      setItems(results.map((r) => ({ ...r, status: r.status === "Supported" || r.status === true ? "Supported" : r.status === false ? "Unavailable" : r.status })));
    });
  }, []);

  const report = items.map((i) => `${i.name}: ${i.status}`).join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`MODCODES Diagnostics\nGenerated locally — not sent anywhere\n\n${report}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="diagnostics-center" role="region" aria-label="System Diagnostics">
      <h3>System Diagnostics</h3>
      <p className="diagnostics-note">Generated locally. Never sent anywhere. No passwords, tokens, or file contents included.</p>
      <ul className="diagnostics-list">
        {items.length === 0 ? (
          <li>Checking…</li>
        ) : (
          items.map((item) => (
            <li key={item.name} className="diagnostics-item">
              <strong>{item.name}</strong>
              <span className={`diagnostics-status diagnostics-status-${item.status.toLowerCase().replace(/[^a-z]/g, "")}`}>{item.status}</span>
            </li>
          ))
        )}
      </ul>
      <button type="button" className="diagnostics-copy" onClick={handleCopy}>
        {copied ? "Copied" : "Copy diagnostic report"}
      </button>
    </div>
  );
}
