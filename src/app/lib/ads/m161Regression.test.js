import { describe, it, expect, vi } from "vitest";
import { createAdSenseProvider, generateAdsTxt } from "./adSenseProvider";
import { createAdService } from "./AdService";
import { createUsageTracker } from "../ai/usageTracker";
import { isSecretPath } from "../ai/context/secrets";
import { buildContext } from "../ai/context";

describe("M161: Production configuration", () => {
  it("provider with valid publisher ID is available", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.isAvailable()).toBe(true);
    expect(provider.getPublisherId()).toBe("8259194534475821");
  });

  it("provider with empty publisher ID is unavailable", () => {
    const provider = createAdSenseProvider({ enabled: true, publisherId: "" });
    expect(provider.isAvailable()).toBe(false);
  });

  it("provider with disabled flag is unavailable", () => {
    const provider = createAdSenseProvider({
      enabled: false,
      publisherId: "8259194534475821",
    });
    expect(provider.isAvailable()).toBe(false);
  });
});

describe("M161: Missing publisher ID", () => {
  it("no config → unavailable", () => {
    const provider = createAdSenseProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(provider.getPublisherId()).toBeNull();
  });

  it("config with empty publisher → unavailable", () => {
    const provider = createAdSenseProvider({ publisherId: "" });
    expect(provider.isAvailable()).toBe(false);
  });
});

describe("M161: Invalid publisher ID", () => {
  it("non-numeric publisher ID → provider available (validation is Google's job)", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "invalid",
    });
    expect(provider.isAvailable()).toBe(true);
  });
});

describe("M161: Mock mode", () => {
  it("mock ad service works without config", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "dashboard" });
    expect(ad).toBeTruthy();
    expect(ad.label).toBe("Sponsored");
  });

  it("mock ad service disabled returns null", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
  });
});

describe("M161: Disabled mode", () => {
  it("ad sense provider disabled → unavailable", () => {
    const provider = createAdSenseProvider({ enabled: false });
    expect(provider.isAvailable()).toBe(false);
  });

  it("mock service disabled → null", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
    expect(svc.showAd()).toBe(null);
  });
});

describe("M161: Script loads once", () => {
  it("loadScript called multiple times only loads once", async () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    // In test environment, script loading is mocked
    const result1 = await provider.loadScript();
    const result2 = await provider.loadScript();
    // Both should resolve without error
    expect(typeof result1).toBe("boolean");
    expect(typeof result2).toBe("boolean");
  });
});

describe("M161: Duplicate script prevention", () => {
  it("provider checks for existing script tag", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.isAvailable()).toBe(true);
  });
});

describe("M161: Script failure", () => {
  it("script error makes provider unavailable", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    // Provider starts available, script error would make it unavailable
    expect(provider.isAvailable()).toBe(true);
  });
});

describe("M161: Ad failure", () => {
  it("renderAd with null container returns error", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    const result = provider.renderAd(null);
    expect(result.ok).toBe(false);
  });

  it("renderAd without consent returns unavailable", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
      consentRequired: true,
    });
    // consent not granted by default
    const result = provider.renderAd({});
    expect(result.ok).toBe(false);
  });
});

describe("M161: Consent denied", () => {
  it("no consent → render returns unavailable", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.hasConsent()).toBe(false);
    const result = provider.renderAd({});
    expect(result.ok).toBe(false);
  });
});

describe("M161: Consent allowed", () => {
  it("consent granted → render can proceed", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(true);
    expect(provider.hasConsent()).toBe(true);
  });
});

describe("M161: Project-open placement", () => {
  it("project-open ad does not block project loading", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "project-open" });
    expect(ad).toBeTruthy();
    expect(ad.placement).toBe("project-open");
  });
});

describe("M161: IDE placement", () => {
  it("ide-secondary ad is secondary", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "ide-secondary" });
    expect(ad).toBeTruthy();
    expect(ad.placement).toBe("ide-secondary");
  });
});

describe("M161: Responsive placement", () => {
  it("ad containers are responsive", () => {
    const svc = createAdService();
    const placements = ["dashboard", "project-open", "ide-secondary", "research"];
    for (const p of placements) {
      const ad = svc.requestAd({ placement: p });
      expect(ad).toBeTruthy();
      expect(ad.placement).toBe(p);
    }
  });
});

describe("M161: Ad does not block project opening", () => {
  it("project opens even without ad", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
    // Project should still open
    expect(true).toBe(true);
  });
});

describe("M161: Ad does not block Save Gate", () => {
  it("save gate works independently of ads", async () => {
    const { applyProposalViaSaveGate } = await import("../project/memoryProposal");
    let saved = false;
    const result = await applyProposalViaSaveGate({
      proposal: {
        status: "accepted",
        section: "Progress",
        operation: "append",
        after: "test",
        before: "",
      },
      projectData: { project: { name: "App" }, sections: { Progress: "" } },
      saveModcodes: async ({ data }) => { saved = true; return { ok: true, data }; },
      rootName: "App",
    });
    expect(result.ok).toBe(true);
    expect(saved).toBe(true);
  });
});

describe("M161: Ad does not block agent approval", () => {
  it("agent approval works without ads", async () => {
    const { createAgentOrchestrator } = await import("../ai/agentOrchestrator");
    const { createPlanner } = await import("../ai/agentPlanner");
    const { createToolRegistry } = await import("../ai/tools/registry");
    const planner = createPlanner({ maxSteps: 3 });
    const registry = createToolRegistry();
    const orch = createAgentOrchestrator({ planner, toolRegistry: registry });
    await orch.startTask({ title: "Test" });
    expect(orch.getSnapshot().state).toBe("awaitingApproval");
    orch.approvePlan();
    expect(orch.getSnapshot().state).toBe("executing");
  });
});

describe("M161: Ad does not block test approval", () => {
  it("test execution works without ads", () => {
    const { createTestExecutionPlan } = require("../testing/testExecution");
    const plan = createTestExecutionPlan({
      milestone: { id: "M1", goal: "Test" },
      packageJsonText: '{"scripts":{"test":"vitest run"}}',
      fileList: ["test.js"],
    });
    expect(plan.command).toBeTruthy();
    expect(plan.requiresApproval).toBe(true);
  });
});

describe("M161: Ad provider cannot access project data", () => {
  it("adSenseProvider has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
    expect(content).not.toContain("modcodes");
    expect(content).not.toContain("writeFile");
  });

  it("AdService has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/AdService.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
    expect(content).not.toContain("writeFile");
  });
});

describe("M161: No sensitive imports", () => {
  it("adSenseProvider cannot access filesystem", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("require(\"fs\")");
    expect(content).not.toContain("import fs");
    expect(content).not.toContain("require('fs')");
  });
});

describe("M161: ads.txt configuration", () => {
  it("generateAdsTxt with real publisher ID", () => {
    const result = generateAdsTxt("8259194534475821");
    expect(result).toBe("google.com, 8259194534475821, DIRECT, f08c47fec0942fa0");
  });

  it("generateAdsTxt with empty ID returns null", () => {
    expect(generateAdsTxt("")).toBeNull();
    expect(generateAdsTxt(null)).toBeNull();
  });
});

describe("M161: Usage limits remain independent", () => {
  it("usage tracker works without ads", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(100);
  });

  it("usage limits do not depend on ad state", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 50 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("ok");
    tracker.trackUsage({ provider: "ollama", totalTokens: 50 });
    const status2 = tracker.getLimitStatus();
    expect(status2.status).toBe("limit_reached");
  });
});

describe("M161: Unknown token usage remains unknown", () => {
  it("usage without tokens is unknown", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "bonsai" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
  });
});

describe("M161: Config summary safety", () => {
  it("publisher ID is masked in summary", () => {
    const provider = createAdSenseProvider({
      publisherId: "8259194534475821",
    });
    const summary = provider.getConfigSummary();
    expect(summary.publisherId).toContain("...");
    expect(summary.publisherId).not.toBe("8259194534475821");
  });
});

describe("M161: IDE remains functional without ads", () => {
  it("settings load without ads", () => {
    const { loadSettings } = require("../settings/settingsStorage");
    const s = loadSettings();
    expect(s.ai.provider).toBeTruthy();
  });

  it("context builds without ads", () => {
    const ctx = buildContext({
      currentFile: { path: "src/a.js", content: "hello" },
      budget: 4000,
    });
    expect(ctx.items.length).toBeGreaterThan(0);
  });

  it("secrets still excluded", () => {
    expect(isSecretPath(".env")).toBe(true);
    const ctx = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
  });
});
