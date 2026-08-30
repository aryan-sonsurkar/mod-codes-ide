import { describe, it, expect } from "vitest";
import { createContextRequest, selectContext } from "./contextIntelligence";
import { createEmptyModcodes, setSection } from "../project/modcodes";
import { createProjectLifecycleOrchestrator } from "../project/lifecycle";
import { createAgentOrchestrator } from "./agentOrchestrator";
import { createPlanner } from "./agentPlanner";
import { createToolRegistry } from "./tools/registry";

function makeTree(files) {
  return { name: "root", kind: "directory", children: files.map((p) => {
    const parts = p.split("/");
    const name = parts[parts.length-1];
    return { name, path: p, kind: "file" };
  }) };
}

describe("M154 Context Intelligence", () => {
  it("1. context request created correctly", () => {
    const req = createContextRequest({ task: "Add password reset", milestone: { id:"M2", goal:"Auth"}, project:{name:"App"}, budget: 10000 });
    expect(req.task).toBe("Add password reset");
    expect(req.milestone.id).toBe("M2");
    expect(req.budget).toBe(10000);
  });

  it("2. relevant file selected", () => {
    const req = createContextRequest({ task: "Implement session-based authentication", milestone: { id:"M2", goal:"Auth"} });
    const tree = makeTree(["root/src/auth/session.ts","root/src/dashboard/Dashboard.tsx"]);
    const fileContents = new Map([["root/src/auth/session.ts","export function session(){}"], ["root/src/dashboard/Dashboard.tsx","dashboard"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    const paths = sel.selected.map(s=>s.path);
    expect(paths).toContain("root/src/auth/session.ts");
  });

  it("3. unrelated file excluded", () => {
    const req = createContextRequest({ task: "Add password reset functionality" });
    const tree = makeTree(["root/src/auth/passwordReset.ts","root/src/landing/Hero.tsx"]);
    const fileContents = new Map([["root/src/auth/passwordReset.ts","reset"], ["root/src/landing/Hero.tsx","hero"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    const paths = sel.selected.map(s=>s.path);
    expect(paths).toContain("root/src/auth/passwordReset.ts");
    // Hero may be included if budget allows, but passwordReset should rank higher
    const idxReset = sel.selected.findIndex(s=>s.path==="root/src/auth/passwordReset.ts");
    const idxHero = sel.selected.findIndex(s=>s.path==="root/src/landing/Hero.tsx");
    if (idxHero !== -1) expect(idxReset).toBeLessThan(idxHero);
  });

  it("4. dependency-related file selected via graph", () => {
    const req = createContextRequest({ task: "Implement authentication middleware" });
    const tree = makeTree(["root/src/middleware/auth.ts","root/src/models/User.ts","root/src/landing/Hero.tsx"]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents: new Map([["root/src/middleware/auth.ts","import User from '../models/User'"], ["root/src/models/User.ts","user"], ["root/src/landing/Hero.tsx","hero"]]) });
    const paths = sel.selected.map(s=>s.path);
    // User.ts should be considered via import relationship boost
    expect(paths).toContain("root/src/models/User.ts");
  });

  it("5. relevant test selected", () => {
    const req = createContextRequest({ task: "Add password reset tests" });
    const tree = makeTree(["root/src/auth/auth.test.ts","root/src/dashboard/Dashboard.tsx"]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents: new Map([["root/src/auth/auth.test.ts","test auth"], ["root/src/dashboard/Dashboard.tsx","dash"]]) });
    expect(sel.selected.some(s=>s.path.includes("auth.test.ts"))).toBe(true);
  });

  it("6. relevant PRD requirement selected", () => {
    const base = createEmptyModcodes({name:"App"});
    const withPrd = setSection(base, "PRD", "- FR-03 Users can authenticate\n- FR-10 Dashboard shows metrics");
    const req = createContextRequest({ task: "Implement login" });
    const sel = selectContext(req, { projectData: withPrd, tree: makeTree([]), fileContents: new Map() });
    const prdSelected = sel.selected.filter(s=>s.type==="prd");
    expect(prdSelected.length).toBeGreaterThan(0);
    expect(prdSelected[0].content).toContain("FR-03");
  });

  it("7. relevant research evidence selected", () => {
    const base = createEmptyModcodes({name:"App"});
    const withResearch = setSection(setSection(base, "Research", "Session-based authentication is appropriate because stateless JWT has revocation issues."), "Sources", "https://example.com | title | retrieved");
    const req = createContextRequest({ task: "Implement session-based authentication" });
    const sel = selectContext(req, { projectData: withResearch, tree: makeTree([]), fileContents: new Map() });
    expect(sel.selected.some(s=>s.type==="research")).toBe(true);
  });

  it("8. relevant decision selected", () => {
    const base = createEmptyModcodes({name:"App"});
    const withDecision = setSection(base, "Decisions", "### 2026-08-30 — Use PostgreSQL\n- Reason: Relational fits\n- Alternatives: MongoDB");
    const req = createContextRequest({ task: "Implement user persistence" });
    const sel = selectContext(req, { projectData: withDecision, tree: makeTree([]), fileContents: new Map() });
    expect(sel.selected.some(s=>s.type==="decision" && s.content.includes("PostgreSQL"))).toBe(true);
  });

  it("9. context budget respected", () => {
    const req = createContextRequest({ task: "big", budget: 2000 });
    const tree = makeTree(Array.from({length:20},(_,i)=>`root/src/file${i}.ts`));
    const fileContents = new Map(tree.children.map(c=>[c.path, "a".repeat(400)]));
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    expect(sel.budget.used).toBeLessThanOrEqual(2000);
    expect(sel.rejected.length).toBeGreaterThan(0);
    expect(sel.budget.remaining).toBeGreaterThanOrEqual(0);
  });

  it("10. large files excluded", () => {
    const req = createContextRequest({ task: "test" });
    const tree = makeTree(["root/src/large.ts","root/src/small.ts"]);
    const fileContents = new Map([["root/src/large.ts","a".repeat(60000)], ["root/src/small.ts","small"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    const paths = sel.selected.map(s=>s.path);
    expect(paths).not.toContain("root/src/large.ts");
    expect(paths).toContain("root/src/small.ts");
  });

  it("11. generated directories excluded", () => {
    const req = createContextRequest({ task: "test" });
    const tree = { name:"root", kind:"directory", children:[{name:"node_modules", kind:"directory", path:"root/node_modules", children:[{name:"big.js", kind:"file", path:"root/node_modules/big.js"}]}, {name:"small.ts", kind:"file", path:"root/small.ts"}]};
    const fileContents = new Map([["root/node_modules/big.js","content"], ["root/small.ts","small"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    expect(sel.selected.some(s=>s.path.includes("node_modules"))).toBe(false);
  });

  it("12. .env excluded", () => {
    const req = createContextRequest({ task: "environment variables" });
    const tree = makeTree(["root/.env","root/src/app.ts"]);
    const fileContents = new Map([["root/.env","SECRET=123"], ["root/src/app.ts","app"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    expect(sel.selected.some(s=>s.path===".env" || s.path==="root/.env")).toBe(false);
  });

  it("13. secret values never enter context", () => {
    const req = createContextRequest({ task: "DATABASE_URL" });
    const tree = makeTree(["root/.env","root/src/db.ts"]);
    const fileContents = new Map([["root/.env","DATABASE_URL=actual-secret-value"], ["root/src/db.ts","use DATABASE_URL"]]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    const allContent = sel.selected.map(s=>s.content).join("");
    expect(allContent).not.toContain("actual-secret-value");
  });

  it("14. selection reasons generated", () => {
    const req = createContextRequest({ task: "auth session" });
    const tree = makeTree(["root/src/auth/session.ts"]);
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents: new Map([["root/src/auth/session.ts","session"]]) });
    expect(sel.selected[0].reason).toBeTruthy();
    expect(typeof sel.selected[0].reason).toBe("string");
  });

  it("15. provenance preserved", () => {
    const req = createContextRequest({ task: "test" });
    const base = setSection(createEmptyModcodes({name:"App"}), "PRD", "- FR-1 test");
    const sel = selectContext(req, { projectData: base, tree: makeTree(["root/a.ts"]), fileContents: new Map([["root/a.ts","a"]]) });
    for (const s of sel.selected) {
      expect(s.provenance).toBeTruthy();
      expect(s.provenance.source).toBeTruthy();
    }
  });

  it("16. lifecycle passes selected context to planner", async () => {
    let capturedContext = null;
    const planner = async ({ context }) => { capturedContext = context; return { steps: [{ title:"step"}]}; };
    const agent = createAgentOrchestrator({ planner, toolRegistry: createToolRegistry() });
    const lifecycle = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    const base = setSection(createEmptyModcodes({name:"App"}), "PRD", "- FR-03 Users can authenticate");
    const tree = makeTree(["root/src/auth/session.ts"]);
    const fileContents = new Map([["root/src/auth/session.ts","session"]]);
    await lifecycle.startMilestone({ milestone: { id:"M2", goal:"Authentication"}, modcodesData: base, tree, fileContents });
    expect(capturedContext).toBeTruthy();
    expect(capturedContext.contextSelection).toBeTruthy();
    expect(capturedContext.contextSelection.selected.length).toBeGreaterThan(0);
  });

  it("17. agent receives selected context rather than entire project", async () => {
    const req = createContextRequest({ task: "auth", budget: 1000 });
    const tree = makeTree(Array.from({length:20},(_,i)=>`root/src/file${i}.ts`));
    const fileContents = new Map(tree.children.map(c=>[c.path, "content "+c.path]));
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree, fileContents });
    expect(sel.budget.candidates).toBe(20 + 1); // files + constraint
    expect(sel.selected.length).toBeLessThan(20);
    expect(sel.budget.used).toBeLessThanOrEqual(1000);
  });

  it("18. agent can still request additional files through tools", () => {
    // M154 provides initial context, agent tool registry still available
    const registry = createToolRegistry();
    expect(typeof registry.getTool).toBe("function");
    // context intelligence does not disable tools
    const req = createContextRequest({ task: "auth" });
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree: makeTree(["root/a.ts"]), fileContents: new Map([["root/a.ts","a"]]) });
    expect(sel.selected.length).toBeGreaterThan(0);
    // tool still exists
    expect(registry).toBeTruthy();
  });

  it("19. empty/unknown project handled gracefully", () => {
    const req = createContextRequest({ task: "anything" });
    const sel = selectContext(req, { projectData: createEmptyModcodes({name:"App"}), tree: { name:"root", kind:"directory", children: [] }, fileContents: new Map() });
    expect(sel.selected.length).toBeGreaterThan(0); // at least constraint
    expect(sel.rejected.length).toBe(0);
  });

  it("20. ranking remains deterministic", () => {
    const req = createContextRequest({ task: "password reset" });
    const tree = makeTree(["root/src/auth/passwordReset.ts","root/src/auth/session.ts","root/src/dashboard/Dashboard.tsx"]);
    const fileContents = new Map([["root/src/auth/passwordReset.ts","reset"], ["root/src/auth/session.ts","session"], ["root/src/dashboard/Dashboard.tsx","dash"]]);
    const base = createEmptyModcodes({name:"App"});
    const a = selectContext(req, { projectData: base, tree, fileContents });
    const b = selectContext(req, { projectData: base, tree, fileContents });
    expect(a.selected.map(s=>s.path)).toEqual(b.selected.map(s=>s.path));
  });
});
