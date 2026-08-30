"use client";
import { useState } from "react";
import { buildPRDFromResearch } from "../../../lib/project/prd";
import "./PRDWorkspace.css";

export default function PRDWorkspace({ modcodesData, onUpdate }) {
  const [text, setText] = useState(() => String(modcodesData?.sections?.PRD || ""));
  if (!modcodesData) return <div className="prd-ws">Load .modcodes.</div>;
  function handleGenerate() {
    const next = buildPRDFromResearch({ modcodesData });
    setText(String(next.sections?.PRD || ""));
    onUpdate && onUpdate(next);
  }
  function handleSave() {
    const next = { ...modcodesData, sections: { ...modcodesData.sections, PRD: text }, project: { ...modcodesData.project, updatedAt: new Date().toISOString() } };
    onUpdate && onUpdate(next);
  }
  return (
    <div className="prd-ws">
      <h2>PRD Workspace</h2>
      <p className="muted">AI proposes, you edit. PRD remains editable.</p>
      <div className="prd-actions">
        <button onClick={handleGenerate}>Generate PRD from Research</button>
        <button className="primary" onClick={handleSave}>Save PRD to .modcodes</button>
      </div>
      <textarea className="prd-editor" value={text} onChange={(e)=>setText(e.target.value)} placeholder="PRD content (Markdown) — editable" rows={18} />
    </div>
  );
}
