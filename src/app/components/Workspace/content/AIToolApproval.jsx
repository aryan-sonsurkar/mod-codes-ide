"use client";
import { ShieldAlert, Check, X } from "lucide-react";

export default function AIToolApproval({ request, onApprove, onReject }) {
  if (!request) {
    return null;
  }
  const permissionLabel = request.permission || "read";
  const needsApproval = request.requiresApproval;

  return (
    <div className="ai-tool-approval" role="dialog" aria-label="Tool approval">
      <div className="ai-tool-approval-header">
        <ShieldAlert size={14} />
        <strong>Tool requested: {request.toolName}</strong>
        <span className={`ai-tool-permission ai-tool-permission-${permissionLabel}`}>{permissionLabel}</span>
      </div>
      <p className="ai-tool-approval-reason">{request.reason}</p>
      {request.args && Object.keys(request.args).length > 0 && (
        <pre className="ai-tool-approval-args">{JSON.stringify(request.args, null, 2)}</pre>
      )}
      {needsApproval ? (
        <div className="ai-tool-approval-actions">
          <button type="button" className="ai-tool-approve" onClick={() => onApprove && onApprove(request)}>
            <Check size={12} />
            Approve
          </button>
          <button type="button" className="ai-tool-reject" onClick={() => onReject && onReject(request)}>
            <X size={12} />
            Reject
          </button>
        </div>
      ) : (
        <p className="ai-tool-auto">This read-only tool will run automatically.</p>
      )}
    </div>
  );
}
