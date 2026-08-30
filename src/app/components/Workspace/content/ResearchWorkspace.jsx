"use client";
import { useState } from "react";
import { createResearchPipeline } from "../../../lib/research/pipeline";
import { createAdService } from "../../../lib/ads/AdService";
import "./ResearchWorkspace.css";

const SECTIONS = ["Research Overview","Problem","Users","Existing Solutions","Competitors","Market/Context","Technical Feasibility","Technology Options","Risks","Open Questions","Sources","Research History"];

export default function ResearchWorkspace({ modcodesData, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [urlsText, setUrlsText] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [lastSources, setLastSources] = useState([]);
  const pipeline = createResearchPipeline();
  const adService = createAdService();
  const ad = adService.requestAd({ placement: "research" });

  function parseUrls() {
    return String(urlsText || "").split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
  }

  async function handleQuick() {
    setBusy(true); setError(null);
    try {
      const urls = parseUrls();
      const { data, sources } = await pipeline.runResearch({ modcodesData, depth: "quick", query: query || undefined, urls });
      setLastSources(sources || []);
      onUpdate && onUpdate(data);
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally { setBusy(false); }
  }
  async function handleDeep() {
    setBusy(true); setError(null);
    try {
      const urls = parseUrls();
      const { data, sources } = await pipeline.researchDeeper({ modcodesData, query: query || undefined, urls });
      setLastSources(sources || []);
      onUpdate && onUpdate(data);
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!modcodesData) return <div className="research-ws">Load .modcodes to research.</div>;
  return (
    <div className="research-ws">
      <h2>Research Workspace</h2>
      <p className="muted">UI renders from .modcodes — source of truth is the file. Provide URLs for verified evidence.</p>
      <div className="research-inputs">
        <input className="research-query" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Research question (defaults to Project name)" />
        <textarea className="research-urls" value={urlsText} onChange={(e)=>setUrlsText(e.target.value)} placeholder="Source URLs (one per line, optional) — e.g. https://docs.example.com" rows={3} />
      </div>
      <div className="research-actions">
        <button onClick={handleQuick} disabled={busy}>Quick Research</button>
        <button onClick={handleDeep} disabled={busy}>Research this deeper</button>
        {busy && <span>Running — fetching via browser (CORS/timeout handled)…</span>}
      </div>
      {error && <div className="research-error">Error: {error}</div>}
      {lastSources.length > 0 && (
        <div className="research-sources">
          <strong>Last session sources ({lastSources.length})</strong>
          <ul>
            {lastSources.map((s,i)=>(
              <li key={i} className={`source-${s.status}`}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a> : <span>{s.title}</span>}
                {" — "}{s.status} {s.error ? `(${s.error})` : ""}
                {s.summary ? <div className="source-summary">{String(s.summary).slice(0,160)}</div> : null}
              </li>
            ))}
          </ul>
          <p className="muted small">Retrieved sources are verified; inaccessible shown as evidence not verified. Duplicate URLs deduped.</p>
        </div>
      )}
      <div className="research-grid">
        {SECTIONS.map((s)=><div key={s} className="research-card"><strong>{s}</strong><pre>{String(modcodesData.sections?.[s] || modcodesData.sections?.Research || "").slice(0,300) || "—"}</pre></div>)}
      </div>
      {ad && <div className="ad sponsored"><span className="ad-label">{ad.label}</span> {ad.title} <a href={ad.href}>{ad.cta}</a></div>}
      <p className="muted small">Advanced: open .modcodes directly. “Research this deeper” continues from existing state.</p>
    </div>
  );
}
