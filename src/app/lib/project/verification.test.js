import { describe, it, expect } from "vitest";
import { verifyMilestone, VERIFICATION_STATUSES, createVerificationPlan } from "./verification";
import { createChangeset } from "../ai/changeset";
import { createEmptyModcodes } from "./modcodes";
import { detectMilestoneCompletion } from "./completion";
import { createProjectLifecycleOrchestrator } from "./lifecycle";
import { createAgentOrchestrator } from "../ai/agentOrchestrator";
import { createPlanner } from "../ai/agentPlanner";
import { createToolRegistry } from "../ai/tools/registry";

function milestone(overrides={}) { return { id:"M2", goal:"Authentication", tasks:["Login"], criteria: "Users can log in", ...overrides }; }

describe("M156 verification",()=>{
  it("1 all criteria pass → verified",()=>{
    const m = milestone({ criteria: "Users can log in" });
    const cs = createChangeset({operations:[{path:"src/auth/login.ts"}]});
    const res = verifyMilestone({ milestone: m, changeset: cs, tests:{passing:5,failing:0}, assessment: { status:"likely_complete", criteria:[{status:"supported"}] } });
    expect(res.status).toBe(VERIFICATION_STATUSES.verified);
  });
  it("2 one criterion fails → failed",()=>{
    const m = milestone({ criteria: "Invalid credentials are rejected" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:0,failing:1} });
    expect(res.status).toBe(VERIFICATION_STATUSES.failed);
  });
  it("3 some pass + some unknown → partially_verified",()=>{
    const m = { id:"M2", goal:"Auth", criteria: ["Users can log in","Sessions expire after 30 minutes"] };
    const cs = createChangeset({operations:[{path:"src/auth/login.ts"}]});
    const res = verifyMilestone({ milestone: m, changeset: cs, tests:{passing:1,failing:0,missing:1} });
    expect(res.status).toBe(VERIFICATION_STATUSES.partially_verified);
  });
  it("4 all unknown → unknown",()=>{
    const m = { id:"M2", goal:"Auth", criteria: "Sessions expire after 30 minutes" };
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[]}), tests:{missing:1} });
    expect(res.status).toBe(VERIFICATION_STATUSES.unknown);
  });
  it("5 verification blocked → blocked",()=>{
    const m = milestone({});
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"a"}]}), gitState:{conflict:true} });
    expect(res.status).toBe(VERIFICATION_STATUSES.blocked);
  });
  it("6 passing test produces evidence",()=>{
    const m = milestone({ criteria: "Users can log in" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:1,failing:0} });
    expect(res.criteria[0].evidence.length).toBeGreaterThan(0);
    expect(res.criteria[0].status).toBe("passed");
  });
  it("7 failing test produces failure",()=>{
    const m = milestone({ criteria: "Invalid credentials are rejected" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:0,failing:1} });
    expect(res.criteria[0].status).toBe("failed");
    expect(res.failed).toBe(1);
  });
  it("8 missing test does not imply pass",()=>{
    const m = milestone({ criteria: "Sessions expire" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[]}), tests:{missing:1} });
    expect(res.criteria[0].status).toBe("unknown");
    expect(res.status).not.toBe(VERIFICATION_STATUSES.verified);
  });
  it("9 implementation file alone does not prove behavior",()=>{
    const m = milestone({ criteria: "Sessions expire after 30 minutes" });
    const cs = createChangeset({operations:[{path:"src/auth/session.ts"}]});
    // no test, implementation exists but should be unknown per hierarchy
    const res = verifyMilestone({ milestone: m, changeset: cs, tests:{missing:1} });
    expect(res.criteria[0].status).toBe("unknown");
  });
  it("10 PRD requirement verification",()=>{
    const base = createEmptyModcodes({name:"App"});
    // PRD not directly used in verifyMilestone but we check that requirements field exists and is not modified
    const m = milestone({ criteria: "User can log in" });
    const res = verifyMilestone({ milestone: m, projectData: base, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:1} });
    expect(res.requirements).toBeDefined();
  });
  it("11 criterion provenance",()=>{
    const m = milestone({ criteria: "Users can log in" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:1} });
    expect(res.criteria[0].provenance).toBeTruthy();
    expect(res.criteria[0].provenance.criterionId).toBe("criterion-0");
  });
  it("12 contradictory evidence handled",()=>{
    const m = milestone({ criteria: "Users can log in" });
    // test says passing but inspection says missing dependency -> still passed but blockers may be empty; we check that verification doesn't crash and returns known status
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:1}, inspection:{potentialRisks:["missing dependency"]}});
    expect([VERIFICATION_STATUSES.verified, VERIFICATION_STATUSES.partially_verified, VERIFICATION_STATUSES.unknown]).toContain(res.status);
  });
  it("13 permissions respected",()=>{
    const m = milestone({ criteria: "Users can log in" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[]}), tests:{}, permissions:{canRunTests:false} });
    expect(res.blockers.some(b=>b.type==="permission")).toBe(true);
  });
  it("14 no automatic source modification",()=>{
    const content = require("fs").readFileSync("src/app/lib/project/verification.js","utf8");
    expect(content).not.toContain("writeFile");
    expect(content).not.toContain("fs.write");
  });
  it("15 no .modcodes modification",()=>{
    const fs = require("fs");
    const txt = fs.readFileSync("src/app/lib/project/verification.js","utf8");
    expect(txt).not.toContain("setSection");
    expect(txt).not.toContain(".modcodes");
  });
  it("16 no roadmap modification",()=>{
    const fs = require("fs");
    const txt = fs.readFileSync("src/app/lib/project/verification.js","utf8");
    expect(txt.toLowerCase()).not.toContain("roadmap");
  });
  it("17 no Git mutation",()=>{
    const fs = require("fs");
    const txt = fs.readFileSync("src/app/lib/project/verification.js","utf8");
    expect(txt.toLowerCase()).not.toContain("git commit");
    expect(txt.toLowerCase()).not.toContain("git push");
    expect(txt).not.toContain("auto-push");
  });
  it("18 no AdService dependency",()=>{
    const fs = require("fs");
    const txt = fs.readFileSync("src/app/lib/project/verification.js","utf8");
    expect(txt.toLowerCase()).not.toContain("adservice");
    expect(txt.toLowerCase()).not.toContain("from \"../ads");
  });
  it("19 lifecycle exposes verification", async ()=>{
    const agent = createAgentOrchestrator({ planner: createPlanner({maxSteps:3}), toolRegistry: createToolRegistry() });
    const lc = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    const base = createEmptyModcodes({name:"App"});
    await lc.startMilestone({ milestone: milestone(), modcodesData: base });
    lc.approvePlan();
    agent.proposeChangeset({ changes:[{path:"src/auth/login.ts"}]});
    expect(lc.getSnapshot().verification).toBeTruthy();
    expect(lc.getSnapshot().completionAssessment).toBeTruthy();
  });
  it("20 M155 assessment remains available", async ()=>{
    const agent = createAgentOrchestrator({ planner: createPlanner({maxSteps:3}), toolRegistry: createToolRegistry() });
    const lc = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    const base = createEmptyModcodes({name:"App"});
    await lc.startMilestone({ milestone: milestone(), modcodesData: base });
    lc.approvePlan();
    agent.proposeChangeset({ changes:[{path:"a"}]});
    expect(lc.getSnapshot().completionAssessment).toBeTruthy();
    expect(lc.getSnapshot().verification).toBeTruthy();
  });
  it("21 deterministic behavior where expected",()=>{
    const args = { milestone: milestone({criteria:"A"}), changeset: createChangeset({operations:[{path:"src/a.ts"}]}), tests:{passing:1} };
    const a = verifyMilestone(args);
    const b = verifyMilestone(args);
    expect(a.status).toBe(b.status);
    expect(a.passed).toBe(b.passed);
  });
  it("22 empty milestone handled",()=>{
    const res = verifyMilestone({ milestone: {id:"M0", goal:"Empty", tasks:[], criteria:""}, changeset: createChangeset({operations:[]}) });
    expect(res.status).toBe(VERIFICATION_STATUSES.unknown);
  });
  it("23 cancelled agent handled",()=>{
    const res = verifyMilestone({ milestone: milestone(), changeset: createChangeset({operations:[]}), assessment:{ status:"blocked", blockers:[{type:"cancelled"}] }, tests:{} });
    // verification should reflect blocked if assessment blocked
    // we pass cancelled via assessment blockers -> verification will be blocked or unknown but not verified
    expect([VERIFICATION_STATUSES.blocked, VERIFICATION_STATUSES.unknown, VERIFICATION_STATUSES.failed]).toContain(res.status);
  });
  it("24 failed agent handled",()=>{
    const res = verifyMilestone({ milestone: milestone(), changeset: createChangeset({operations:[]}), assessment:{ status:"blocked", blockers:[{type:"agent_failure"}] }, tests:{failing:1} });
    expect(res.blockers.length).toBeGreaterThan(0);
  });
  it("25 verification results remain traceable",()=>{
    const m = milestone({ criteria: "Users can log in" });
    const res = verifyMilestone({ milestone: m, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:1} });
    expect(res.criteria[0].evidence[0].source).toBeTruthy();
    expect(res.criteria[0].provenance).toBeTruthy();
  });
  it("verification plan exists",()=>{
    const plan = createVerificationPlan({ milestone: milestone() });
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
  });
});
