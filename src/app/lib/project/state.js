"use client";
import { PROJECT_PHASES } from "./modcodes";

export const PHASE_LABELS = {
  idea: "Idea",
  research: "Research",
  prd: "PRD",
  planning: "Planning",
  development: "Development",
  testing: "Testing",
  release: "Release",
  maintenance: "Maintenance",
};

export const PHASE_ORDER = ["idea", "research", "prd", "planning", "development", "testing", "release", "maintenance"];

export function isValidPhase(phase) {
  return PROJECT_PHASES.includes(String(phase || "").toLowerCase());
}

export function suggestNextPhase(current) {
  const normalized = String(current || "idea").toLowerCase();
  const idx = PHASE_ORDER.indexOf(normalized);
  if (idx === -1) return "idea";
  if (idx >= PHASE_ORDER.length - 1) return "maintenance";
  return PHASE_ORDER[idx + 1];
}

export function canTransition(from, to) {
  // Any transition is allowed (not strict state machine), but we validate both are known.
  return isValidPhase(from) && isValidPhase(to);
}

export function phaseProgress(phase) {
  const idx = PHASE_ORDER.indexOf(String(phase || "idea").toLowerCase());
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

export function projectHealth({ modcodesData, fileCount, lastModified }) {
  // naive health: if .modcodes stale > 7 days vs codebase mtime, warn.
  const updatedAt = modcodesData?.project?.updatedAt ? Date.parse(modcodesData.project.updatedAt) : NaN;
  const ageDays = !Number.isNaN(updatedAt) ? (Date.now() - updatedAt) / (24 * 3600 * 1000) : 999;
  const stale = ageDays > 7;
  return {
    stale,
    ageDays: Math.floor(ageDays),
    architectureMatches: true, // until graph reconcile says otherwise
    fileCount: typeof fileCount === "number" ? fileCount : null,
  };
}
