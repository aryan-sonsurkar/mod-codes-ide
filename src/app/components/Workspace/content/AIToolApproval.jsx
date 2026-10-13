"use client";
import { useState } from "react";
import { ShieldAlert, AlertTriangle, Check, X } from "lucide-react";
import { basenameOf } from "../../../lib/ai/protectedPaths";

export default function AIToolApproval({ request, onApprove, onReject }) {
  const [confirmText, setConfirmText] = useState("");
  if (!request) {
    return null;
  }
  const permissionLabel = request.permission || "read";
  const needsApproval = request.requiresApproval;
  const isProtected = Boolean(request.protected);
  const confirmTarget = basenameOf(request.protectedPath || request.args?.path || "");
  const confirmOk = !isProtected || confirmText.trim() === confirmTarget;

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
      {isProtected && (
        <div className="ai-tool-approval-protected" role="alert" data-testid="tool-approval-protected">
          <AlertTriangle size={13} />
          <div className="ai-tool-approval-protected-body">
            <strong>Protected file: {confirmTarget}</strong>
            <p>{request.protectedReason}</p>
            <input
              className="ai-tool-approval-confirm"
              aria-label="Type the file name to confirm"
              placeholder={`Type ${confirmTarget} to confirm`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
            />
          </div>
        </div>
      )}
      {needsApproval ? (
        <div className="ai-tool-approval-actions">
          <button
            type="button"
            className="ai-tool-approve"
            disabled={!confirmOk}
            title={confirmOk ? "Approve this tool call" : "Type the file name first"}
            onClick={() => onApprove && onApprove(request)}
          >
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
