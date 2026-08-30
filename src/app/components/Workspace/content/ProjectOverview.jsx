"use client";
import { useMemo } from "react";
import { PHASE_LABELS, phaseProgress } from "../../../lib/project/state";
import { reconcileProjectMemory } from "../../../lib/project/reconcile";
import "./ProjectOverview.css";

export default function ProjectOverview({ modcodesData, codebaseSnapshot, onContinue, onReview, onOpen, onPhaseChange }) {
  const reconciliation = useMemo(() => reconcileProjectMemory({ modcodesData, codebaseSnapshot }), [modcodesData, codebaseSnapshot]);
  if (!modcodesData) {
    return <div className="project-overview">No project memory. Create .modcodes to start.</div>;
  }
  const phase = String(modcodesData.project?.phase || "idea");
  const label = PHASE_LABELS[phase] || phase;
  const progress = phaseProgress(phase);
  const lastWorked = modcodesData.project?.updatedAt ? new Date(modcodesData.project.updatedAt).toLocaleDateString() : "Unknown";
  const filesChanged = codebaseSnapshot?.filesChangedSinceLastSession ?? 0;

  return (
    <div className="project-overview">
      <h2>Continue Project — {modcodesData.project?.name}</h2>
      <p className="muted">Phase: {label} · {progress}% · Last worked: {lastWorked}</p>
      <div className="overview-grid">
        <div className="overview-card">
          <strong>Since last session</strong>
          <ul>
            <li>{filesChanged} files changed</li>
            <li>{codebaseSnapshot?.depsCount ?? 0} deps</li>
            <li>PRD {codebaseSnapshot?.prdHash ? "unchanged" : "not yet"}</li>
          </ul>
        </div>
        <div className="overview-card">
          <strong>Project health</strong>
          <p>✓ Architecture matches</p>
          {reconciliation.proposals.length > 0 ? <p>⚠ Project memory may be outdated</p> : <p>✓ Memory fresh</p>}
        </div>
        <div className="overview-card">
          <strong>Next recommended step</strong>
          <p>{modcodesData.sections?.Progress ? String(modcodesData.sections.Progress).split("\n")[0] : "Implement next milestone task"}</p>
        </div>
      </div>
      {reconciliation.proposals.length > 0 && (
        <div className="reconcile-proposals">
          <h3>🧠 Project state update proposed</h3>
          {reconciliation.proposals.map((p) => (
            <div key={p.id} className="proposal">
              <strong>{p.title}</strong>
              <ul>{p.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
              <div className="proposal-actions">
                <button onClick={() => onReview && onReview(p)}>Accept</button>
                <button>Edit</button>
                <button>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="overview-actions">
        <button className="primary" onClick={onContinue}>Continue</button>
        <button onClick={onReview}>Review Changes</button>
        <button onClick={onOpen}>Open Project</button>
        <select value={phase} onChange={(e) => onPhaseChange && onPhaseChange(e.target.value)}>
          {Object.keys(PHASE_LABELS).map((k) => <option key={k} value={k}>{PHASE_LABELS[k]}</option>)}
        </select>
      </div>
      <p className="muted small">Physical codebase is source of truth for what exists. .modcodes is source of intent.</p>
    </div>
  );
}
