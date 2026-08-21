"use client";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

function Copyable({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <code className="ai-setup-code">
      {text}
      <button type="button" className="ai-setup-copy" onClick={handleCopy} aria-label="Copy">
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </code>
  );
}

export default function AISetup({ providerId }) {
  return (
    <div className="ai-setup" role="region" aria-label="AI setup">
      {providerId === "ollama" ? (
        <>
          <h4>Ollama setup</h4>
          <ol className="ai-setup-steps">
            <li>
              Install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer">ollama.com</a> <ExternalLink size={10} />
            </li>
            <li>
              Run <Copyable text="ollama serve" /> in your system terminal
            </li>
            <li>
              Pull a model <Copyable text="ollama pull qwen2.5-coder:7b" />
            </li>
            <li>
              Configure base URL in Settings → AI & Coder (default <code>http://127.0.0.1:11434</code>)
            </li>
            <li>Test connection in Settings, then select the model in the AI panel</li>
          </ol>
          <p className="ai-setup-note">Ollama runs locally. No cloud proxy; your files stay on your machine.</p>
        </>
      ) : providerId === "browser-bonsai" ? (
        <>
          <h4>Bonsai Browser AI</h4>
          <ul className="ai-setup-steps">
            <li>Requires Chrome/Edge desktop with WebGPU.</li>
            <li>Download the 237 MB model once; it is cached in Cache Storage for offline use.</li>
            <li>Check WebGPU status above; if unsupported, use Ollama.</li>
            <li>Memory warning is shown only when `navigator.deviceMemory` is available.</li>
          </ul>
          <p className="ai-setup-note">Bonsai runs on your GPU via WebGPU in a Worker. Download verified by content-length.</p>
        </>
      ) : null}
      <p className="ai-setup-privacy">Both providers are local-first. No telemetry is sent.</p>
    </div>
  );
}
