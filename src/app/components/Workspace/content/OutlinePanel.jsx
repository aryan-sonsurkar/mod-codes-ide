"use client";
import { useEffect, useRef, useState } from "react";
import "./OutlinePanel.css";
import {
  ArrowUpFromLine,
  Box,
  Braces,
  ChevronDown,
  ChevronRight,
  Import,
  Variable,
} from "lucide-react";
import { analyzeFile, isSupportedPath } from "../../../lib/codeIntelligence";
import { buildOutline } from "../../../lib/codeIntelligence/outline";

const OUTLINE_DEBOUNCE_MS = 300;

const KIND_META = {
  function: { Icon: Braces, className: "outline-function" },
  class: { Icon: Box, className: "outline-class" },
  variable: { Icon: Variable, className: "outline-variable" },
  import: { Icon: Import, className: "outline-import" },
  export: { Icon: ArrowUpFromLine, className: "outline-export" },
};

export default function OutlinePanel({ path, content, contentToken, onSelect }) {
  const [outline, setOutline] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const timerRef = useRef(null);

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
      if (!path || typeof content !== "string") {
        setOutline(null);
        return;
      }

      if (!isSupportedPath(path)) {
        setOutline({ supported: false, groups: [] });
        return;
      }

      const analysis = analyzeFile(path, content);
      setOutline(buildOutline(analysis));
    }, OUTLINE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [path, content, contentToken]);

  function toggleGroup(key) {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }

  const hasSymbols = outline?.supported && outline.groups.length > 0;

  return (
    <div className="outline-panel">
      {!outline || !outline.supported ? (
        <p className="outline-empty">No outline available.</p>
      ) : !hasSymbols ? (
        <p className="outline-empty">No symbols found.</p>
      ) : (
        <div className="outline-groups">
          {outline.groups.map((group) => {
            const isCollapsed = Boolean(collapsed[group.key]);

            return (
              <div className="outline-group" key={group.key}>
                <button
                  type="button"
                  className="outline-group-header"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="outline-group-chevron">
                    {isCollapsed ? (
                      <ChevronRight size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </span>
                  <span className="outline-group-label">{group.label}</span>
                  <span className="outline-group-count">{group.symbols.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="outline-symbols">
                    {group.symbols.map((symbol) => {
                      const meta = KIND_META[symbol.kind] || KIND_META.variable;
                      const SymbolIcon = meta.Icon;
                      return (
                        <button
                          type="button"
                          key={`${symbol.line}:${symbol.column}:${symbol.name}`}
                          className="outline-symbol"
                          title={`${symbol.name} — line ${symbol.line}`}
                          onClick={() => onSelect(symbol)}
                        >
                          <span className={`outline-symbol-icon ${meta.className}`}>
                            <SymbolIcon size={13} />
                          </span>
                          <span className="outline-symbol-name">{symbol.name}</span>
                          {symbol.detail && (
                            <span className="outline-symbol-detail">{symbol.detail}</span>
                          )}
                          <span className="outline-symbol-line">:{symbol.line}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}