import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAdSenseProvider, CONSENT_STATES, generateAdsTxt } from "./adSenseProvider";
import { createAdService } from "./AdService";
import { canShowAd, recordAdShown, resetAllAdFrequency } from "./adFrequency";
import { createUsageTracker } from "../ai/usageTracker";
import { isSecretPath } from "../ai/context/secrets";
import { buildContext } from "../ai/context";

beforeEach(() => {
  resetAllAdFrequency();
});

describe("M163: Consent lifecycle", () => {
  it("initial state is unknown when consent required", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    expect(provider.getConsentState()).toBe(CONSENT_STATES.UNKNOWN);
    expect(provider.hasConsent()).toBe(false);
  });

  it("initial state is accepted when consent not required", () => {
    const provider = createAdSenseProvider({ consentRequired: false });
    expect(provider.getConsentState()).toBe(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
  });

  it("accept consent", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.getConsentState()).toBe(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
  });

  it("decline consent", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(CONSENT_STATES.DECLINED);
    expect(provider.getConsentState()).toBe(CONSENT_STATES.DECLINED);
    expect(provider.hasConsent()).toBe(false);
  });

  it("revoke consent back to unknown", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
    provider.setConsent(CONSENT_STATES.UNKNOWN);
    expect(provider.getConsentState()).toBe(CONSENT_STATES.UNKNOWN);
    expect(provider.hasConsent()).toBe(false);
  });

  it("declined to accepted transition", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(CONSENT_STATES.DECLINED);
    expect(provider.hasConsent()).toBe(false);
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
  });

  it("accepted to declined transition", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
    provider.setConsent(CONSENT_STATES.DECLINED);
    expect(provider.hasConsent()).toBe(false);
  });

  it("boolean true sets accepted", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(true);
    expect(provider.getConsentState()).toBe(CONSENT_STATES.ACCEPTED);
  });

  it("boolean false sets declined", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(false);
    expect(provider.getConsentState()).toBe(CONSENT_STATES.DECLINED);
  });
});

describe("M163: Consent-driven ad behavior", () => {
  it("no consent = no ad rendering", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    expect(provider.renderAd({})).toEqual({ ok: false, reason: "unavailable" });
  });

  it("consent accepted = ad eligible", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
  });

  it("consent declined = ad blocked", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(CONSENT_STATES.DECLINED);
    expect(provider.renderAd({})).toEqual({ ok: false, reason: "unavailable" });
  });

  it("consent revoked = ad stops", () => {
    const provider = createAdSenseProvider({
      consentRequired: true,
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.hasConsent()).toBe(true);
    provider.setConsent(CONSENT_STATES.UNKNOWN);
    expect(provider.renderAd({})).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("M163: Config summary safety", () => {
  it("publisher ID is masked", () => {
    const provider = createAdSenseProvider({ publisherId: "8259194534475821" });
    const summary = provider.getConfigSummary();
    expect(summary.publisherId).toContain("...");
    expect(summary.publisherId).not.toBe("8259194534475821");
  });

  it("consentState is included in summary", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    const summary = provider.getConfigSummary();
    expect(summary.consentState).toBe(CONSENT_STATES.UNKNOWN);
    expect(summary.consentGranted).toBe(false);
  });
});

describe("M163: Failure handling", () => {
  it("provider unavailable does not crash", () => {
    const provider = createAdSenseProvider({ enabled: false });
    expect(provider.isAvailable()).toBe(false);
    expect(provider.renderAd({})).toEqual({ ok: false, reason: "unavailable" });
  });

  it("missing publisher ID does not crash", () => {
    const provider = createAdSenseProvider({ publisherId: "" });
    expect(provider.isAvailable()).toBe(false);
  });

  it("invalid consent state does not crash", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent("invalid");
    const state = provider.getConsentState();
    expect([CONSENT_STATES.ACCEPTED, CONSENT_STATES.DECLINED, CONSENT_STATES.UNKNOWN]).toContain(state);
  });

  it("null container does not crash", () => {
    const provider = createAdSenseProvider({
      enabled: true,
      publisherId: "8259194534475821",
    });
    provider.setConsent(CONSENT_STATES.ACCEPTED);
    expect(provider.renderAd(null)).toEqual({ ok: false, reason: "unavailable" });
  });

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

describe("M163: Data isolation", () => {
  it("adSenseProvider has no project imports", async () => {
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

  it("adSenseProvider has no fs imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("require(\"fs\")");
    expect(content).not.toContain("import fs");
  });

  it("secrets still excluded from context", () => {
    expect(isSecretPath(".env")).toBe(true);
    const ctx = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
  });
});

describe("M163: Frequency controls preserved", () => {
  it("different placements independent", () => {
    recordAdShown("project-open");
    expect(canShowAd("dashboard")).toBe(true);
    expect(canShowAd("ide-secondary")).toBe(true);
  });

  it("reset clears cooldowns", () => {
    recordAdShown("test");
    resetAllAdFrequency();
    expect(canShowAd("test")).toBe(true);
  });
});

describe("M163: Ads.txt configuration", () => {
  it("generateAdsTxt with real publisher ID", () => {
    const result = generateAdsTxt("8259194534475821");
    expect(result).toBe("google.com, 8259194534475821, DIRECT, f08c47fec0942fa0");
  });

  it("generateAdsTxt with empty ID returns null", () => {
    expect(generateAdsTxt("")).toBeNull();
    expect(generateAdsTxt(null)).toBeNull();
  });
});

describe("M163: Usage limits independent of ads", () => {
  it("usage tracker works without ads", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(100);
  });

  it("unknown token usage remains unknown", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "bonsai" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
  });
});

describe("M163: Ad does not block workflows", () => {
  it("ad does not block project opening", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "project-open" });
    expect(ad).toBeTruthy();
  });

  it("ad does not block Save Gate", async () => {
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

  it("ad does not block agent approval", async () => {
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

  it("ad does not block test approval", () => {
    const { createTestExecutionPlan } = require("../testing/testExecution");
    const plan = createTestExecutionPlan({
      milestone: { id: "M1", goal: "Test" },
      packageJsonText: '{"scripts":{"test":"vitest run"}}',
      fileList: ["test.js"],
    });
    expect(plan.command).toBeTruthy();
    expect(plan.requiresApproval).toBe(true);
  });

  it("IDE remains functional without ads", () => {
    const { loadSettings } = require("../settings/settingsStorage");
    const s = loadSettings();
    expect(s.ai.provider).toBeTruthy();
  });
});

describe("M163: Mock mode preserved", () => {
  it("mock ad service round-robin works", () => {
    const svc = createAdService();
    const ad1 = svc.requestAd({ placement: "test" });
    const ad2 = svc.requestAd({ placement: "test" });
    expect(ad1).toBeTruthy();
    expect(ad2).toBeTruthy();
  });

  it("mock ad service impression tracking works", () => {
    const svc = createAdService();
    svc.requestAd({ placement: "test" });
    svc.showAd();
    const report = svc.reportImpression();
    expect(report.impressions).toBe(1);
  });
});
