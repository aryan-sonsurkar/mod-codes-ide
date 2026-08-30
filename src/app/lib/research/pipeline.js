"use client";
import { getSection, setSection } from "../project/modcodes";

// Research is adaptive, local-first, incremental.
export function createResearchPipeline({ providerSession } = {}) {
  async function runResearch({ modcodesData, depth = "quick", query, onProgress } = {}) {
    if (!modcodesData) throw new Error("modcodes required");
    const idea = String(modcodesData.sections?.Project || modcodesData.project?.name || query || "project");
    // Mock local research — in prod would use providerSession + web fetch (mocked for now, no cloud DB).
    const sources = [
      { url: "https://example.com/research", accessedAt: new Date().toISOString(), summary: `Existing solutions for: ${idea.slice(0,120)}` },
    ];
    const findings = depth === "deep"
      ? `Deep research for "${idea.slice(0,60)}":\n- Existing solutions: scanned peer projects\n- Competitors: 3 relevant\n- Feasibility: local AI viable\n- Risks: scope creep, auth complexity\n- Alternatives: Bonsai vs Ollama\n- Open questions: user auth flow`
      : `Quick research: ${idea.slice(0,80)} — concise findings.`;

    let next = setSection(modcodesData, "Research", findings);
    next = setSection(next, "Sources", sources.map((s,i)=>`${i+1}. ${s.url} — ${s.summary} (${s.accessedAt})`).join("\n"));
    if (typeof onProgress === "function") onProgress({ findings, sources });
    return { data: next, findings, sources };
  }

  async function researchDeeper({ modcodesData }) {
    return runResearch({ modcodesData, depth: "deep" });
  }

  return { runResearch, researchDeeper };
}
