"use client";
import { useEffect, useState } from "react";
import "./AgentWorkspace.css";

export default function AgentWorkspace({ orchestrator, lifecycle }) {
  const [snap, setSnap] = useState(() => orchestrator ? orchestrator.getSnapshot() : { state: "idle", task: { title: "Idle" }, plan: null, observations: [], changeset: null });
  const [lifecycleSnap, setLifecycleSnap] = useState(() => lifecycle ? lifecycle.getSnapshot() : null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    if (!orchestrator || !orchestrator.subscribe) return;
    const unsub = orchestrator.subscribe(setSnap);
    return unsub;
  }, [orchestrator]);

  useEffect(() => {
    if (!lifecycle || !lifecycle.subscribe) return;
    const unsub = lifecycle.subscribe(setLifecycleSnap);
    return unsub;
  }, [lifecycle]);

  const progress = snap.plan ? `${snap.observations?.length || 0}/${snap.plan.steps?.length || 0}` : "—";

  return (
    <div className="agent-ws">
      <h2>Agent Workspace</h2>
      <p className="muted">IDE remains usable while agent works. Execution is bounded and approval-gated.</p>
      <div className="agent-header">
        <strong>{snap.task?.title || "No task"}</strong>
        <span className="badge">{snap.state}</span>
        <span>{progress}</span>
      </div>
      {lifecycleSnap && lifecycleSnap.contextSelection && (
        <div className="agent-context">
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <strong>Context</strong>
            <span>{lifecycleSnap.contextSelection.selected.length} selected • {lifecycleSnap.contextSelection.rejected.length} excluded • budget {lifecycleSnap.contextSelection.budget.used}/{lifecycleSnap.contextSelection.budget.total}</span>
            <button onClick={()=>setShowContext(v=>!v)}>{showContext ? "Hide" : "View Context"}</button>
          </div>
          {showContext && (
            <div className="context-details">
              <div><strong>Selected</strong></div>
              {lifecycleSnap.contextSelection.selected.slice(0,14).map((s)=>(
                <div key={s.id || s.path} className="context-item">
                  <code>{s.path || s.id}</code> — <span>{s.reason}</span> <em>({s.provenance?.source})</em>
                </div>
              ))}
              <div style={{marginTop:6}}><strong>Excluded</strong></div>
              {lifecycleSnap.contextSelection.rejected.slice(0,6).map((s)=>(
                <div key={s.id || s.path} className="context-item muted">
                  <code>{s.path || s.id}</code> — <span>{s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {lifecycleSnap && lifecycleSnap.completionAssessment && (
        <div className="agent-context" style={{marginTop:8}}>
          <strong>Milestone Assessment: {lifecycleSnap.completionAssessment.status}</strong>
          <div>{lifecycleSnap.completionAssessment.completed}/{lifecycleSnap.completionAssessment.total} supported • {lifecycleSnap.completionAssessment.blockers.length} blocker(s)</div>
          <button>View Assessment</button>
        </div>
      )}
      <div className="agent-grid">
        <div className="agent-card"><strong>Plan</strong><pre>{snap.plan ? JSON.stringify(snap.plan,null,2).slice(0,800) : "— no plan yet"}</pre></div>
        <div className="agent-card"><strong>Progress</strong><pre>Current: {snap.task?.currentStep || "—"}{"\n"}Observations: {(snap.observations||[]).length}</pre></div>
        <div className="agent-card"><strong>Files</strong><pre>{snap.changeset ? JSON.stringify(snap.changeset,null,2).slice(0,600) : "— no files yet"}</pre></div>
        <div className="agent-card"><strong>Tests / Errors</strong><pre>{snap.observations?.map(o=>o.text||JSON.stringify(o)).join("\n").slice(0,600) || "—"}</pre></div>
      </div>
      <div className="agent-controls">
        <button>Pause</button>
        <button>Resume</button>
        <button>Cancel</button>
        <button className="primary">Review Changes</button>
      </div>
      <p className="muted small">Permanent FS changes remain behind Save. Concurrent edits → Review / Keep mine / Keep agent / Merge.</p>
    </div>
  );
}
