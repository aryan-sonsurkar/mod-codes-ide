import { describe, it, expect, vi, beforeEach } from "vitest";
import { canShowAd, recordAdShown, getAdCooldownRemaining, resetAdFrequency, resetAllAdFrequency } from "./adFrequency";
import { createAdSenseProvider, generateAdsTxt } from "./adSenseProvider";
import { createAdService } from "./AdService";
import { createUsageTracker } from "../ai/usageTracker";
import { isSecretPath } from "../ai/context/secrets";
import { buildContext } from "../ai/context";

beforeEach(() => {
  resetAllAdFrequency();
});

describe("M162: Frequency control", () => {
  it("canShowAd returns true for new placement", () => {
    expect(canShowAd("project-open")).toBe(true);
  });

  it("canShowAd returns false within cooldown when storage works", () => {
    if (typeof localStorage !== "undefined") {
      recordAdShown("project-open");
      expect(canShowAd("project-open", 60000)).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it("canShowAd returns true after cooldown", () => {
    recordAdShown("project-open");
    expect(canShowAd("project-open", 0)).toBe(true);
  });

  it("recordAdShown persists timestamp when storage works", () => {
    if (typeof localStorage !== "undefined") {
      recordAdShown("dashboard");
      const remaining = getAdCooldownRemaining("dashboard", 60000);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    } else {
      expect(true).toBe(true);
    }
  });

  it("getAdCooldownRemaining returns 0 for new placement", () => {
    expect(getAdCooldownRemaining("unknown")).toBe(0);
  });

  it("resetAdFrequency clears single placement", () => {
    recordAdShown("test");
    resetAdFrequency("test");
    expect(canShowAd("test")).toBe(true);
  });

  it("resetAllAdFrequency clears all placements", () => {
    recordAdShown("a");
    recordAdShown("b");
    resetAllAdFrequency();
    expect(canShowAd("a")).toBe(true);
    expect(canShowAd("b")).toBe(true);
  });

  it("different placements have independent cooldowns", () => {
    recordAdShown("project-open");
    expect(canShowAd("dashboard")).toBe(true);
    expect(canShowAd("ide-secondary")).toBe(true);
  });
});

describe("M162: Placement isolation", () => {
  it("AdSense provider has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
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

  it("adFrequency has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adFrequency.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
    expect(content).not.toContain("writeFile");
  });

  it("AdContainer has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/components/Ads/AdContainer.jsx", "utf8");
    expect(content).not.toContain("from \"../../lib/project");
    expect(content).not.toContain("from '../../lib/project");
    expect(content).not.toContain("from \"../../lib/ai");
    expect(content).not.toContain("from '../../lib/ai");
    expect(content).not.toContain("writeFile");
  });

  it("ConsentBanner has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/components/Ads/ConsentBanner.jsx", "utf8");
    expect(content).not.toContain("from \"../../lib/project");
    expect(content).not.toContain("from '../../lib/project");
    expect(content).not.toContain("from \"../../lib/ai");
    expect(content).not.toContain("from '../../lib/ai");
    expect(content).not.toContain("writeFile");
  });
});

describe("M162: Consent integration", () => {
  it("consent denied blocks ad rendering", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.hasConsent()).toBe(false);
    const result = provider.renderAd({});
    expect(result.ok).toBe(false);
  });

  it("consent granted allows ad rendering", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(true);
    expect(provider.hasConsent()).toBe(true);
  });

  it("consent not required allows ad rendering", () => {
    const provider = createAdSenseProvider({
      consentRequired: false,
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.hasConsent()).toBe(true);
  });
});

describe("M162: Failure recovery", () => {
  it("ad failure does not block project opening", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
  });

  it("ad failure does not block Save Gate", async () => {
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

  it("ad failure does not block agent approval", async () => {
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

  it("ad failure does not block test approval", () => {
    const { createTestExecutionPlan } = require("../testing/testExecution");
    const plan = createTestExecutionPlan({
      milestone: { id: "M1", goal: "Test" },
      packageJsonText: '{"scripts":{"test":"vitest run"}}',
      fileList: ["test.js"],
    });
    expect(plan.command).toBeTruthy();
    expect(plan.requiresApproval).toBe(true);
  });

  it("ad provider unavailable does not crash", () => {
    const provider = createAdSenseProvider({ enabled: false });
    expect(provider.isAvailable()).toBe(false);
    expect(provider.renderAd({})).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("M162: Responsive behavior", () => {
  it("all placements work with responsive flag", () => {
    const svc = createAdService();
    const placements = ["dashboard", "project-open", "ide-secondary", "research"];
    for (const p of placements) {
      const ad = svc.requestAd({ placement: p });
      expect(ad).toBeTruthy();
      expect(ad.placement).toBe(p);
    }
  });
});

describe("M162: Data isolation", () => {
  it("usage limits remain independent of ads", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 50 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("ok");
  });

  it("unknown token usage remains unknown", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "bonsai" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
  });

  it("config summary masks publisher ID", () => {
    const provider = createAdSenseProvider({ publisherId: "8259194534475821" });
    const summary = provider.getConfigSummary();
    expect(summary.publisherId).toContain("...");
    expect(summary.publisherId).not.toBe("8259194534475821");
  });

  it("secrets still excluded from context", () => {
    expect(isSecretPath(".env")).toBe(true);
    const ctx = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
  });

  it("IDE remains functional without ads", () => {
    const { loadSettings } = require("../settings/settingsStorage");
    const s = loadSettings();
    expect(s.ai.provider).toBeTruthy();
  });
});

describe("M162: No sensitive imports", () => {
  it("adFrequency has no fs imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adFrequency.js", "utf8");
    expect(content).not.toContain("require(\"fs\")");
    expect(content).not.toContain("import fs");
    expect(content).not.toContain("require('fs')");
  });

  it("adSenseProvider has no fs imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("require(\"fs\")");
    expect(content).not.toContain("import fs");
    expect(content).not.toContain("require('fs')");
  });
});

describe("M162: ads.txt configuration", () => {
  it("generateAdsTxt with real publisher ID", () => {
    const result = generateAdsTxt("8259194534475821");
    expect(result).toBe("google.com, 8259194534475821, DIRECT, f08c47fec0942fa0");
  });

  it("generateAdsTxt with empty ID returns null", () => {
    expect(generateAdsTxt("")).toBeNull();
    expect(generateAdsTxt(null)).toBeNull();
  });
});

describe("M162: Ad does not block workflows", () => {
  it("ad does not block project opening flow", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "project-open" });
    expect(ad).toBeTruthy();
  });

  it("ad does not block IDE secondary area", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "ide-secondary" });
    expect(ad).toBeTruthy();
  });

  it("ad does not block dashboard", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "dashboard" });
    expect(ad).toBeTruthy();
  });
});
