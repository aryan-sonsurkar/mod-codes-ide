"use client";
import { useEffect, useState, useRef } from "react";
import { Play, Check, X, Loader } from "lucide-react";
import { createAgentOrchestrator } from "../../../lib/ai/agentOrchestrator";
import { createPlanner } from "../../../lib/ai/agentPlanner";
import { createToolRegistry, createTool } from "../../../lib/ai/tools";
import { createObservation } from "../../../lib/ai/agentObservation";
import { agentObservationsToChangeset } from "../../../lib/ai/agentChangeGeneration";
import AgentPlanPreview from "./AgentPlanPreview";
import AIChangeReview from "./AIChangeReview";

export default function AgentWorkflowDemo({ getContextData, onApplyDiff, onNavigate }) {
  const orchestratorRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);

  if (orchestratorRef.current == null) {
    const registry = createToolRegistry();
    registry.registerTool(createTool({ id: "ide.current-file", name: "Current file", permission: "read", execute: async () => "file content" }));
    registry.registerTool(createTool({ id: "ide.diagnostics", name: "Diagnostics", permission: "read", execute: async () => "no diagnostics" }));
    registry.registerTool(createTool({ id: "ide.open-files", name: "Open files", permission: "read", execute: async () => "files" }));
    orchestratorRef.current = createAgentOrchestrator({
      maxSteps: 6,
      maxToolRounds: 3,
      contextBudget: 8000,
      planner: createPlanner({ maxSteps: 6 }),
      toolRegistry: registry,
    });
  }

  useEffect(() => {
    const unsub = orchestratorRef.current.subscribe(setSnapshot);
    setSnapshot(orchestratorRef.current.getSnapshot());
    return unsub;
  }, []);

  const startDemo = async () => {
    const context = getContextData ? getContextData() : {};
    await orchestratorRef.current.startTask({ title: "Find the bug in this project and fix it.", description: "Bounded demo: inspect, propose, review, save-gated.", context });
  };

  const approve = () => {
    orchestratorRef.current.approvePlan();
    // simulate tool execution then changeset
    window.setTimeout(async () => {
      try {
        const obs = await orchestratorRef.current.executeStep({ toolName: "ide.diagnostics", args: {} });
        const observation = createObservation({ tool: "ide.diagnostics", args: {}, result: obs.result, status: "success", durationMs: obs.durationMs || 10 });
        const changeset = agentObservationsToChangeset({
          title: "Demo fix",
          observations: [observation],
          proposedEdits: [
            { path: "src/demo-fix.js", operation: "modify", original: "const x=1", proposed: "const x=2 // fixed", reason: "demo" },
            { path: "src/demo-fix-2.js", operation: "create", proposed: "// new file for multi-file demo\n", reason: "demo" },
          ],
        });
        orchestratorRef.current.proposeChangeset(changeset);
      } catch {
        // ignore
      }
    }, 300);
  };

  const state = snapshot ? snapshot.state : "idle";
  const task = snapshot ? snapshot.task : null;
  const plan = snapshot ? snapshot.plan : null;
  const changeset = snapshot ? snapshot.changeset : null;

  return (
    <div className="ai-agent-demo" role="region" aria-label="Controlled agent demo">
      <div className="ai-agent-demo-header">
        <strong>Controlled Agent Demo</strong>
        <span className="ai-agent-state">{state}</span>
      </div>
      {state === "idle" && (
        <button type="button" className="ai-agent-start" onClick={startDemo}>
          <Play size={12} />
          Start: Find bug and fix it
        </button>
      )}
      {(state === "awaitingApproval" || state === "planReady") && plan && (
        <AgentPlanPreview task={{ ...task, steps: plan.steps || task.steps }} onApprove={approve} onReject={() => orchestratorRef.current.rejectPlan("User rejected")} />
      )}
      {(state === "executing" || state === "observing") && (
        <p className="ai-agent-status">
          <Loader size={12} />
          Executing read-only tools…
        </p>
      )}
      {(state === "awaitingReview" || state === "changesProposed") && changeset && (
        <AIChangeReview
          changeset={changeset}
          onAccept={(id) => {
            const op = changeset.operations.find((o) => o.id === id);
            if (op && onApplyDiff) {
              onApplyDiff({ path: op.path, original: op.original || "", proposed: op.proposed || "" });
            }
          }}
          onReject={() => {}}
          onAcceptAll={() => {
            for (const op of changeset.operations) {
              if (onApplyDiff) {
                onApplyDiff({ path: op.path, original: op.original || "", proposed: op.proposed || "" });
              }
            }
            orchestratorRef.current.complete();
          }}
          onRejectAll={() => orchestratorRef.current.cancel()}
          onOpenFile={(op) => onNavigate && onNavigate({ path: op.path })}
        />
      )}
      {state === "completed" && <p className="ai-agent-status"><Check size={12} /> Completed — save dirty files to write to disk.</p>}
      {state === "cancelled" && <p className="ai-agent-status"><X size={12} /> Cancelled</p>}
      {state === "failed" && <p className="ai-agent-status">Failed</p>}
      {snapshot && snapshot.task && (state === "executing" || state === "observing") && (
        <button type="button" className="ai-agent-cancel" onClick={() => orchestratorRef.current.cancel()}>
          Cancel
        </button>
      )}
    </div>
  );
}
