"use client";
import { useMemo, useState, useEffect } from "react";
import { createAgentOrchestrator } from "../lib/ai/agentOrchestrator";
import { createPlanner } from "../lib/ai/agentPlanner";
import { createToolRegistry } from "../lib/ai/tools/registry";
import { createContextCache } from "../lib/ai/contextPerformance";

export function useAgentWorkspace({ maxSteps = 10, contextBudget = 24000 } = {}) {
  const orchestrator = useMemo(() => {
    const planner = createPlanner({ maxSteps });
    const registry = createToolRegistry();
    return createAgentOrchestrator({ maxSteps, maxToolRounds: 4, contextBudget, timeoutMs: 30000, planner, toolRegistry: registry });
  }, [maxSteps, contextBudget]);

  const [snapshot, setSnapshot] = useState(() => orchestrator.getSnapshot());

  useEffect(() => {
    const unsub = orchestrator.subscribe(setSnapshot);
    return unsub;
  }, [orchestrator]);

  return { orchestrator, snapshot };
}
