"use client";
import { useEffect, useRef, useState } from "react";
import "./TerminalPanel.css";
import { useSettings } from "../../../contexts/SettingsContext";

export default function TerminalPanel({ provider, onClose }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  const { settings } = useSettings();

  useEffect(() => {
    setLines([
      {
        type: "output",
        text: `MODCODES terminal (${provider.name}). Not connected to your operating system. Type 'help' for available commands.`,
      },
    ]);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  function appendOutput(result) {
    setLines((current) => {
      const next = [...current];

      if (result.stdout) {
        for (const text of String(result.stdout).split("\n")) {
          next.push({ type: "output", text });
        }
      }

      if (result.stderr) {
        for (const text of String(result.stderr).split("\n")) {
          next.push({ type: "error", text });
        }
      }

      return next;
    });
  }

  async function handleSubmit() {
    const trimmed = input.trim();

    if (!trimmed || busy) {
      return;
    }

    setHistory((current) => [...current, trimmed]);
    setHistoryIndex(null);
    setInput("");

    if (trimmed === "clear") {
      provider.reset();
      setLines([]);
      inputRef.current?.focus();
      return;
    }

    setLines((current) => [...current, { type: "command", text: `$ ${trimmed}` }]);
    setBusy(true);

    try {
      const result = await provider.execute(trimmed);
      appendOutput(result);
    } catch (error) {
      setLines((current) => [
        ...current,
        {
          type: "error",
          text: error && error.message ? error.message : String(error),
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) {
        return;
      }
      const index =
        historyIndex === null ? history.length - 1 : Math.max(historyIndex - 1, 0);
      setHistoryIndex(index);
      setInput(history[index]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) {
        return;
      }
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(null);
        setInput("");
      } else {
        const index = historyIndex + 1;
        setHistoryIndex(index);
        setInput(history[index]);
      }
    }
  }

  const isSystem = provider.name && provider.name.toLowerCase().includes("system");
  const connectionLabel = isSystem ? "Connected to local terminal" : "Browser simulation";
  const [copied, setCopied] = useState(false);

  const handleClear = () => {
    provider.reset();
    setLines([]);
  };

  const handleCopy = async () => {
    const text = lines.map((l) => l.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleKill = async () => {
    if (typeof provider.kill === "function") {
      try {
        await provider.kill();
        setLines((c) => [...c, { type: "output", text: "[session terminated]" }]);
      } catch {}
    }
  };

  return (
    <section
      className="terminal-panel"
      style={{
        "--terminal-font-size": `${settings.terminal.fontSize}px`,
        "--terminal-font-family": settings.terminal.fontFamily,
      }}
    >
      <header className="terminal-header">
        <span className="terminal-title">
          TERMINAL <span className="terminal-badge">{provider.name}</span>
          <span className="terminal-connection" title={connectionLabel}>
            {connectionLabel}
          </span>
        </span>
        <div className="terminal-header-actions">
          <button className="terminal-action" title="Copy terminal" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="terminal-action" title="Clear" onClick={handleClear}>
            Clear
          </button>
          {isSystem && (
            <button className="terminal-action" title="Kill session" onClick={handleKill}>
              Kill
            </button>
          )}
          <button className="terminal-close" title="Close Terminal" onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((line, index) => (
          <div
            key={index}
            className={`terminal-line terminal-line-${line.type}`}
          >
            {line.text}
          </div>
        ))}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
        />
      </div>
    </section>
  );
}