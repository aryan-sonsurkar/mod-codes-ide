"use client";
import { Play, Check, X, Loader, AlertTriangle, ShieldAlert, Eye } from "lucide-react";

const STEP_ICONS = {
  pending: null,
  executing: <Loader size={11} className="ai-agent-spin" />,
  completed: <Check size={11} />,
  failed: <X size={11} />,
  observing: <Eye size={11} />,
};

function StepStatus({ step }) {
  const state = step.state || "pending";
  const icon = STEP_ICONS[state] || null;
  return (
    <span className={`ai-agent-step-status ai-agent-step-status-${state}`}>
      {icon}
      {state}
    </span>
  );
}

function RiskBadge({ risk }) {
  if (!risk || risk === "low") return null;
  return (
    <span className={`ai-agent-risk ai-agent-risk-${risk}`}>
      <ShieldAlert size={10} />
      {risk}
    </span>
  );
}

function ObservationList({ observations }) {
  if (!observations || observations.length === 0) return null;
  return (
    <div className="ai-agent-observations">
      <span className="ai-agent-obs-header">Observations ({observations.length})</span>
      <ul className="ai-agent-obs-list">
        {observations.map((obs, i) => (
          <li key={obs.timestamp || i} className={`ai-agent-obs-item ai-agent-obs-${obs.status}`}>
            <span className="ai-agent-obs-tool">{obs.tool}</span>
            <span className="ai-agent-obs-status">{obs.status}</span>
            {obs.durationMs != null && (
              <span className="ai-agent-obs-duration">{obs.durationMs}ms</span>
            )}
            {typeof obs.result === "string" && obs.result.length > 0 && (
              <span className="ai-agent-obs-result" title={obs.result}>
                {obs.result.length > 80 ? obs.result.slice(0, 80) + "..." : obs.result}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AgentProgress({
  snapshot,
  onApprove,
  onReject,
  onCancel,
  onAcceptChangeset,
  onRejectChangeset,
  onOpenFile,
}) {
  if (!snapshot) return null;
  const { state, task, plan, observations, changeset } = snapshot;
  const steps = task?.steps || plan?.steps || [];
  const isRunning = state === "executing" || state === "observing" || state === "planning";
  const isAwaitingPlan = state === "awaitingApproval" || state === "planReady";
  const isReviewing = state === "awaitingReview" || state === "changesProposed";

  return (
    <div className="ai-agent-progress" role="region" aria-label="Agent progress">
      <div className="ai-agent-progress-header">
        <strong>Agent: {task?.title || "Working..."}</strong>
        <span className={`ai-agent-state ai-agent-state-${state}`}>{state}</span>
      </div>

      {task?.description && (
        <p className="ai-agent-progress-desc">{task.description}</p>
      )}

      {steps.length > 0 && (
        <ol className="ai-agent-steps">
          {steps.map((step, index) => (
            <li
              key={step.id || index}
              className={`ai-agent-step ai-agent-step-${step.state || "pending"}`}
            >
              <span className="ai-agent-step-num">{index + 1}</span>
              <div className="ai-agent-step-body">
                <div className="ai-agent-step-main">
                  <strong>{step.title}</strong>
                  <StepStatus step={step} />
                </div>
                {step.reason && (
                  <span className="ai-agent-step-reason">{step.reason}</span>
                )}
                <div className="ai-agent-step-meta">
                  {step.expectedTools?.length > 0 && (
                    <span className="ai-agent-step-tools">
                      Tools: {step.expectedTools.join(", ")}
                    </span>
                  )}
                  <RiskBadge risk={step.risk} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ObservationList observations={observations} />

      {isAwaitingPlan && (
        <div className="ai-agent-actions">
          <button type="button" className="ai-agent-btn ai-agent-approve" onClick={onApprove}>
            <Play size={12} />
            Approve & Run
          </button>
          <button type="button" className="ai-agent-btn ai-agent-reject" onClick={onReject}>
            <X size={12} />
            Reject
          </button>
        </div>
      )}

      {isRunning && (
        <div className="ai-agent-actions">
          <p className="ai-agent-running">
            <Loader size={12} className="ai-agent-spin" />
            {state === "planning" ? "Planning..." :
             state === "executing" ? "Executing step..." :
             state === "observing" ? "Recording observation..." : "Working..."}
          </p>
          <button type="button" className="ai-agent-btn ai-agent-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {isReviewing && changeset && (
        <div className="ai-agent-changeset">
          <div className="ai-agent-changeset-header">
            <AlertTriangle size={12} />
            <strong>Changeset: {changeset.title || `${(changeset.operations || []).length} file(s)`}</strong>
          </div>
          {(changeset.operations || []).length > 0 && (
            <ul className="ai-agent-changeset-ops">
              {changeset.operations.map((op) => (
                <li key={op.id || op.path} className="ai-agent-changeset-op">
                  <span className="ai-agent-changeset-path">{op.path}</span>
                  <span className="ai-agent-changeset-type">{op.type || op.operation || "modify"}</span>
                  {onOpenFile && (
                    <button type="button" className="ai-agent-btn-sm" onClick={() => onOpenFile(op)}>
                      Open
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="ai-agent-actions">
            <button type="button" className="ai-agent-btn ai-agent-approve" onClick={onAcceptChangeset}>
              <Check size={12} />
              Accept All
            </button>
            <button type="button" className="ai-agent-btn ai-agent-reject" onClick={onRejectChangeset}>
              <X size={12} />
              Reject All
            </button>
          </div>
        </div>
      )}

      {state === "completed" && (
        <div className="ai-agent-done">
          <Check size={12} />
          Agent completed. Save files to write changes to disk.
        </div>
      )}

      {state === "failed" && (
        <div className="ai-agent-done ai-agent-done-error">
          <X size={12} />
          Agent failed: {task?.error || "Unknown error"}
        </div>
      )}

      {state === "cancelled" && (
        <div className="ai-agent-done">
          <X size={12} />
          Agent cancelled.
        </div>
      )}
    </div>
  );
}
