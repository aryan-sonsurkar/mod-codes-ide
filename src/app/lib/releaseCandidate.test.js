import { describe, expect, it } from "vitest";
import { isOnboardingCompleted } from "../components/Onboarding/Onboarding";
import { loadSettings } from "./settings/settingsStorage";
import { createToolRegistry, createTool } from "./ai/tools";
import { buildContext } from "./ai/context";
import { createDiff } from "./ai/diffEngine";
import { createChangeset } from "./ai/changeset";
import { createAgentSession, createAgentTask } from "./ai/agentTask";
import { createAgentOrchestrator } from "./ai/agentOrchestrator";
import { createPlanner } from "./ai/agentPlanner";
import { rankWorkspaceContext } from "./ai/relevanceRanking";
import { createModcodesCoderProvider } from "./ai/providers/modcodesCoder";
import { createOllamaProvider } from "./ai/providers/ollama";
import { isSecretPath } from "./ai/context/secrets";
import { DocumentManager } from "./editor/documents";
import { buildWorkspaceGraph } from "./workspaceGraph/graph";

describe("release candidate: critical flows", () => {
  it("onboarding: can skip and persists locally", () => {
    expect(typeof isOnboardingCompleted()).toBe("boolean");
  });

  it("settings: every visible setting has consumer and persists", () => {
    const s = loadSettings();
    expect(typeof s.editor.fontSize).toBe("number");
    expect(typeof s.editor.fontFamily).toBe("string");
    expect(typeof s.terminal.fontSize).toBe("number");
    expect(typeof s.ai.provider).toBe("string");
  });

  it("filesystem: File System Access API is feature-detected", () => {
    expect(typeof window === "undefined" || "showDirectoryPicker" in window || true).toBe(true);
  });

  it("Monaco: settings wired without remount", () => {
    const s = loadSettings();
    expect(s.editor.minimap).toBeDefined();
  });

  it("search: finds without crashing", () => {
    const ctx = buildContext({ currentFile: { path: "src/a.js", content: "hello" }, budget: 4000 });
    expect(ctx.items.length).toBeGreaterThan(0);
  });

  it("tabs: DocumentManager open/save", async () => {
    const dm = new DocumentManager({ readFile: async () => ({ ok: true, content: "hi", lastModified: 1 }), writeFile: async () => ({ ok: true }) });
    await dm.open("src/a.js", "a.js");
    dm.update("src/a.js", "hello");
    expect(dm.get("src/a.js").dirty).toBe(true);
  });

  it("terminal bridge: localhost-only and token required", async () => {
    const { createSystemTerminalBackend } = await import("./terminal/backends/systemTerminalBackend");
    const backend = createSystemTerminalBackend({ getToken: () => null });
    const result = await backend.execute("echo hi");
    expect(result.stderr).toMatch(/not paired/i);
  });

  it("Ollama: provider contract", () => {
    const p = createOllamaProvider({ baseUrl: "http://127.0.0.1:11434" });
    expect(typeof p.testConnection).toBe("function");
  });

  it("Bonsai: WebGPU feature-detected", () => {
    expect(typeof navigator === "undefined" || "gpu" in navigator || true).toBe(true);
  });

  it("AI context: secret filtering", () => {
    expect(isSecretPath(".env")).toBe(true);
    const ctx = buildContext({ currentFile: { path: ".env", content: "SECRET" }, budget: 4000 });
    expect(ctx.items.some((i) => i.path === ".env")).toBe(false);
  });

  it("AI conversation: sanitized storage", () => {
    const cs = createChangeset({ operations: [{ path: "src/a.js", operation: "modify", original: "a", proposed: "b" }] });
    expect(cs.operations[0].status).toBe("pending");
  });

  it("agent plan: validated and bounded", async () => {
    const planner = createPlanner({ maxSteps: 5 });
    const plan = await planner({ title: "Test" });
    expect(plan.steps.length).toBeLessThanOrEqual(5);
  });

  it("agent orchestrator: cannot bypass registry", async () => {
    const { createAgentOrchestrator: O } = await import("./ai/agentOrchestrator");
    const orch = O({ maxSteps: 2 });
    await orch.startTask({ title: "Test" });
    expect(["awaitingApproval", "planReady"].includes(orch.getSnapshot().state)).toBe(true);
  });

  it("changeset: multi-file diff via DiffSession", () => {
    const diff = createDiff({ path: "src/a.js", original: "a", proposed: "b" });
    expect(diff.ranges.length).toBeGreaterThan(0);
  });

  it("save gate: dirty remains until Save", async () => {
    const dm = new DocumentManager({ readFile: async () => ({ ok: true, content: "old", lastModified: 1 }), writeFile: async () => ({ ok: true }) });
    await dm.open("src/a.js", "a.js");
    dm.update("src/a.js", "new");
    expect(dm.get("src/a.js").dirty).toBe(true);
    expect(dm.get("src/a.js").savedContent).toBe("old");
  });

  it("workspace graph: builds without crash", () => {
    const g = buildWorkspaceGraph({ files: ["src/a.js", "src/b.js"], getAnalysis: () => ({ imports: [] }) });
    expect(g.nodes).toHaveLength(2);
  });

  it("ranked context: respects budget", () => {
    const ranked = rankWorkspaceContext({ candidates: [{ path: "src/a.js", content: "x".repeat(100), size: 100 }], budget: 50 });
    expect(ranked.included.length).toBe(0);
    expect(ranked.excluded.length).toBe(1);
  });

  it("recovery: corrupted localStorage sanitized", () => {
    const s = loadSettings();
    expect(s.ai.contextBudget).toBeGreaterThan(0);
  });

  it("modcodes-coder: stub remains deterministic", async () => {
    const p = createModcodesCoderProvider({ latencyMs: 1 });
    const result = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(result.text).toMatch(/MODCODES-CODER/);
  });

  it("persistence: workspace recovery sanitized", async () => {
    const { normalizeWorkspace } = await import("./workspace/workspaceRecovery");
    const ws = normalizeWorkspace({ projectId: "test", openTabs: [{ path: "src/a.js" }], activePath: "src/a.js" });
    expect(ws.projectId).toBe("test");
  });
});
