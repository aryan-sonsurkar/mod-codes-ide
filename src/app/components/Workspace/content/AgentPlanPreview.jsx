"use client";
import { Check, X, ShieldAlert } from "lucide-react";

export default function AgentPlanPreview({ task, onApprove, onReject }) {
  if (!task || !Array.isArray(task.steps)) {
    return null;
  }
  return (
    <div className="ai-agent-plan" role="region" aria-label="Agent plan">
      <div className="ai-agent-plan-header">
        <strong>Plan: {task.title}</strong>
        {task.description && <p className="ai-agent-plan-desc">{task.description}</p>}
      </div>
      <ol className="ai-agent-plan-steps">
        {task.steps.map((step, index) => (
          <li key={step.id} className="ai-agent-plan-step">
            <span className="ai-agent-step-index">{index + 1}</span>
            <div className="ai-agent-step-info">
              <strong>{step.title}</strong>
              {step.reason && <span className="ai-agent-step-reason">{step.reason}</span>}
              {step.expectedTools.length > 0 && (
                <span className="ai-agent-step-tools">Tools: {step.expectedTools.join(", ")}</span>
              )}
              {step.expectedFiles.length > 0 && (
                <span className="ai-agent-step-files">Files: {step.expectedFiles.join(", ")}</span>
              )}
              {step.risk && (
                <span className="ai-agent-step-risk">
                  <ShieldAlert size={10} />
                  {step.risk}
                </span>
              )}
            </div>
            <span className={`ai-agent-step-state ai-agent-step-${step.state}`}>{step.state}</span>
          </li>
        ))}
      </ol>
      <div className="ai-agent-plan-actions">
        <button type="button" className="ai-agent-approve" onClick={() => onApprove && onApprove()}>
          <Check size={12} />
          Approve plan
        </button>
        <button type="button" className="ai-agent-reject" onClick={() => onReject && onReject()}>
          <X size={12} />
          Reject plan
        </button>
      </div>
    </div>
  );
}
