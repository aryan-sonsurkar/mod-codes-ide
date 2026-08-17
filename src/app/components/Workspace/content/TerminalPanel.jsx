"use client";
import { useEffect, useRef, useState } from "react";
import "./TerminalPanel.css";

export default function TerminalPanel({ provider, onClose }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    setLines([
      {
        type: "output",
        text: "MODCODES browser terminal (simulated). Not connected to your operating system. Type 'help' for available commands.",
      },
    ]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  async function handleSubmit() {
    const trimmed = input.trim();

    if (!trimmed || busy) {
      return;
    }

    setHistory((current) => [...current, trimmed]);
    setHistoryIndex(null);
    setInput("");

    if (trimmed === "clear") {
      provider.clear();
      setLines([]);
      inputRef.current?.focus();
      return;
    }

    setLines((current) => [...current, { type: "command", text: `$ ${trimmed}` }]);
    setBusy(true);

    try {
      const output = await provider.execute(trimmed);
      setLines((current) => [
        ...current,
        ...String(output)
          .split("\n")
          .map((text) => ({ type: "output", text })),
      ]);
    } catch (error) {
      setLines((current) => [
        ...current,
        {
          type: "output",
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

  return (
    <section className="terminal-panel">
      <header className="terminal-header">
        <span className="terminal-title">
          TERMINAL <span className="terminal-badge">Browser simulation</span>
        </span>
        <button className="terminal-close" title="Close Terminal" onClick={onClose}>
          ×
        </button>
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