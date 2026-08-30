import { describe, it, expect } from "vitest";
import { detectMilestoneCompletion, COMPLETION_STATUSES } from "./completion";
import { createEmptyModcodes, setSection } from "./modcodes";
import { createChangeset } from "../ai/changeset";

function milestone(overrides={}) { return { id:"M2", goal:"Authentication", tasks:["Login","Logout","Session handling","Tests"], criteria:"User can log in", status:"todo", ...overrides }; }

describe("M155 completion detection",()=>{
  it("1 zero progress → not_started",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[]}) });
    expect(res.status).toBe(COMPLETION_STATUSES.not_started);
  });
  it("2 partial tasks → in_progress",()=>{
    const cs = createChangeset({operations:[{path:"src/auth/login.ts", operation:"modify", original:"", proposed:""}]});
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: cs });
    expect(res.status).toBe(COMPLETION_STATUSES.in_progress);
  });
  it("3 all tasks with missing evidence → needs_review",()=>{
    const cs = createChangeset({operations:[{path:"src/auth/login.ts"},{path:"src/auth/logout.ts"},{path:"src/auth/session.ts"},{path:"src/auth/session.test.ts"}]});
    const res = detectMilestoneCompletion({ milestone: milestone({tasks:["Login","Logout","Session","Tests"], criteria:"Sessions expire correctly"}), changeset: cs, tests:{missing:1} });
    expect(res.status).toBe(COMPLETION_STATUSES.needs_review);
  });
  it("4 strong evidence → likely_complete",()=>{
    const cs = createChangeset({operations:[{path:"src/auth/login.ts"},{path:"src/auth/logout.ts"},{path:"src/auth/session.ts"},{path:"src/auth/session.test.ts"}]});
    const res = detectMilestoneCompletion({ milestone: milestone({criteria:"User can log in"}), changeset: cs, tests:{passing:12,failing:0} });
    expect(res.status).toBe(COMPLETION_STATUSES.likely_complete);
  });
  it("5 explicit accepted completion → complete",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone({status:"complete"}), changeset: createChangeset({operations:[{path:"a"}]}) });
    expect(res.status).toBe(COMPLETION_STATUSES.complete);
  });
  it("6 failing test → blocker",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[{path:"a"}]}), tests:{failing:1} });
    expect(res.blockers.some(b=>b.type==="test_failure")).toBe(true);
    expect(res.status).toBe(COMPLETION_STATUSES.blocked);
  });
  it("7 Git conflict → blocker",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[{path:"a"}]}), gitState:{conflict:true} });
    expect(res.blockers.some(b=>b.type==="git_conflict")).toBe(true);
    expect(res.status).toBe(COMPLETION_STATUSES.blocked);
  });
  it("8 missing criterion evidence → needs_review",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone({criteria:"Sessions expire correctly"}), changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{missing:1} });
    expect(res.criteria[0].status).toBe("missing");
    expect(res.status).toBe(COMPLETION_STATUSES.needs_review);
  });
  it("9 PRD requirement relationship",()=>{
    const base = setSection(createEmptyModcodes({name:"App"}), "PRD", "FR-03 Authentication\nFR-10 Dashboard");
    const res = detectMilestoneCompletion({ milestone: milestone({goal:"Authentication"}), projectData: base, changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}) });
    expect(res.requirements.length).toBeGreaterThan(0);
    expect(res.requirements[0].evidence.length).toBeGreaterThan(0);
  });
  it("10 ChangeSet relevance",()=>{
    const cs = createChangeset({operations:[{path:"src/auth/login.ts"}]});
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: cs });
    expect(res.evidence).toContain("src/auth/login.ts");
  });
  it("11 manual user changes recognized",()=>{
    const base = setSection(createEmptyModcodes({name:"App"}), "Progress", "Login completed\nLogout completed");
    const res = detectMilestoneCompletion({ milestone: milestone({tasks:["Login","Logout","Other"]}), projectData: base, changeset: createChangeset({operations:[]}) });
    expect(res.tasks.filter(t=>t.status==="supported").length).toBe(2);
  });
  it("12 unrelated changes do not imply completion",()=>{
    const cs = createChangeset({operations:[{path:"src/dashboard/Dashboard.tsx"}]});
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: cs });
    expect(res.status).not.toBe(COMPLETION_STATUSES.likely_complete);
  });
  it("13 no PRD handled",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), projectData: createEmptyModcodes({name:"App"}), changeset: createChangeset({operations:[{path:"a"}]}) });
    expect(res.requirements).toEqual([]);
  });
  it("14 no tests handled",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[{path:"a"}]}) });
    expect(res.blockers.filter(b=>b.type==="test_failure").length).toBe(0);
  });
  it("15 empty milestone handled",()=>{
    const res = detectMilestoneCompletion({ milestone: {id:"M0", goal:"Empty", tasks:[], criteria:""}, changeset: createChangeset({operations:[]}) });
    expect([COMPLETION_STATUSES.unknown, COMPLETION_STATUSES.not_started]).toContain(res.status);
  });
  it("16 cancelled agent handled",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[{path:"a"}]}), agentState:"cancelled" });
    expect(res.blockers.some(b=>b.type==="cancelled")).toBe(true);
    expect(res.status).toBe(COMPLETION_STATUSES.blocked);
  });
  it("17 failed agent handled",()=>{
    const res = detectMilestoneCompletion({ milestone: milestone(), changeset: createChangeset({operations:[{path:"a"}]}), agentState:"failed" });
    expect(res.blockers.some(b=>b.type==="agent_failure")).toBe(true);
  });
  it("18 assessment does not modify .modcodes",()=>{
    const base = createEmptyModcodes({name:"App"});
    const copy = JSON.stringify(base);
    detectMilestoneCompletion({ milestone: milestone(), projectData: base, changeset: createChangeset({operations:[{path:"a"}]}) });
    expect(JSON.stringify(base)).toBe(copy);
  });
  it("19 assessment does not modify roadmap",()=>{
    const m = milestone();
    const copy = JSON.stringify(m);
    detectMilestoneCompletion({ milestone: m, changeset: createChangeset({operations:[]}) });
    expect(JSON.stringify(m)).toBe(copy);
  });
  it("20 no filesystem writes",()=>{
    const fs = require("fs");
    const content = fs.readFileSync("src/app/lib/project/completion.js","utf8");
    expect(content).not.toContain("writeFile");
    expect(content).not.toContain("fs.write");
  });
  it("21 no Git writes",()=>{
    const fs = require("fs");
    const content = fs.readFileSync("src/app/lib/project/completion.js","utf8");
    expect(content.toLowerCase()).not.toContain("git commit");
    expect(content.toLowerCase()).not.toContain("git push");
    expect(content).not.toContain("auto-push");
  });
  it("22 no AdService dependency",()=>{
    const fs = require("fs");
    const content = fs.readFileSync("src/app/lib/project/completion.js","utf8");
    expect(content.toLowerCase()).not.toContain("adservice");
  });
  it("23 lifecycle exposes assessment", async ()=>{
    const { createProjectLifecycleOrchestrator } = await import("./lifecycle.js");
    const { createAgentOrchestrator } = await import("../ai/agentOrchestrator.js");
    const { createPlanner } = await import("../ai/agentPlanner.js");
    const { createToolRegistry } = await import("../ai/tools/registry.js");
    const agent = createAgentOrchestrator({ planner: createPlanner({maxSteps:3}), toolRegistry: createToolRegistry() });
    const lc = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    const base = createEmptyModcodes({name:"App"});
    await lc.startMilestone({ milestone: milestone(), modcodesData: base });
    lc.approvePlan();
    agent.proposeChangeset({ changes:[{path:"src/auth/login.ts"}] });
    expect(lc.getSnapshot().completionAssessment).toBeTruthy();
    expect(lc.getSnapshot().state).toBe("review");
  });
  it("24 deterministic result for same input",()=>{
    const args = { milestone: milestone(), changeset: createChangeset({operations:[{path:"src/auth/login.ts"}]}), tests:{passing:5} };
    const a = detectMilestoneCompletion(args);
    const b = detectMilestoneCompletion(args);
    expect(a.status).toBe(b.status);
    expect(a.confidence).toBe(b.confidence);
  });
});
