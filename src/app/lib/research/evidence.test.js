import { describe, it, expect } from "vitest";
import { createEvidence } from "./evidence";
describe("evidence",()=>{
  it("creates traceable evidence",()=>{
    const ev = createEvidence({ finding: "PostgreSQL supports relational constraints useful for this project.", source: { url: "https://postgresql.org/docs", title: "PostgreSQL docs", accessedAt: new Date().toISOString(), status: "retrieved" }, section: "Research", sessionId: "R12" });
    expect(ev.finding).toContain("PostgreSQL");
    expect(ev.source.url).toBe("https://postgresql.org/docs");
    expect(ev.sessionId).toBe("R12");
  });
});
