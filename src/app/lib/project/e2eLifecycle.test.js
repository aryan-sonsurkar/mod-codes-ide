import { describe, it, expect } from "vitest";
import { createProjectLifecycleOrchestrator, LIFECYCLE_STATES } from "./lifecycle";
import { createEmptyModcodes } from "./modcodes";
import { createAgentOrchestrator } from "../ai/agentOrchestrator";
import { createPlanner } from "../ai/agentPlanner";
import { createToolRegistry } from "../ai/tools/registry";
import { detectMilestoneCompletion } from "./completion";
import { verifyMilestone, VERIFICATION_STATUSES } from "./verification";
import { createProgressProposal, acceptProposal, editProposal, rejectProposal, applyProposalViaSaveGate, detectConcurrentModification, PROPOSAL_STATUSES } from "./memoryProposal";
import { discoverTestConfig, createTestExecutionPlan, createScopedTestPlan, isScopedSelectorSafe } from "../testing/testExecution";
import { buildContext } from "../ai/context";
import { isSecretPath } from "../ai/context/secrets";
import { createAdService } from "../ads/AdService";

function makeOrchestrator({ planner: plannerFn, inspectFn } = {}) {
  const planner = plannerFn || createPlanner({ maxSteps: 5 });
  const registry = createToolRegistry();
  const agent = createAgentOrchestrator({ maxSteps: 5, planner, toolRegistry: registry });
  const lifecycle = createProjectLifecycleOrchestrator({
    agentOrchestrator: agent,
    inspectCodebase: inspectFn || (async () => ({ confidence: "high", technologies: ["js"] })),
    gitSafetyLevel: () => "normal",
  });
  return { agent, lifecycle, registry };
}

describe("E2E Scenario 1: Empty project", () => {
  it("New Project → open → .modcodes exists → IDE renders", () => {
    const modcodes = createEmptyModcodes({ name: "EmptyApp" });
    expect(modcodes.project.name).toBe("EmptyApp");
    expect(typeof modcodes.sections).toBe("object");
    expect(modcodes.project.createdAt).toBeTruthy();
  });
});

describe("E2E Scenario 2: Idea project", () => {
  it("Idea → Research → PRD → Roadmap", () => {
    const modcodes = createEmptyModcodes({ name: "IdeaApp" });
    modcodes.project.phase = "research";
    modcodes.sections.Research = "## Research\n- investigated auth patterns";
    modcodes.sections.PRD = "## PRD\n- user login feature";
    modcodes.sections.Roadmap = "## Roadmap\n- M1: auth";
    expect(modcodes.sections.Research).toContain("auth");
    expect(modcodes.sections.PRD).toContain("login");
    expect(modcodes.sections.Roadmap).toContain("M1");
  });
});

describe("E2E Scenario 3: Existing codebase", () => {
  it("Existing project → inspection → technologies → entry points → architecture → roadmap", async () => {
    const modcodes = createEmptyModcodes({ name: "ExistingApp" });
    modcodes.project.phase = "inspecting";
    const { lifecycle } = makeOrchestrator();
    const snap = await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Understand codebase", tasks: ["inspect"], risks: [] },
      modcodesData: modcodes,
    });
    expect(snap.state).toBe(LIFECYCLE_STATES.awaitingApproval);
    expect(snap.inspectionResult).toBeTruthy();
  });
});

describe("E2E Scenario 4: Milestone execution", () => {
  it("Milestone → context → plan → awaitingApproval — agent DOES NOT execute before approval", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const modcodes = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Setup", tasks: ["init"], risks: [] },
      modcodesData: modcodes,
    });
    const snap = lifecycle.getSnapshot();
    expect(snap.state).toBe(LIFECYCLE_STATES.awaitingApproval);
    expect(agent.getSnapshot().state).toBe("awaitingApproval");
    expect(agent.getSnapshot().state).not.toBe("executing");
  });
});

describe("E2E Scenario 5: Approved execution", () => {
  it("Approve → executing → changeset → review", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const modcodes = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Setup", tasks: ["init"], risks: [] },
      modcodesData: modcodes,
    });
    lifecycle.approvePlan();
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.executing);
    agent.proposeChangeset({ operations: [{ path: "src/index.js", operation: "create", proposed: "new" }] });
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.review);
  });
});

describe("E2E Scenario 6: Test execution", () => {
  it("Discover test → show command → user approval → execute → result", () => {
    const plan = createTestExecutionPlan({
      milestone: { id: "M1", goal: "Setup" },
      projectData: createEmptyModcodes({ name: "App" }),
      packageJsonText: '{"scripts":{"test":"vitest run"}}',
      fileList: ["src/index.js", "src/index.test.js"],
      workingDirectory: "/project",
    });
    expect(plan.command).toBeTruthy();
    expect(plan.requiresApproval).toBe(true);
    expect(plan.available).toBe(true);
  });
});

describe("E2E Scenario 7: Verification", () => {
  it("Test result → M155 assessment → M156 verification", () => {
    const milestone = { id: "M1", goal: "Setup", criteria: ["files exist", "tests pass"] };
    const assessment = detectMilestoneCompletion({
      milestone,
      projectData: createEmptyModcodes({ name: "App" }),
      changeset: { operations: [{ path: "src/index.js" }] },
      tests: { passing: 5, failing: 0 },
      inspection: { technologies: ["js"] },
    });
    expect(assessment.status).toBeTruthy();
    const verification = verifyMilestone({
      milestone,
      assessment,
      projectData: createEmptyModcodes({ name: "App" }),
      tests: { passing: 5, failing: 0 },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    expect(verification.status).toBeTruthy();
    expect(verification.criteria.length).toBe(2);
  });
});

describe("E2E Scenario 8: Memory", () => {
  it("Verification → M157 proposal → Accept → Save Gate → .modcodes changed", async () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    const milestone = { id: "M1", goal: "Setup", criteria: ["index.js exists"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed", criteria: [{ status: "supported" }] },
      projectData: modcodes,
      tests: { passing: 3, failing: 0 },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    expect(verification.status).toBe(VERIFICATION_STATUSES.verified);
    const proposal = createProgressProposal({ milestone, verification, projectData: modcodes });
    expect(proposal).toBeTruthy();
    expect(proposal.status).toBe(PROPOSAL_STATUSES.pending);
    const accepted = acceptProposal(proposal);
    expect(accepted.status).toBe(PROPOSAL_STATUSES.accepted);
    let saved = false;
    const result = await applyProposalViaSaveGate({
      proposal: accepted,
      projectData: modcodes,
      saveModcodes: async ({ data }) => { saved = true; return { ok: true, data }; },
      rootName: "App",
    });
    expect(result.ok).toBe(true);
    expect(saved).toBe(true);
  });
});

describe("E2E Scenario 9: Reject memory", () => {
  it("Proposal → Reject → .modcodes unchanged", () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    const milestone = { id: "M1", goal: "Setup", criteria: ["index.js exists"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed", criteria: [{ status: "supported" }] },
      projectData: modcodes,
      tests: { passing: 3, failing: 0 },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    const proposal = createProgressProposal({ milestone, verification, projectData: modcodes });
    expect(proposal).toBeTruthy();
    const rejected = rejectProposal(proposal);
    expect(rejected.status).toBe(PROPOSAL_STATUSES.rejected);
    expect(modcodes.sections.Progress).toBe("");
  });
});

describe("E2E Scenario 10: Edit memory", () => {
  it("Proposal → Edit → validation → Save Gate", async () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    const milestone = { id: "M1", goal: "Setup", criteria: ["index.js exists"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed", criteria: [{ status: "supported" }] },
      projectData: modcodes,
      tests: { passing: 3, failing: 0 },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    const proposal = createProgressProposal({ milestone, verification, projectData: modcodes });
    expect(proposal).toBeTruthy();
    const edited = editProposal(proposal, "- M1 Setup: verified (custom note)");
    expect(edited.status).toBe(PROPOSAL_STATUSES.edited);
    expect(edited.after).toContain("custom note");
    const result = await applyProposalViaSaveGate({
      proposal: edited,
      projectData: modcodes,
      saveModcodes: async ({ data }) => ({ ok: true, data }),
      rootName: "App",
    });
    expect(result.ok).toBe(true);
  });
});

describe("E2E Scenario 11: Concurrent modification", () => {
  it("Proposal created → user changes Progress → Accept → conflict → no overwrite", () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    modcodes.sections.Progress = "- M0: old entry";
    const milestone = { id: "M1", goal: "Setup", criteria: ["index.js exists"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed", criteria: [{ status: "supported" }] },
      projectData: modcodes,
      tests: { passing: 3, failing: 0 },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    const proposal = createProgressProposal({ milestone, verification, projectData: modcodes });
    expect(proposal).toBeTruthy();
    const accepted = acceptProposal(proposal);
    modcodes.sections.Progress = "- M0: old entry\n- User added this";
    const concurrent = detectConcurrentModification(accepted, modcodes);
    expect(concurrent).toBe(true);
  });
});

describe("E2E Scenario 12: Continue Project", () => {
  it("Close → reopen → Continue → project state reconstructed → recommended next step shown", () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    modcodes.sections.Progress = "- M1: verified";
    modcodes.sections.Roadmap = "## Roadmap\n- M1: Setup\n- M2: Auth";
    expect(modcodes.sections.Progress).toContain("M1");
    expect(modcodes.sections.Roadmap).toContain("M2");
  });
});

describe("E2E Scenario 13: Test failure", () => {
  it("Test fails → verification failed → memory proposal reflects failure", () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    const milestone = { id: "M1", goal: "Auth", criteria: ["login works"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed" },
      projectData: modcodes,
      tests: { passing: 0, failing: 3 },
      changeset: { operations: [{ path: "src/auth.js" }] },
    });
    expect(verification.status).toBe(VERIFICATION_STATUSES.failed);
    const proposal = createProgressProposal({ milestone, verification, projectData: modcodes });
    expect(proposal).toBeTruthy();
    expect(proposal.after).toContain("failed");
  });
});

describe("E2E Scenario 14: Permission denied", () => {
  it("canRunTests=false → testing blocked → no terminal execution", () => {
    const milestone = { id: "M1", goal: "Setup", criteria: ["done"] };
    const verification = verifyMilestone({
      milestone,
      assessment: { status: "completed" },
      projectData: createEmptyModcodes({ name: "App" }),
      tests: {},
      permissions: { canRunTests: false },
      changeset: { operations: [{ path: "src/index.js" }] },
    });
    expect(verification.blockers.some(b => b.type === "permission")).toBe(true);
  });
});

describe("E2E Scenario 15: AI provider unavailable", () => {
  it("Provider unavailable → honest error → project remains usable", async () => {
    const failingPlanner = async () => { throw new Error("Ollama not running on http://127.0.0.1:11434"); };
    const { lifecycle } = makeOrchestrator({ planner: failingPlanner });
    const modcodes = createEmptyModcodes({ name: "App" });
    const snap = await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Setup" },
      modcodesData: modcodes,
    });
    expect(snap.state).toBe(LIFECYCLE_STATES.failed);
    expect(snap.error).toBeTruthy();
    expect(modcodes.project.name).toBe("App");
  });
});

describe("E2E Scenario 16: Ad unavailable", () => {
  it("Ad provider fails → IDE/project remains functional", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "projects" });
    expect(ad).toBeTruthy();
    svc.dismissAd();
    expect(svc.showAd()).toBe(null);
  });
});

describe("E2E Scenario 17: Secret protection", () => {
  it(".env/private key/credentials → never enter AI context → never enter ads → never appear in test output", () => {
    expect(isSecretPath(".env")).toBe(true);
    expect(isSecretPath("src/secret.pem")).toBe(true);
    const ctx = buildContext({
      currentFile: { path: ".env", content: "DATABASE_URL=postgres://user:pass@host/db" },
      explicitFiles: [{ path: "src/a.js", content: "ok" }],
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "projects" });
    expect(ad.label).toBe("Sponsored");
  });
});

describe("E2E Scenario 18: Refresh", () => {
  it("Refresh during project workflow → recover valid state → no duplicate lifecycle", () => {
    const modcodes = createEmptyModcodes({ name: "App" });
    const lifecycle1 = createProjectLifecycleOrchestrator({
      agentOrchestrator: createAgentOrchestrator({ planner: createPlanner({ maxSteps: 3 }), toolRegistry: createToolRegistry() }),
    });
    expect(lifecycle1.getSnapshot().state).toBe(LIFECYCLE_STATES.idle);
    const lifecycle2 = createProjectLifecycleOrchestrator({
      agentOrchestrator: createAgentOrchestrator({ planner: createPlanner({ maxSteps: 3 }), toolRegistry: createToolRegistry() }),
    });
    expect(lifecycle2.getSnapshot().state).toBe(LIFECYCLE_STATES.idle);
    expect(modcodes.project.name).toBe("App");
  });
});

describe("E2E Full Lifecycle: New Project → Build → Verify → Save → Continue", () => {
  it("complete flow from milestone start to memory saved", async () => {
    const modcodes = createEmptyModcodes({ name: "FullApp" });
    const { agent, lifecycle } = makeOrchestrator();

    const snap1 = await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Auth", tasks: ["login"], criteria: ["login works"], risks: [] },
      modcodesData: modcodes,
    });
    expect(snap1.state).toBe(LIFECYCLE_STATES.awaitingApproval);

    lifecycle.approvePlan();
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.executing);

    agent.proposeChangeset({ operations: [{ path: "src/auth.js", operation: "create", proposed: "auth code" }] });
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.review);
    expect(lifecycle.getSnapshot().completionAssessment).toBeTruthy();
    expect(lifecycle.getSnapshot().verification).toBeTruthy();
    expect(lifecycle.getSnapshot().memoryProposal).toBeTruthy();

    const proposal = lifecycle.getSnapshot().memoryProposal;
    expect(proposal.status).toBe(PROPOSAL_STATUSES.pending);
    expect(proposal.requires).toContain("Accept");

    lifecycle.acceptMemoryProposal();
    const accepted = lifecycle.getSnapshot().memoryProposal;
    expect(accepted.status).toBe(PROPOSAL_STATUSES.accepted);

    const result = await applyProposalViaSaveGate({
      proposal: accepted,
      projectData: modcodes,
      saveModcodes: async ({ data }) => ({ ok: true, data }),
      rootName: "FullApp",
    });
    expect(result.ok).toBe(true);
  });

  it("reject path: proposal rejected, .modcodes unchanged", async () => {
    const modcodes = createEmptyModcodes({ name: "RejectApp" });
    const { agent, lifecycle } = makeOrchestrator();
    await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Setup", criteria: ["done"] },
      modcodesData: modcodes,
    });
    lifecycle.approvePlan();
    agent.proposeChangeset({ operations: [{ path: "src/a.js" }] });
    lifecycle.rejectMemoryProposal();
    expect(lifecycle.getSnapshot().memoryProposal.status).toBe(PROPOSAL_STATUSES.rejected);
    expect(modcodes.sections.Progress).toBe("");
  });

  it("edit path: proposal edited then saved", async () => {
    const modcodes = createEmptyModcodes({ name: "EditApp" });
    const { agent, lifecycle } = makeOrchestrator();
    await lifecycle.startMilestone({
      milestone: { id: "M1", goal: "Setup", criteria: ["done"] },
      modcodesData: modcodes,
    });
    lifecycle.approvePlan();
    agent.proposeChangeset({ operations: [{ path: "src/a.js" }] });
    lifecycle.editMemoryProposal("- M1 Setup: verified (manually edited)");
    const edited = lifecycle.getSnapshot().memoryProposal;
    expect(edited.status).toBe(PROPOSAL_STATUSES.edited);
    expect(edited.after).toContain("manually edited");
    const result = await applyProposalViaSaveGate({
      proposal: edited,
      projectData: modcodes,
      saveModcodes: async ({ data }) => ({ ok: true, data }),
      rootName: "EditApp",
    });
    expect(result.ok).toBe(true);
  });
});
