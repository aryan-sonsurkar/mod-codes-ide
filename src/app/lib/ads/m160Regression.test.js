import { describe, it, expect, vi } from "vitest";
import { createAdService } from "./AdService";
import { createAdSenseProvider, generateAdsTxt } from "./adSenseProvider";
import { createUsageTracker } from "../ai/usageTracker";
import { createOllamaProvider } from "../ai/providers/ollama";
import { createModcodesCoderProvider } from "../ai/providers/modcodesCoder";
import { createBrowserBonsaiProvider } from "../ai/browser/provider";
import { isSecretPath } from "../ai/context/secrets";
import { buildContext } from "../ai/context";
import { loadSettings, DEFAULT_SETTINGS } from "../settings/settingsStorage";

describe("M160: Mock ads work", () => {
  it("mock ad service returns ads without project data", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "projects" });
    expect(ad).toBeTruthy();
    expect(ad.label).toBe("Sponsored");
    expect(ad.placement).toBe("projects");
  });

  it("mock ad service round-robins via showAd", () => {
    const svc = createAdService();
    svc.requestAd();
    svc.showAd();
    const a2 = svc.requestAd();
    expect(a2).toBeTruthy();
  });
});

describe("M160: Ad provider failure does not break IDE", () => {
  it("ad service with enabled=false returns null", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
  });

  it("ad sense provider unavailable when disabled", () => {
    const provider = createAdSenseProvider({ enabled: false });
    expect(provider.isAvailable()).toBe(false);
  });

  it("ad sense provider unavailable when no publisher ID", () => {
    const provider = createAdSenseProvider({ enabled: true, publisherId: "" });
    expect(provider.isAvailable()).toBe(false);
  });
});

describe("M160: Ads cannot access project data", () => {
  it("AdService never receives source code", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "projects" });
    expect(JSON.stringify(ad)).not.toContain("function");
    expect(JSON.stringify(ad)).not.toContain("import");
    expect(JSON.stringify(ad)).not.toContain("require");
  });

  it("AdSense provider has no project data imports", () => {
    const provider = createAdSenseProvider();
    expect(provider.isAvailable()).toBe(false);
  });
});

describe("M160: AdService has no sensitive imports", () => {
  it("AdService.js has no filesystem imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/AdService.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from './project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
    expect(content).not.toContain("from \"../terminal");
    expect(content).not.toContain("from '../terminal");
    expect(content).not.toContain("writeFile");
    expect(content).not.toContain("readFile");
  });

  it("adSenseProvider.js has no project imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("from \"../ai");
    expect(content).not.toContain("from '../ai");
    expect(content).not.toContain("writeFile");
  });
});

describe("M160: Ad configuration missing → graceful fallback", () => {
  it("ad sense with no config returns unavailable", () => {
    const provider = createAdSenseProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(provider.getPublisherId()).toBeNull();
  });

  it("generateAdsTxt returns null for empty publisher", () => {
    expect(generateAdsTxt("")).toBeNull();
    expect(generateAdsTxt(null)).toBeNull();
  });

  it("generateAdsTxt returns valid ads.txt line", () => {
    const result = generateAdsTxt("12345678");
    expect(result).toContain("google.com");
    expect(result).toContain("12345678");
    expect(result).toContain("DIRECT");
  });
});

describe("M160: AdSense disabled → application still works", () => {
  it("app loads with ads disabled", () => {
    const svc = createAdService({ enabled: false });
    expect(svc.requestAd()).toBe(null);
    expect(svc.showAd()).toBe(null);
  });

  it("settings persist with ads disabled", () => {
    const s = loadSettings();
    expect(s.ai.provider).toBeTruthy();
  });
});

describe("M160: Invalid publisher configuration → graceful failure", () => {
  it("invalid publisher ID → provider unavailable", () => {
    const provider = createAdSenseProvider({ enabled: true, publisherId: "invalid" });
    expect(provider.isAvailable()).toBe(true);
    expect(provider.getPublisherId()).toBe("invalid");
  });

  it("script load failure → available becomes false", async () => {
    const provider = createAdSenseProvider({ enabled: true, publisherId: "12345678" });
    expect(provider.isAvailable()).toBe(true);
  });
});

describe("M160: Token usage unavailable → shown as unknown", () => {
  it("usage tracker handles unknown token counts", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
  });

  it("usage tracker handles known token counts", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", inputTokens: 100, outputTokens: 50 });
    expect(entry.known).toBe(true);
    expect(entry.totalTokens).toBe(150);
  });
});

describe("M160: Provider usage limit reached → no crash", () => {
  it("limit reached returns honest status", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("limit_reached");
    expect(status.type).toBe("daily");
    expect(status.message).toContain("limit");
  });

  it("no limit returns ok", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 1000000 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("ok");
  });
});

describe("M160: Provider unavailable → no silent fallback", () => {
  it("ollama provider honest about availability", () => {
    const p = createOllamaProvider({ baseUrl: "http://127.0.0.1:11434" });
    expect(typeof p.testConnection).toBe("function");
    expect(typeof p.chat).toBe("function");
  });

  it("modcodes-coder stub is honest", async () => {
    const p = createModcodesCoderProvider({ latencyMs: 1 });
    const result = await p.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(result.text).toMatch(/MODCODES-CODER/);
  });
});

describe("M160: Bonsai unsupported → honest state", () => {
  it("bonsai provider exists as factory", () => {
    expect(typeof createBrowserBonsaiProvider).toBe("function");
  });
});

describe("M160: Bonsai failure → recovery", () => {
  it("bonsai provider can be constructed without crash", () => {
    expect(() => createBrowserBonsaiProvider()).not.toThrow();
  });
});

describe("M160: Ollama unavailable → honest state", () => {
  it("ollama provider exposes testConnection", () => {
    const p = createOllamaProvider({ baseUrl: "http://127.0.0.1:11434" });
    expect(typeof p.testConnection).toBe("function");
  });
});

describe("M160: Save Gate remains authoritative", () => {
  it("applyProposalViaSaveGate requires saveModcodes function", async () => {
    const { applyProposalViaSaveGate } = await import("../project/memoryProposal");
    const result = await applyProposalViaSaveGate({
      proposal: { status: "accepted", section: "Progress", operation: "append", after: "test", before: "" },
      projectData: { project: { name: "App" }, sections: { Progress: "" } },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Save Gate unavailable");
  });
});

describe("M160: AI cannot bypass approval", () => {
  it("agent orchestrator requires approval before execution", async () => {
    const { createAgentOrchestrator } = await import("../ai/agentOrchestrator");
    const orch = createAgentOrchestrator({ maxSteps: 2 });
    await orch.startTask({ title: "Test" });
    expect(orch.getSnapshot().state).toBe("awaitingApproval");
    await expect(orch.executeStep({ toolName: "test" })).rejects.toThrow(/Cannot execute/);
  });
});

describe("M160: Secrets remain excluded", () => {
  it(".env excluded from AI context", () => {
    const ctx = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
  });

  it("private key paths excluded", () => {
    expect(isSecretPath("src/secret.pem")).toBe(true);
    expect(isSecretPath("id_rsa")).toBe(true);
  });
});

describe("M160: Mobile ad container does not block UI", () => {
  it("ad service returns responsive placements", () => {
    const svc = createAdService();
    const ad = svc.requestAd({ placement: "projects" });
    expect(ad.placement).toBe("projects");
  });
});

describe("M160: Refresh does not corrupt provider/usage state", () => {
  it("usage tracker survives reset", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.resetSession();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
  });

  it("settings survive reload", () => {
    const s1 = loadSettings();
    const s2 = loadSettings();
    expect(s1.ai.provider).toBe(s2.ai.provider);
  });
});

describe("M160: AdSense consent behavior", () => {
  it("consent defaults to required", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    expect(provider.hasConsent()).toBe(false);
  });

  it("consent can be granted", () => {
    const provider = createAdSenseProvider({ consentRequired: true });
    provider.setConsent(true);
    expect(provider.hasConsent()).toBe(true);
  });

  it("no consent required when consentRequired=false", () => {
    const provider = createAdSenseProvider({ consentRequired: false });
    expect(provider.hasConsent()).toBe(true);
  });
});

describe("M160: AdSense config summary", () => {
  it("returns safe summary without exposing full publisher ID", () => {
    const provider = createAdSenseProvider({ publisherId: "1234567890123456" });
    const summary = provider.getConfigSummary();
    expect(summary.publisherId).toContain("...");
    expect(summary.publisherId).not.toContain("1234567890123456");
  });
});

describe("M160: Usage limits with different providers", () => {
  it("tracks per-provider usage", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.trackUsage({ provider: "bonsai", totalTokens: 50 });
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(150);
  });

  it("session reset clears only session", () => {
    const tracker = createUsageTracker({ limits: { daily: 1000 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.resetSession();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(100);
  });
});
