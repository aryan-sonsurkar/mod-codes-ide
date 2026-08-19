"use client";
import { useMemo, useState } from "react";
import "./ProblemsPanel.css";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
} from "lucide-react";
import {
  SEVERITY,
  countSeverity,
  groupDiagnosticsByPath,
} from "../../../lib/diagnostics";

const SEVERITY_META = {
  [SEVERITY.ERROR]: { label: "Error", Icon: AlertCircle, className: "problems-error" },
  [SEVERITY.WARNING]: { label: "Warning", Icon: AlertTriangle, className: "problems-warning" },
  [SEVERITY.INFO]: { label: "Info", Icon: Info, className: "problems-info" },
  [SEVERITY.HINT]: { label: "Hint", Icon: Lightbulb, className: "problems-hint" },
};

const FILTERS = ["all", SEVERITY.ERROR, SEVERITY.WARNING, SEVERITY.INFO, SEVERITY.HINT];

export default function ProblemsPanel({ diagnostics, onSelect }) {
  const [filter, setFilter] = useState("all");

  const groups = useMemo(() => {
    const filtered =
      filter === "all"
        ? diagnostics
        : diagnostics.filter((diagnostic) => diagnostic.severity === filter);
    return groupDiagnosticsByPath(filtered);
  }, [diagnostics, filter]);

  const errorCount = useMemo(() => countSeverity(diagnostics, SEVERITY.ERROR), [diagnostics]);
  const warningCount = useMemo(() => countSeverity(diagnostics, SEVERITY.WARNING), [diagnostics]);
  const infoCount = useMemo(() => countSeverity(diagnostics, SEVERITY.INFO), [diagnostics]);
  const hintCount = useMemo(() => countSeverity(diagnostics, SEVERITY.HINT), [diagnostics]);

  return (
    <div className="problems-panel">
      <div className="problems-filters" role="tablist">
        {FILTERS.map((key) => {
          const count =
            key === "all"
              ? diagnostics.length
              : key === SEVERITY.ERROR
                ? errorCount
                : key === SEVERITY.WARNING
                  ? warningCount
                  : key === SEVERITY.INFO
                    ? infoCount
                    : hintCount;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`problems-filter${
                filter === key ? " problems-filter-active" : ""
              }`}
              onClick={() => setFilter(key)}
            >
              {key === "all"
                ? "All"
                : `${SEVERITY_META[key].label}s`}
              <span className="problems-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="problems-body">
        {groups.length === 0 && (
          <p className="problems-empty">
            {diagnostics.length === 0
              ? "No problems detected."
              : "No problems match this filter."}
          </p>
        )}

        {groups.map(([path, list]) => (
          <div className="problems-group" key={path}>
            <div className="problems-group-header" title={path}>
              {path}
            </div>
            {list.map((diagnostic, index) => {
              const meta = SEVERITY_META[diagnostic.severity] || SEVERITY_META[SEVERITY.HINT];
              const Icon = meta.Icon;
              return (
                <button
                  key={`${diagnostic.line}:${diagnostic.column}:${index}:${diagnostic.message}`}
                  type="button"
                  className="problems-item"
                  onClick={() => onSelect(diagnostic)}
                >
                  <span className={`problems-item-icon ${meta.className}`}>
                    <Icon size={13} />
                  </span>
                  <span className="problems-item-message">{diagnostic.message}</span>
                  <span className="problems-item-location">
                    :{diagnostic.line}:{diagnostic.column}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}