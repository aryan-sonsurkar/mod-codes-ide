"use client";
import { useState } from "react";
import { buildRoadmap } from "../../../lib/project/roadmap";
import "./RoadmapWorkspace.css";

export default function RoadmapWorkspace({ modcodesData, onUpdate }) {
  const [view, setView] = useState(() => String(modcodesData?.sections?.Roadmap || ""));
  function handleGenerate() {
    const { data, milestones } = buildRoadmap({ modcodesData });
    setView(String(data.sections?.Roadmap || ""));
    onUpdate && onUpdate(data);
  }
  return (
    <div className="roadmap-ws">
      <h2>Roadmap</h2>
      <p className="muted">Milestones derive from PRD. Agent can work through approved milestones.</p>
      <button onClick={handleGenerate}>Generate Roadmap from PRD</button>
      <pre className="roadmap-pre">{view || "— no roadmap yet. Generate."}</pre>
    </div>
  );
}
