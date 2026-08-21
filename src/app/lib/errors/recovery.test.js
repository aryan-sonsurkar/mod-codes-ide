import { describe, expect, it } from "vitest";
import { recoveryForError } from "./recovery";

describe("recovery", () => {
  it("maps bridge not paired", () => {
    const r = recoveryForError(new Error("Local bridge not paired"));
    expect(r.action).toBe("pairBridge");
  });
  it("maps Ollama connection", () => {
    const r = recoveryForError({ code: "connectionFailed", message: "Ollama is not reachable" });
    expect(r.action).toBe("checkOllama");
  });
  it("maps WebGPU unsupported", () => {
    const r = recoveryForError({ code: "unsupported", message: "WebGPU is not available" });
    expect(r.action).toBe("enableWebGPU");
  });
  it("defaults to retry", () => {
    const r = recoveryForError(new Error("unknown"));
    expect(r.action).toBe("retry");
  });
});
