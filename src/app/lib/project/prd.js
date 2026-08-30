"use client";
import { setSection } from "./modcodes";

export function buildPRDFromResearch({ modcodesData }) {
  const research = String(modcodesData.sections?.Research || "");
  const problem = String(modcodesData.sections?.Problem || "Define the problem from research");
  const prd = `# PRD — ${modcodesData.project?.name || "Project"}

## Problem
${problem}

## Target Users
${String(modcodesData.sections?.Users || "Students, hackers")}

## User Pain / Jobs to be Done
From research: ${research.slice(0,300) || "—"}

## Goals
- Ship MVP

## Non-Goals
- Out of scope: enterprise SSO

## Features
- Core workflow

## User Stories
- As a student I can …

## Functional Requirements
- FR-1 …

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
- …

## Milestones
M1 Setup → M2 Auth → M3 Core → M4 Testing → M5 Release
`;
  return setSection(modcodesData, "PRD", prd);
}
