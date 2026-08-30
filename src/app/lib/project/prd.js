"use client";
import { setSection } from "./modcodes";

export function buildPRDFromResearch({ modcodesData, evidence } = {}) {
  const research = String(modcodesData.sections?.Research || "");
  const problem = String(modcodesData.sections?.Problem || "Define the problem from research");
  const sources = String(modcodesData.sections?.Sources || "");
  const evidenceBlock = Array.isArray(evidence) && evidence.length
    ? evidence.map((ev)=>`- ${ev.finding} [${ev.source?.url || "local"} · ${ev.sessionId || "R-?"}]`).join("\n")
    : "";
  const researchHistory = String(modcodesData.sections?.["Research History"] || "");
  // Extract last session id for traceability
  const lastSession = researchHistory.split("\n").filter(Boolean).pop() || "R-?";
  const prd = `# PRD — ${modcodesData.project?.name || "Project"}

## Problem
${problem}

## Target Users
${String(modcodesData.sections?.Users || "Students, hackers")}

## User Pain / Jobs to be Done
From research (${lastSession}): ${research.slice(0,300) || "—"}
${evidenceBlock ? `\nEvidence:\n${evidenceBlock}` : ""}

## Goals
- Ship MVP

## Non-Goals
- Out of scope: enterprise SSO

## Features
- Core workflow (traceable to Research ${lastSession})

## User Stories
- As a student I can … (see Sources: ${sources.split("\n").slice(0,2).join("; ").slice(0,120) || "—"})

## Functional Requirements
- FR-1 … [evidence: ${evidenceBlock ? "linked" : "pending research"}]

## Non-Functional Requirements
- Local-first, 60fps

## UX Requirements
- Keyboard-friendly, accessible

## Technical Constraints
- File System Access API, local AI only

## Risks
${String(modcodesData.sections?.["Open Questions"] || "—").slice(0,200)}

## Success Metrics
- Tasks completed

## Open Questions
- … (requires decision)

## Milestones
M1 Setup → M2 Auth → M3 Core → M4 Testing → M5 Release

---
*Generated from Research ${lastSession} — editable. AI proposals are not authority; user remains authority.*
`;
  return setSection(modcodesData, "PRD", prd);
}
