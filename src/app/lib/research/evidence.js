"use client";

// Evidence model: each finding traceable to source + section + research session.
// No hidden chain-of-thought — concise conclusions only.
export function createEvidence({ finding, source, section = "Research", sessionId }) {
  if (!finding || typeof finding !== "string") throw new Error("finding required");
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    finding: finding.trim().slice(0, 800),
    source: source ? { url: source.url || null, title: source.title || null, accessedAt: source.accessedAt || null, status: source.status || null } : null,
    section,
    sessionId: sessionId || null,
    createdAt: new Date().toISOString(),
  };
}

export function evidenceToMarkdown(ev) {
  return `- ${ev.finding} — *Source: ${ev.source?.title || ev.source?.url || "local"}* · Session ${ev.sessionId || "—"} · ${ev.section}`;
}
