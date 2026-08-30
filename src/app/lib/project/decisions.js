"use client";
import { setSection, getSection } from "./modcodes";

export function addDecision({ modcodesData, decision, reason, alternatives = [], evidence = [], status = "Accepted" }) {
  if (!decision || typeof decision !== "string") throw new Error("decision required");
  const date = new Date().toISOString().split("T")[0];
  const entry = `### ${date} — ${decision.trim()}\n- **Reason:** ${String(reason||"—").trim()}\n- **Alternatives:** ${alternatives.length? alternatives.join(", "): "—"}\n- **Evidence:** ${evidence.length? evidence.join(", "): "—"}\n- **Status:** ${status}\n`;
  const current = String(getSection(modcodesData, "Decisions") || "");
  const nextText = current ? `${current.trim()}\n\n${entry}` : entry;
  return setSection(modcodesData, "Decisions", nextText);
}

export function listDecisions(modcodesData) {
  const text = String(getSection(modcodesData, "Decisions") || "");
  return text.split(/^### /m).filter(Boolean).map(s=>s.trim());
}
