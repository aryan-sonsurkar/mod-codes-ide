"use client";
import { useMemo } from "react";
import { PHASE_LABELS, phaseProgress } from "../../../lib/project/state";
import { reconcileProjectMemory } from "../../../lib/project/reconcile";
import "./ProjectOverview.css";

export default function ProjectOverview({ modcodesData, codebaseSnapshot, onContinue, onReview, onOpen, onPhaseChange }) {
  const reconciliation = useMemo(() => reconcileProjectMemory({ modcodesData, codebaseSnapshot }), [modcodesData, codebaseSnapshot]);
  if (!modcodesData) {
    return (
      <div className="project-overview">
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">&#x1F4DD;</div>
          <h3>No project memory yet</h3>
          <p>Project memory (.modcodes) tracks your project&apos;s phase, milestones, and decisions. The editor works without it, but recommendations and lifecycle features require it.</p>
          <button className="primary" style={{marginTop:12}} onClick={onOpen}>Open Project</button>
        </div>
      </div>
    );
  }
  const phase = String(modcodesData.project?.phase || "idea");
  const label = PHASE_LABELS[phase] || phase;
  const progress = phaseProgress(phase);
  const lastWorked = modcodesData.project?.updatedAt ? new Date(modcodesData.project.updatedAt).toLocaleDateString() : "Unknown";
  const researchChanged = codebaseSnapshot?.researchChanged ?? 0;
  const prdExists = Boolean(codebaseSnapshot?.prdHash);
  const milestoneMatch = String(modcodesData.sections?.Milestones || "").match(/M(\d+)/);
  const currentMilestone = milestoneMatch ? milestoneMatch[0] : null;

  // Honest recommendation based on real data
  let recommendation = "Continue with current phase";
  let reason = `Phase is ${label} (${progress}%).`;
  if (progress < 30) {
    recommendation = "Deepen research before moving forward";
    reason = `Early phase (${label}, ${progress}%). Ensure research is thorough.`;
  } else if (reconciliation.proposals.some(p => p.id === "stale-memory")) {
    recommendation = "Review project memory — may be outdated";
    reason = "Memory may be outdated. Review and update if needed.";
  } else if (!prdExists) {
    recommendation = "Create a PRD before planning development";
    reason = "No PRD found in project memory.";
  }

  return (
    <div className="project-overview">
      <h2>Continue Project — {modcodesData.project?.name}</h2>
      <p className="muted">Last worked {lastWorked} · Phase: {label} ({progress}%)</p>
      <div className="overview-grid">
        <div className="overview-card">
          <strong>Project state</strong>
          <ul>
            <li>Phase: {label} ({progress}%)</li>
            <li>PRD: {prdExists ? "present" : "not created yet"}</li>
            <li>Milestone: {currentMilestone || "none detected"}</li>
            <li>Research: {researchChanged ? `${researchChanged} updates` : "no recorded changes"}</li>
            <li>Memory age: {lastWorked}</li>
          </ul>
        </div>
        <div className="overview-card">
          <strong>Memory status</strong>
          {reconciliation.proposals.length > 0 ? (
            <p>⚠ Project memory may need updating — {reconciliation.proposals.length} suggestion{reconciliation.proposals.length === 1 ? "" : "s"}</p>
          ) : (
            <p>✓ Memory is up to date</p>
          )}
          <p className="muted small">Physical codebase is source of truth. .modcodes is source of intent.</p>
        </div>
        <div className="overview-card">
          <strong>Recommended next step</strong>
          <p><strong>{recommendation}</strong></p>
          <p className="muted small">Why: {reason}</p>
        </div>
      </div>
      {reconciliation.proposals.length > 0 && (
        <div className="reconcile-proposals">
          <h3>Project memory suggestions</h3>
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
        <button onClick={onOpen}>Open Project</button>
        <select value={phase} onChange={(e) => onPhaseChange && onPhaseChange(e.target.value)} aria-label="Change project phase">
          {Object.keys(PHASE_LABELS).map((k) => <option key={k} value={k}>{PHASE_LABELS[k]}</option>)}
        </select>
      </div>
    </div>
  );
}
