"use client";
import { Clock, Trash2, ExternalLink } from "lucide-react";

export default function AIActionHistory({ entries, onClear, onNavigate }) {
  if (!entries || entries.length === 0) {
    return null;
  }
  return (
    <div className="ai-action-history" role="region" aria-label="AI activity">
      <div className="ai-action-history-header">
        <strong>
          <Clock size={12} />
          AI Activity
        </strong>
        <button type="button" className="ai-action-clear" onClick={() => onClear && onClear()}>
          <Trash2 size={12} />
          Clear
        </button>
      </div>
      <ul className="ai-action-list">
        {entries.slice(0, 20).map((entry) => (
          <li key={entry.id} className="ai-action-item">
            <span className="ai-action-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className="ai-action-title">{entry.action}</span>
            {entry.accepted != null && (
              <span className={`ai-action-result ${entry.accepted ? "ai-action-accepted" : "ai-action-rejected"}`}>
                {entry.accepted ? "Accepted" : "Rejected"}
              </span>
            )}
            {entry.files.length > 0 && (
              <button
                type="button"
                className="ai-action-navigate"
                onClick={() => onNavigate && onNavigate(entry.files[0])}
              >
                <ExternalLink size={10} />
                {entry.files[0]}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
