"use client";
import { useState, useMemo } from "react";
import { buildRoadmap } from "../../../lib/project/roadmap";
import { createProjectLifecycleOrchestrator } from "../../../lib/project/lifecycle";
import { createAgentOrchestrator } from "../../../lib/ai/agentOrchestrator";
import { createPlanner } from "../../../lib/ai/agentPlanner";
import { createToolRegistry } from "../../../lib/ai/tools/registry";
import "./RoadmapWorkspace.css";

function parseMilestones(text) {
  const src = String(text || "");
  const ids = [];
  const re = /^##\s+(M\d+):?\s*([^\n]+)/gm;
  let m;
  while ((m = re.exec(src))) ids.push({ id: m[1], goal: m[2].trim(), title: m[2].trim(), tasks: [], risks: [], criteria: "" });
  return ids;
}

export default function RoadmapWorkspace({ modcodesData, onUpdate, tree, lifecycle: lifecycleProp, onSwitchToAgent }) {
  const [view, setView] = useState(() => String(modcodesData?.sections?.Roadmap || ""));
  const [lifecycleSnap, setLifecycleSnap] = useState(null);

  const lifecycle = useMemo(() => {
    if (lifecycleProp) {
      lifecycleProp.subscribe(setLifecycleSnap);
      return lifecycleProp;
    }
    const planner = createPlanner({ maxSteps: 7 });
    const agent = createAgentOrchestrator({ maxSteps: 7, planner, toolRegistry: createToolRegistry() });
    const lc = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    lc.subscribe(setLifecycleSnap);
    return lc;
  }, [lifecycleProp]);

  function handleGenerate() {
    const { data } = buildRoadmap({ modcodesData });
    setView(String(data.sections?.Roadmap || ""));
    onUpdate && onUpdate(data);
  }

  const milestones = parseMilestones(view || modcodesData?.sections?.Roadmap || "");

  async function handleStart(m) {
    const snap = await lifecycle.startMilestone({ milestone: m, modcodesData, tree, roadmapMilestones: milestones });
    setLifecycleSnap(snap);
    if (snap && snap.state === "awaitingApproval" && onSwitchToAgent) onSwitchToAgent();
  }

  return (
    <div className="roadmap-ws">
      <h2>Roadmap</h2>
      <p className="muted">Milestones derive from PRD. Agent can work through approved milestones via Lifecycle Orchestrator.</p>
      <button onClick={handleGenerate}>Generate Roadmap from PRD</button>
      {lifecycleSnap && (
        <div className="lifecycle-status">
          <strong>Lifecycle: {lifecycleSnap.state}</strong>
          {lifecycleSnap.milestone && <span> — {lifecycleSnap.milestone.id}: {lifecycleSnap.milestone.goal}</span>}
          {lifecycleSnap.state === "awaitingApproval" && (
            <button className="primary" onClick={() => lifecycle.approvePlan()}>Review Plan → Approve</button>
          )}
          {lifecycleSnap.state === "executing" && <span> Executing…</span>}
          {lifecycleSnap.state === "review" && <span> Review changes (Save Gate)</span>}
          {lifecycleSnap.error && <div className="error">Error: {lifecycleSnap.error}</div>}
          {lifecycleSnap.state === "executing" && <button onClick={() => lifecycle.cancel()}>Cancel</button>}
          {lifecycleSnap.completionAssessment && (
            <div className="completion-assessment" style={{marginTop:8,padding:8,background:"var(--surface-bg)",borderRadius:6,border:"1px solid var(--border-color)"}}>
              <strong>Assessment: {lifecycleSnap.completionAssessment.status} ({Math.round(lifecycleSnap.completionAssessment.confidence*100)}%)</strong>
              <div>{lifecycleSnap.completionAssessment.summary}</div>
              <div>{lifecycleSnap.completionAssessment.blockers.length} blocker(s)</div>
              <button onClick={()=>{}}>Review Assessment</button>
            </div>
          )}
          {lifecycleSnap.verification && (
            <div className="verification" style={{marginTop:8,padding:8,background:"var(--surface-bg)",borderRadius:6,border:"1px solid var(--border-color)"}}>
              <strong>Verification: {lifecycleSnap.verification.status}</strong>
              <div>{lifecycleSnap.verification.passed} passed, {lifecycleSnap.verification.failed} failed, {lifecycleSnap.verification.unknown} unknown, {lifecycleSnap.verification.blocked} blocked</div>
              <button>Verify</button><button>View Results</button>
            </div>
          )}
        </div>
      )}
      <div className="milestones">
        {milestones.length ? milestones.map((m)=>(
          <div key={m.id} className="milestone-card">
            <strong>{m.id}: {m.goal}</strong>
            <button onClick={()=>handleStart(m)}>Start Milestone</button>
          </div>
        )) : <p className="muted">No milestones parsed — Generate first.</p>}
      </div>
      <pre className="roadmap-pre">{view || "— no roadmap yet. Generate."}</pre>
    </div>
  );
}
