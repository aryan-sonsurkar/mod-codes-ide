"use client";
import { Check, X, FileText, AlertTriangle } from "lucide-react";

function riskForOperation(op) {
  const labels = [];
  if (op.operation === "delete") {
    labels.push("destructive");
  }
  if (op.operation === "create" && op.path.includes("config")) {
    labels.push("config file");
  }
  if (op.proposed && op.proposed.length > 10000) {
    labels.push("large change");
  }
  if (op.path.includes("package.json") || op.path.includes("dependencies")) {
    labels.push("dependency file");
  }
  if (labels.length === 0 && op.operation === "modify") {
    return "low";
  }
  if (labels.includes("destructive")) {
    return `high (${labels.join(", ")})`;
  }
  return `medium (${labels.join(", ")})`;
}

export default function AIChangeReview({
  changeset,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onOpenFile,
}) {
  if (!changeset) {
    return null;
  }
  const operations = changeset.operations || [];
  const additions = operations.reduce((sum, op) => sum + (op.proposed ? op.proposed.length : 0), 0);
  const deletions = operations.reduce((sum, op) => sum + (op.original ? op.original.length : 0), 0);
  const multiple = operations.length > 1;

  return (
    <div className="ai-change-review" role="region" aria-label="AI change review">
      <div className="ai-change-review-header">
        <strong>{changeset.title}</strong>
        <span className="ai-change-review-meta">
          {operations.length} file{operations.length === 1 ? "" : "s"} · {additions.toLocaleString()} additions · {deletions.toLocaleString()} deletions
        </span>
      </div>
      {multiple && (
        <p className="ai-change-risk">
          <AlertTriangle size={12} />
          Deterministic risk: multiple files
        </p>
      )}
      <ul className="ai-change-list">
        {operations.map((op) => (
          <li key={op.id} className="ai-change-item">
            <span className="ai-change-path">
              <FileText size={12} />
              {op.path}
            </span>
            <span className="ai-change-op">{op.operation}</span>
            <span className="ai-change-risk-label">{riskForOperation(op)}</span>
            <button type="button" className="ai-change-open" onClick={() => onOpenFile && onOpenFile(op)}>
              Open
            </button>
            <button type="button" className="ai-change-accept" onClick={() => onAccept && onAccept(op.id)}>
              <Check size={12} />
              Accept
            </button>
            <button type="button" className="ai-change-reject" onClick={() => onReject && onReject(op.id)}>
              <X size={12} />
              Reject
            </button>
          </li>
        ))}
      </ul>
      <div className="ai-change-review-actions">
        <button type="button" className="ai-change-accept-all" onClick={() => onAcceptAll && onAcceptAll()}>
          Accept all
        </button>
        <button type="button" className="ai-change-reject-all" onClick={() => onRejectAll && onRejectAll()}>
          Reject all
        </button>
      </div>
    </div>
  );
}

export { riskForOperation };
