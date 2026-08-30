"use client";
import { useState } from "react";
import { createResearchPipeline } from "../../../lib/research/pipeline";
import { createAdService } from "../../../lib/ads/AdService";
import "./ResearchWorkspace.css";

const SECTIONS = ["Research Overview","Problem","Users","Existing Solutions","Competitors","Market/Context","Technical Feasibility","Technology Options","Risks","Open Questions","Sources","Research History"];

export default function ResearchWorkspace({ modcodesData, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const pipeline = createResearchPipeline();
  const adService = createAdService();
  const ad = adService.requestAd({ placement: "research" });

  async function handleQuick() {
    setBusy(true);
    try {
      const { data } = await pipeline.runResearch({ modcodesData, depth: "quick" });
      onUpdate && onUpdate(data);
    } finally { setBusy(false); }
  }
  async function handleDeep() {
    setBusy(true);
    try {
      const { data } = await pipeline.researchDeeper({ modcodesData });
      onUpdate && onUpdate(data);
    } finally { setBusy(false); }
  }

  if (!modcodesData) return <div className="research-ws">Load .modcodes to research.</div>;
  return (
    <div className="research-ws">
      <h2>Research Workspace</h2>
      <p className="muted">UI renders from .modcodes — source of truth is the file.</p>
      <div className="research-actions">
        <button onClick={handleQuick} disabled={busy}>Quick Research</button>
        <button onClick={handleDeep} disabled={busy}>Research this deeper</button>
        {busy && <span>Running…</span>}
      </div>
      <div className="research-grid">
        {SECTIONS.map((s)=><div key={s} className="research-card"><strong>{s}</strong><pre>{String(modcodesData.sections?.[s] || modcodesData.sections?.Research || "").slice(0,300) || "—"}</pre></div>)}
      </div>
      {ad && <div className="ad sponsored"><span className="ad-label">{ad.label}</span> {ad.title} <a href={ad.href}>{ad.cta}</a></div>}
      <p className="muted small">Advanced: open .modcodes directly.</p>
    </div>
  );
}
