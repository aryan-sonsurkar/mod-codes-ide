import { describe, expect, it } from "vitest";
import { AI_ERRORS } from "../errors";
import { createModcodesCoderProvider, MODCODES_CODER_PROVIDER_ID } from "./modcodesCoder";

describe("modcodes-coder stub provider", () => {
  it("implements the provider contract", async () => {
    const provider = createModcodesCoderProvider({ latencyMs: 1 });
    expect(provider.id).toBe(MODCODES_CODER_PROVIDER_ID);
    expect(provider.getCapabilities().capabilities).toContain("chat");
    const models = await provider.getModels();
    expect(models[0].id).toContain("modcodes-coder");
    const connection = await provider.testConnection();
    expect(connection.ok).toBe(true);
  });

  it("chats and streams deterministically", async () => {
    const provider = createModcodesCoderProvider({ latencyMs: 1 });
    const chat = await provider.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(chat.text).toMatch(/MODCODES-CODER/);
    const stream = await provider.streamChat({ messages: [{ role: "user", content: "hi" }] });
    let text = "";
    for await (const chunk of stream) {
      if (chunk.type === "text") {
        text += chunk.text;
      }
    }
    expect(text).toMatch(/MODCODES-CODER/);
  });

  it("supports cancellation", async () => {
    const provider = createModcodesCoderProvider({ latencyMs: 20 });
    const controller = new AbortController();
    const stream = await provider.streamChat({ messages: [{ role: "user", content: "hi" }], signal: controller.signal });
    controller.abort();
    let sawError = false;
    for await (const chunk of stream) {
      if (chunk.type === "error" && chunk.error.code === AI_ERRORS.cancelled) {
        sawError = true;
      }
    }
    expect(sawError).toBe(true);
  });
});
