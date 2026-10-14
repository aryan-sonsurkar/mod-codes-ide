"use client";
import { useState } from "react";
import {
  describeUsageSpend,
  isLocalProvider,
  summarizeUsageLog,
  usageLogToCsv,
} from "../../../lib/ai/usageTracker";
import { formatDurationMs } from "../../../lib/ai";

function formatTokenCount(count) {
  if (typeof count !== "number") return "tokens unknown";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M tok`;
  if (count >= 1000) return `${Math.round(count / 1000)}k tok`;
  return `${count} tok`;
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AITaskMeter({ usage }) {
  const [copied, setCopied] = useState(false);

  if (!usage) return null;

  const log = Array.isArray(usage.log) ? usage.log : [];
  const recent = log.slice(-5).reverse();
  const summary = summarizeUsageLog(log);
  const sessionTotal = usage.session?.total ?? 0;

  const handleCopy = async () => {
    const csv = usageLogToCsv(log);
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ai-task-meter" data-testid="task-meter">
      <div className="ai-task-meter-header">
        <span className="ai-task-meter-title">Task meter — honest by design</span>
        <button
          type="button"
          className="ai-task-meter-copy"
          data-testid="task-meter-copy"
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy usage log"}
        </button>
      </div>
      <div className="ai-task-meter-body">
        {recent.length === 0 ? (
          <div className="ai-task-meter-empty">No AI turns recorded yet.</div>
        ) : (
          <ul className="ai-task-meter-rows">
            {recent.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="ai-task-meter-row">
                <span className="ai-task-meter-time">{formatTime(entry.timestamp)}</span>
                <span className="ai-task-meter-provider">
                  {entry.provider}
                  {entry.model ? `/${entry.model}` : ""}
                </span>
                <span className="ai-task-meter-kind">{entry.kind === "agent" ? "agent" : "chat"}</span>
                <span className="ai-task-meter-tokens">
                  {entry.known ? formatTokenCount(entry.totalTokens) : "tokens unknown"}
                </span>
                <span className={`ai-task-meter-spend${isLocalProvider(entry.provider) ? " ai-task-meter-spend-local" : ""}`}>
                  {describeUsageSpend(entry.provider, entry.accounting)}
                </span>
                {typeof entry.durationMs === "number" && (
                  <span className="ai-task-meter-duration">{formatDurationMs(entry.durationMs)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="ai-task-meter-totals" data-testid="task-meter-totals">
          Session: {summary.turns} turn{summary.turns === 1 ? "" : "s"}
          {" · "}
          {formatTokenCount(summary.knownTokens)} known
          {summary.unknownAccounting > 0 && ` · ${summary.unknownAccounting} unknown accounting`}
          {" · "}
          {formatTokenCount(sessionTotal)} total
        </div>
      </div>
    </div>
  );
}
