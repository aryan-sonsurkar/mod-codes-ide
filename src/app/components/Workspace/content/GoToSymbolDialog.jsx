"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./GoToSymbolDialog.css";
import { Box, Braces, Variable } from "lucide-react";
import { analyzeFile } from "../../../lib/codeIntelligence";
import {
  collectWorkspaceSymbols,
  searchSymbols,
} from "../../../lib/codeIntelligence/symbols";

const ANALYSIS_DEBOUNCE_MS = 150;
const MAX_VISIBLE = 200;

const KIND_META = {
  function: { Icon: Braces, className: "gotosymbol-function" },
  class: { Icon: Box, className: "gotosymbol-class" },
  variable: { Icon: Variable, className: "gotosymbol-variable" },
};

export default function GoToSymbolDialog({
  mode,
  activePath,
  activeContent,
  tabs,
  onSelect,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [symbols, setSymbols] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      if (mode === "file") {
        if (!activePath || typeof activeContent !== "string") {
          setSymbols([]);
          return;
        }
        const analysis = analyzeFile(activePath, activeContent);
        setSymbols(
          (analysis.symbols || []).map((symbol) => ({
            ...symbol,
            path: activePath,
          }))
        );
        return;
      }

      setSymbols(collectWorkspaceSymbols(tabs || []));
    }, ANALYSIS_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [mode, activePath, activeContent, tabs]);

  useEffect(() => {
    const item = listRef.current?.querySelector(
      ".gotosymbol-item-selected"
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const filtered = useMemo(
    () => searchSymbols(symbols, query, MAX_VISIBLE),
    [symbols, query]
  );

  const safeIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

  function openSelected() {
    const symbol = filtered[safeIndex];
    if (symbol) {
      onSelect(symbol);
      onClose();
    }
  }

  const title =
    mode === "workspace"
      ? "Go to Symbol in Workspace"
      : "Go to Symbol in File";

  return (
    <div className="gotosymbol-overlay" onClick={onClose}>
      <div
        className="gotosymbol-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="gotosymbol-input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openSelected();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((current) =>
                Math.min(current + 1, Math.max(filtered.length - 1, 0))
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((current) => Math.max(current - 1, 0));
            }
          }}
          placeholder={mode === "workspace" ? "Search symbols in open files..." : "Search symbols in current file..."}
        />
        <div className="gotosymbol-list" ref={listRef}>
          {symbols.length === 0 && (
            <p className="gotosymbol-empty">
              {mode === "workspace"
                ? "No symbols in open files."
                : "No symbols in this file."}
            </p>
          )}
          {symbols.length > 0 && filtered.length === 0 && (
            <p className="gotosymbol-empty">No matching symbols.</p>
          )}
          {filtered.map((symbol, index) => {
            const meta = KIND_META[symbol.kind] || KIND_META.variable;
            const Icon = meta.Icon;
            return (
              <button
                key={`${symbol.path}:${symbol.line}:${symbol.column}:${symbol.name}`}
                className={`gotosymbol-item${
                  index === safeIndex ? " gotosymbol-item-selected" : ""
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={openSelected}
              >
                <span className={`gotosymbol-icon ${meta.className}`}>
                  <Icon size={13} />
                </span>
                <span className="gotosymbol-name">{symbol.name}</span>
                {mode === "workspace" && symbol.path !== activePath && (
                  <span className="gotosymbol-path">{symbol.path}</span>
                )}
                <span className="gotosymbol-line">:{symbol.line}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}