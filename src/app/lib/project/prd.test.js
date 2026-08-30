import { describe, it, expect } from "vitest";
import { createEmptyModcodes } from "./modcodes";
import { buildPRDFromResearch } from "./prd";
import { createEvidence } from "../research/evidence";
describe("prd evidence traceability",()=>{
  it("references evidence and session",()=>{
    const base = createEmptyModcodes({ name: "App" });
    const ev = createEvidence({ finding: "PG supports constraints", source: { url: "https://postgresql.org", title:"PG docs", accessedAt: new Date().toISOString(), status:"retrieved"}, sessionId:"R12"});
    const next = buildPRDFromResearch({ modcodesData: base, evidence: [ev] });
    expect(next.sections.PRD).toContain("PG supports constraints");
    expect(next.sections.PRD).toContain("R12");
    expect(next.sections.PRD).toContain("editable");
  });
  it("without evidence still builds",()=>{
    const base = createEmptyModcodes({ name:"App2"});
    const next = buildPRDFromResearch({ modcodesData: base });
    expect(next.sections.PRD).toContain("PRD — App2");
  });
});
