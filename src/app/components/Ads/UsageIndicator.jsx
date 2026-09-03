"use client";
import { useState } from "react";

function formatTokens(count) {
  if (count === null || count === undefined) return null;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}k`;
  return String(count);
}

export default function UsageIndicator({ usage, limitStatus, onOpenSettings }) {
  const [expanded, setExpanded] = useState(false);

  if (!usage) return null;

  const dailyTotal = usage.daily?.total ?? 0;
  const dailyLimit = usage.daily?.limit;
  const sessionTotal = usage.session?.total ?? 0;
  const sessionLimit = usage.session?.limit;
  const projectTotal = usage.project?.total ?? 0;
  const projectLimit = usage.project?.limit;

  const isLimited = limitStatus && limitStatus.status === "limit_reached";

  const dailyLabel = dailyLimit !== null
    ? `${formatTokens(dailyTotal)} / ${formatTokens(dailyLimit)}`
    : formatTokens(dailyTotal);

  return (
    <div
      className="ai-usage-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        fontSize: "11px",
        color: isLimited ? "#ef4444" : "#9ca3af",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setExpanded(!expanded)}
      title="AI Usage"
    >
      <span style={{ fontWeight: 500 }}>AI Usage</span>
      <span>·</span>
      {isLimited ? (
        <span style={{ color: "#ef4444", fontWeight: 500 }}>
          {limitStatus.message || "Limit reached"}
        </span>
      ) : dailyLimit !== null ? (
        <span>
          Today {dailyLabel}
        </span>
      ) : (
        <span>Unlimited</span>
      )}
      {expanded && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            background: "#1a1a2e",
            border: "1px solid #333",
            borderRadius: "6px",
            padding: "8px 12px",
            minWidth: "180px",
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ marginBottom: "4px", fontWeight: 500 }}>Usage Details</div>
          <div>Session: {formatTokens(sessionTotal)}{sessionLimit !== null ? ` / ${formatTokens(sessionLimit)}` : ""}</div>
          <div>Daily: {formatTokens(dailyTotal)}{dailyLimit !== null ? ` / ${formatTokens(dailyLimit)}` : ""}</div>
          <div>Project: {formatTokens(projectTotal)}{projectLimit !== null ? ` / ${formatTokens(projectLimit)}` : ""}</div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
              style={{
                marginTop: "6px",
                background: "transparent",
                color: "#8B5CF6",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                padding: 0,
              }}
            >
              View in Settings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
