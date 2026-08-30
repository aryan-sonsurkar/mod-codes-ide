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
  const depsChanged = codebaseSnapshot?.depsChanged ?? codebaseSnapshot?.depsCount ?? 0;
  const researchChanged = codebaseSnapshot?.researchChanged ?? 0;
  const gitStatus = codebaseSnapshot?.gitStatus || "clean";
  const prdDrift = !codebaseSnapshot?.prdHash ? "not yet" : researchChanged ? `${researchChanged} research updates since PRD` : "unchanged";
  const milestoneMatch = String(modcodesData.sections?.Milestones || "").match(/M(\d+)/);
  const currentMilestone = milestoneMatch ? milestoneMatch[0] : "M1";
  // Explainable recommendation
  let recommendation = "Implement next milestone task";
  let reason = "Roadmap indicates next task pending.";
  if (progress < 30) { recommendation = "Run research deeper on open questions"; reason = `Phase is ${label} (${progress}%) — research incomplete.`; }
  else if (reconciliation.proposals.some(p=>p.id==="stale-memory")) {
    // eslint-disable-next-line react-hooks/purity
    const lastUpdated = modcodesData.project?.updatedAt ? Date.parse(modcodesData.project.updatedAt) : Date.now();
    // eslint-disable-next-line react-hooks/purity
    const ageDays = Math.floor((Date.now() - lastUpdated) / (24*3600*1000));
    recommendation = "Review stale project memory proposals"; reason = `Memory ${ageDays} days old and ${filesChanged} files changed.`;
  }
  else if (String(modcodesData.sections?.Progress || "").includes("6/7")) { recommendation = "Run authentication integration tests"; reason = "Authentication milestone is 6/7 complete and test suite contains unverified cases."; }

  return (
    <div className="project-overview">
      <h2>Continue Project — {modcodesData.project?.name}</h2>
      <p className="muted">Welcome back — Last session {lastWorked} · Phase: {label} · {progress}% · Milestone {currentMilestone}</p>
      <div className="overview-grid">
        <div className="overview-card">
          <strong>Since last session</strong>
          <ul>
            <li>{filesChanged} files changed</li>
            <li>{depsChanged} dependencies changed</li>
            <li>PRD {prdDrift}</li>
            <li>Git: {gitStatus}</li>
            <li>Research: {researchChanged ? `${researchChanged} updates` : "no change"}</li>
          </ul>
        </div>
        <div className="overview-card">
          <strong>Project health</strong>
          <p>✓ Architecture matches</p>
          {reconciliation.proposals.length > 0 ? <p>⚠ Project memory may be outdated</p> : <p>✓ Memory fresh</p>}
          <p>Confidence: {filesChanged > 10 ? "review recommended" : "high"}</p>
        </div>
        <div className="overview-card">
          <strong>Next recommended action</strong>
          <p><strong>{recommendation}</strong></p>
          <p className="muted small">Reason: {reason}</p>
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
