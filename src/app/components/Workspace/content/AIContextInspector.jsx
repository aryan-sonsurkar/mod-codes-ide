"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";

export default function AIContextInspector({
  context,
  preview,
  excludedSources = new Set(),
  onToggleSource = () => {},
  onRefresh = () => {},
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const hasData = Boolean(context && preview);

  const toggleExpanded = (key) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const budget = hasData ? (context.budget ?? preview.budget ?? 0) : 0;
  const used = hasData ? (context.used ?? preview.totalChars ?? 0) : 0;
  const remaining = hasData ? (context.remaining ?? Math.max(0, budget - used)) : 0;
  const truncated = hasData ? (preview.truncated || context.remaining === 0) : false;
  const limitedBy = hasData ? (preview.limitedBy ?? context.limitedBy ?? null) : null;

  return (
    <div className="ai-context-inspector">
      <button
        type="button"
        className="ai-context-inspector-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Context inspector
        <span className="ai-context-inspector-meta">
          {used}/{budget} chars
          {truncated ? " · truncated" : ""}
        </span>
      </button>

      {open && (
        <div className="ai-context-inspector-panel">
          {!hasData ? (
            <>
              <p className="ai-context-empty">No context is attached yet. Send a message or refresh to inspect.</p>
              <button type="button" className="ai-context-refresh" onClick={onRefresh}>
                <RefreshCw size={12} />
                Build preview
              </button>
            </>
          ) : (
            <>
              <div className="ai-context-inspector-budget" role="status">
                <div className="ai-context-budget-row">
                  <span>Used</span>
                  <strong>{used.toLocaleString()}</strong>
                </div>
                <div className="ai-context-budget-row">
                  <span>Available</span>
                  <strong>{remaining.toLocaleString()}</strong>
                </div>
                <div className="ai-context-budget-row">
                  <span>Limit</span>
                  <strong>{budget.toLocaleString()}</strong>
                </div>
                {limitedBy && (
                  <div className="ai-context-budget-row ai-context-budget-limited">
                    <span>Model window</span>
                    <strong>{limitedBy.toLocaleString()} tokens</strong>
                  </div>
                )}
              </div>

              {truncated && (
                <p className="ai-context-truncated" role="alert">
                  Some workspace context was omitted to stay within the model context budget.
                  High-priority sources are kept first; low-priority sources are dropped.
                </p>
              )}

              <div className="ai-context-inspector-actions">
                <button type="button" className="ai-context-refresh" onClick={onRefresh}>
                  <RefreshCw size={12} />
                  Refresh
                </button>
                <span className="ai-context-secret-note">
                  <ShieldCheck size={12} />
                  Secret paths are never sent
                </span>
              </div>

              {preview.sections.length === 0 ? (
                <p className="ai-context-empty">No context is attached for this message.</p>
              ) : (
                <ul className="ai-context-source-list">
                  {preview.sections.map((section) => {
                    const key = section.type;
                    const isExpanded = expanded.has(key);
                    const isExcluded = excludedSources.has(key);
                    return (
                      <li key={key} className="ai-context-source">
                        <div className="ai-context-source-header">
                          <button
                            type="button"
                            className="ai-context-source-expand"
                            onClick={() => toggleExpanded(key)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {section.label}
                          </button>
                          <span className="ai-context-source-count">
                            {section.count} · {section.truncated ? "truncated" : "included"}
                          </span>
                          <button
                            type="button"
                            className="ai-context-exclude"
                            onClick={() => onToggleSource(key)}
                            title={isExcluded ? "Include source" : "Exclude source"}
                            aria-label={isExcluded ? `Include ${section.label}` : `Exclude ${section.label}`}
                          >
                            {isExcluded ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ai-context-source-details">
                            {context.items
                              .filter((item) => item.type === section.type)
                              .slice(0, 8)
                              .map((item, index) => (
                                <div key={index} className="ai-context-source-item">
                                  <span className="ai-context-item-path">{item.path || "—"}</span>
                                  <span className="ai-context-item-size">{item.content.length.toLocaleString()} chars</span>
                                  <span className="ai-context-item-priority">p{item.priority ?? "?"}</span>
                                  <span className={`ai-context-item-state ${isExcluded ? "ai-context-item-excluded" : ""}`}>
                                    {isExcluded ? "excluded" : item.truncated ? "truncated" : "included"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
