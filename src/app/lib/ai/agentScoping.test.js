import { describe, expect, it } from "vitest";
import { describeAgentScope } from "./agentScoping";

describe("describeAgentScope", () => {
  it("scopes browser-bonsai as an offline agent with honest limits", () => {
    const scope = describeAgentScope({ providerId: "browser-bonsai", ready: true, online: true });
    expect(scope.mode).toBe("offline");
    expect(scope.chip).toContain("Offline agent");
    expect(scope.hints.join(" ")).toContain("mechanical tasks");
    expect(scope.hints.join(" ")).toContain("No quota");
    expect(scope.honestLimit).toContain("small on-device model");
  });

  it("explains the download step when bonsai is not ready", () => {
    const scope = describeAgentScope({ providerId: "browser-bonsai", ready: false });
    expect(scope.mode).toBe("offline");
    expect(scope.honestLimit).toContain("Download");
  });

  it("scopes ready ollama as a connected local agent", () => {
    const scope = describeAgentScope({ providerId: "ollama", ready: true, online: true });
    expect(scope.mode).toBe("connected");
    expect(scope.chip).toContain("Ollama");
    expect(scope.honestLimit).toBeNull();
    expect(scope.hints.join(" ")).toContain("Nothing leaves your network");
  });

  it("flags ollama as unreachable when offline", () => {
    const scope = describeAgentScope({ providerId: "ollama", ready: false, online: false });
    expect(scope.mode).toBe("offline");
    expect(scope.chip).toContain("unreachable");
    expect(scope.hints.join(" ")).toContain("Bonsai");
  });

  it("tells the user to start ollama when it is not ready but online", () => {
    const scope = describeAgentScope({ providerId: "ollama", ready: false, online: true });
    expect(scope.mode).toBe("connected");
    expect(scope.honestLimit).toContain("Start the Ollama server");
  });

  it("returns a neutral scope for unknown providers", () => {
    const scope = describeAgentScope({ providerId: "mystery", ready: false });
    expect(scope.mode).toBe("unknown");
    expect(scope.hints).toEqual([]);
    expect(scope.honestLimit).toBeNull();
  });

  it("handles missing arguments", () => {
    const scope = describeAgentScope();
    expect(scope.mode).toBe("unknown");
  });
});
