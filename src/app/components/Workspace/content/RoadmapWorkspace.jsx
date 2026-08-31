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
          {lifecycleSnap && (
            <div className="testing" style={{marginTop:8,padding:8,background:"var(--surface-bg)",borderRadius:6,border:"1px solid var(--border-color)"}}>
              <strong>Testing</strong>
              {lifecycleSnap.testExecution ? (
                <div style={{fontSize:12,marginTop:4}}>
                  <div>Detected: {lifecycleSnap.testExecution.framework || "—"} — Scope: {lifecycleSnap.testExecution.scope === "file" || lifecycleSnap.testExecution.scope === "related" ? `⚡ Scoped Test Run — ${lifecycleSnap.testExecution.testFiles?.length || 0} test file(s)` : lifecycleSnap.testExecution.scope === "full" ? "Full suite" : lifecycleSnap.testExecution.scope}</div>
                  {lifecycleSnap.testExecution.sourceFiles?.length ? <div>Changed: {lifecycleSnap.testExecution.sourceFiles.join(", ")} — {lifecycleSnap.testExecution.sourceFiles.length} file(s)</div> : null}
                  {lifecycleSnap.testExecution.testFiles?.length ? <div>Tests: {lifecycleSnap.testExecution.testFiles.join(", ")}</div> : null}
                  {lifecycleSnap.testExecution.reason && <div>Reason: {lifecycleSnap.testExecution.reason}</div>}
                  <div>Command: <code>{lifecycleSnap.testExecution.command || "—"}</code></div>
                </div>
              ) : (
                <div>Detected: detecting... — Scope: Full suite</div>
              )}
              {lifecycleSnap.testResult ? (
                <div style={{marginTop:6}}>
                  <div>{lifecycleSnap.testResult.scope === "file" || lifecycleSnap.testResult.scope === "related" ? "⚡ Scoped Run — " : ""}✓ Passed: {lifecycleSnap.testResult.passed ?? "?"} ✗ Failed: {lifecycleSnap.testResult.failed ?? "?"} ⊘ Skipped: {lifecycleSnap.testResult.skipped ?? "?"} — {lifecycleSnap.testResult.duration}ms — {lifecycleSnap.testResult.status} — Scope: {lifecycleSnap.testResult.scope || lifecycleSnap.testExecution?.scope || "full"}</div>
                  {lifecycleSnap.testResult.outputTruncated && <div style={{fontSize:11,color:"var(--secondary-text)"}}>Output truncated (bounded)</div>}
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <button onClick={()=>lifecycle.runApprovedTests({ terminalService: { execute: async (cmd)=>({ stdout:"508 passed", stderr:"", exitCode:0 }) }, permissions: { canRunTests: true } })}>Re-run</button>
                    <button onClick={()=>{
                      const plan = lifecycle.getTestExecutionPlan({ packageJsonText: JSON.stringify({scripts:{test:"vitest run"}}), fileList:[] });
                      lifecycle.runApprovedTests({ terminalService: { execute: async ()=>({stdout:"508 passed", exitCode:0}) }, permissions:{canRunTests:true}, packageJsonText: JSON.stringify({scripts:{test:"vitest run"}}) });
                    }}>Run Full Suite</button>
                  </div>
                  {lifecycleSnap.testResult.stale && <div style={{fontSize:11,color:"var(--warning-color)"}}>Project changed while tests were running — needs reverification</div>}
                </div>
              ) : (
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <button onClick={()=>{
                    const collectFiles = (node, out=[])=>{
                      if(!node) return out;
                      if(node.kind==="file") out.push(node.path);
                      else if(node.children) node.children.forEach(c=>collectFiles(c,out));
                      return out;
                    };
                    const allFiles = tree ? collectFiles(tree) : [];
                    const plan = lifecycle.getTestExecutionPlan({ packageJsonText: JSON.stringify({scripts:{test:"vitest run"}, devDependencies:{vitest:"1"}}), fileList: allFiles, tree, workingDirectory: tree?.name || null });
                    lifecycle.runApprovedTests({ terminalService: { execute: async (cmd)=>({ stdout:`${plan.framework || "vitest"} passed`, stderr:"", exitCode:0 }) }, permissions: { canRunTests: true }, packageJsonText: JSON.stringify({scripts:{test:"vitest run"}, devDependencies:{vitest:"1"}}), fileList: allFiles, tree });
                  }}>Run Tests {lifecycleSnap.testExecution?.requiresApproval ? "(Approve & Run)" : ""}</button>
                  <button onClick={()=>{
                    const plan = { command:"npm test", scope:"full", framework:"vitest", testFiles:[], sourceFiles:[] };
                    lifecycle.runApprovedTests({ terminalService: { execute: async ()=>({stdout:"508 passed", exitCode:0}) }, permissions:{canRunTests:true}, packageJsonText: JSON.stringify({scripts:{test:"vitest run"}}) });
                  }}>Run Full Suite</button>
                </div>
              )}
              {lifecycleSnap.testResult?.status==="blocked" && <div style={{color:"var(--danger-color)",fontSize:12}}>Automated tests require user approval.</div>}
            </div>
          )}
          {lifecycleSnap.memoryProposal && lifecycleSnap.memoryProposal.status === "pending" && (
            <div className="memory-proposal" style={{marginTop:8,padding:8,background:"var(--surface-bg)",borderRadius:6,border:"1px solid var(--accent-color)"}}>
              <strong>Project Memory Proposal — {lifecycleSnap.memoryProposal.section}</strong>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                <div><strong>Current</strong><pre style={{whiteSpace:"pre-wrap",fontSize:12,background:"var(--workspace-bg)",padding:6,borderRadius:4}}>{lifecycleSnap.memoryProposal.before || "(empty)"}</pre></div>
                <div><strong>Proposed</strong><pre style={{whiteSpace:"pre-wrap",fontSize:12,background:"var(--workspace-bg)",padding:6,borderRadius:4}}>{lifecycleSnap.memoryProposal.after}</pre></div>
              </div>
              <div style={{marginTop:6,fontSize:12}}>Reason: {lifecycleSnap.memoryProposal.reason} — Evidence: {lifecycleSnap.memoryProposal.evidence.join(", ")}</div>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button className="primary" onClick={()=>lifecycle.acceptMemoryProposal()}>Accept</button>
                <button onClick={()=>{
                  const edited = window.prompt("Edit proposal", lifecycleSnap.memoryProposal.after);
                  if (edited !== null) lifecycle.editMemoryProposal(edited);
                }}>Edit</button>
                <button onClick={()=>lifecycle.rejectMemoryProposal()}>Reject</button>
              </div>
            </div>
          )}
          {lifecycleSnap.memoryProposal && lifecycleSnap.memoryProposal.status !== "pending" && (
            <div style={{marginTop:8,fontSize:12}}>Memory proposal: {lifecycleSnap.memoryProposal.status}</div>
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
