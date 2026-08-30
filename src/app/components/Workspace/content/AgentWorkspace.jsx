"use client";
import { useEffect, useState } from "react";
import "./AgentWorkspace.css";

export default function AgentWorkspace({ orchestrator }) {
  const [snap, setSnap] = useState(() => orchestrator ? orchestrator.getSnapshot() : { state: "idle", task: { title: "Idle" }, plan: null, observations: [], changeset: null });

  useEffect(() => {
    if (!orchestrator || !orchestrator.subscribe) return;
    const unsub = orchestrator.subscribe(setSnap);
    return unsub;
  }, [orchestrator]);

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
