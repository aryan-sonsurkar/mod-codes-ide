import { describe, it, expect } from "vitest";
import { createEmptyModcodes } from "./modcodes";
import { addDecision, listDecisions } from "./decisions";
describe("decisions",()=>{
  it("adds structured decision with evidence",()=>{
    const base = createEmptyModcodes({ name:"App"});
    const next = addDecision({ modcodesData: base, decision:"PostgreSQL", reason:"Relational model fits", alternatives:["MongoDB","SQLite"], evidence:["Research R12","R18"], status:"Accepted"});
    expect(next.sections.Decisions).toContain("PostgreSQL");
    expect(next.sections.Decisions).toContain("MongoDB");
    expect(next.sections.Decisions).toContain("R12");
    expect(listDecisions(next).length).toBe(1);
  });
});
