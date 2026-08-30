"use client";
import { setSection } from "./modcodes";

export function buildRoadmap({ modcodesData, milestones } = {}) {
  const defaults = [
    { id: "M1", goal: "Project setup", tasks: ["Init repo", "Setup .modcodes"], deps: [], status: "todo", risks: [], criteria: "Repo builds" },
    { id: "M2", goal: "Authentication", tasks: ["Session middleware", "Login"], deps: ["M1"], status: "todo", risks: ["auth complexity"], criteria: "Login flow tested" },
    { id: "M3", goal: "Core workflow", tasks: ["Main feature"], deps: ["M2"], status: "todo", risks: [], criteria: "E2E happy path" },
    { id: "M4", goal: "Testing", tasks: ["Unit + integration"], deps: ["M3"], status: "todo", risks: [], criteria: "80% coverage" },
    { id: "M5", goal: "Release", tasks: ["Docs, deploy"], deps: ["M4"], status: "todo", risks: [], criteria: "Deployed" },
  ];
  const list = Array.isArray(milestones) && milestones.length ? milestones : defaults;
  const text = list.map(m=>`## ${m.id}: ${m.goal}\n- Tasks: ${m.tasks.join(", ")}\n- Deps: ${m.deps.join(", ") || "none"}\n- Status: ${m.status}\n- Risks: ${m.risks.join(", ") || "none"}\n- Criteria: ${m.criteria}`).join("\n\n");
  let next = setSection(modcodesData, "Roadmap", text);
  next = setSection(next, "Milestones", text);
  return { data: next, milestones: list };
}
