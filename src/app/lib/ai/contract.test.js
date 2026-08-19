import { afterEach, describe, expect, it } from "vitest";
import {
  AI_ERRORS,
  AiError,
  AiModel,
  collectStreamText,
  createAiRequest,
  createChatFailure,
  createChatResult,
  defineProvider,
  errorChunk,
  isAiError,
  normalizeAiError,
  registerProvider,
  clearProviders,
  getProvider,
  listProviders,
  hasProvider,
} from "./index";

describe("errors", () => {
  it("normalizes errors to AiError", () => {
    const normalized = normalizeAiError(new Error("boom"));
    expect(isAiError(normalized)).toBe(true);
    expect(normalized.code).toBe(AI_ERRORS.invalidRequest);
    expect(normalized.message).toBe("boom");
  });

  it("keeps AiError as-is", () => {
    const err = new AiError(AI_ERRORS.timeout, "timed out", {
      retryable: true,
    });
    expect(normalizeAiError(err)).toBe(err);
    expect(err.retryable).toBe(true);
  });

  it("normalizes non-errors", () => {
    const normalized = normalizeAiError(undefined);
    expect(isAiError(normalized)).toBe(true);
  });
});

describe("model", () => {
  it("creates a provider-neutral model", () => {
    const model = new AiModel({
      id: "llama3.1",
      name: "Llama 3.1",
      provider: "ollama",
      capabilities: ["chat", "streaming"],
      contextLength: 128000,
    });

    expect(model.id).toBe("llama3.1");
    expect(model.provider).toBe("ollama");
    expect(model.supports("chat")).toBe(true);
    expect(model.supports("tools")).toBe(false);
    expect(model.contextLength).toBe(128000);
  });

  it("rejects models without id or provider", () => {
    expect(() => new AiModel({ provider: "ollama" })).toThrow(TypeError);
    expect(() => new AiModel({ id: "x" })).toThrow(TypeError);
  });

  it("defaults metadata without fabricating values", () => {
    const model = new AiModel({ id: "x", provider: "ollama" });
    expect(model.contextLength).toBeNull();
    expect(model.metadata).toEqual({});
  });
});

describe("request", () => {
  it("normalizes a provider-neutral request", () => {
    const request = createAiRequest({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
      model: "llama3.1",
      context: { currentFile: "src/a.js" },
      options: { temperature: 0.2 },
    });

    expect(request.messages).toHaveLength(2);
    expect(request.model).toBe("llama3.1");
    expect(request.context.currentFile).toBe("src/a.js");
    expect(request.options.temperature).toBe(0.2);
  });

  it("rejects invalid messages", () => {
    expect(() =>
      createAiRequest({ messages: [{ role: "robot", content: "x" }] })
    ).toThrow(AiError);
    expect(() =>
      createAiRequest({ messages: [{ role: "user", content: 42 }] })
    ).toThrow(AiError);
    expect(() => createAiRequest({ messages: "not-an-array" })).toThrow(
      AiError
    );
  });
});

describe("response", () => {
  it("builds results and failures", () => {
    expect(createChatResult({ text: "hi" })).toEqual({ ok: true, text: "hi" });

    const failure = createChatFailure(new AiError(AI_ERRORS.unavailable, "down"));
    expect(failure.ok).toBe(false);
    expect(failure.code).toBe(AI_ERRORS.unavailable);
  });

  it("collects stream text and rethrows errors", async () => {
    async function* stream() {
      yield { type: "text", text: "hel" };
      yield { type: "text", text: "lo" };
      yield { type: "done" };
    }

    expect(await collectStreamText(stream())).toBe("hello");

    async function* failing() {
      yield { type: "text", text: "x" };
      yield errorChunk(new AiError(AI_ERRORS.timeout, "timeout"));
    }

    await expect(collectStreamText(failing())).rejects.toMatchObject({
      code: AI_ERRORS.timeout,
    });
  });
});

describe("registry", () => {
  const fakeProvider = defineProvider({
    id: "fake",
    name: "Fake Provider",
    getCapabilities: () => ({ id: "fake", name: "Fake Provider", capabilities: ["chat"] }),
    getModels: async () => [],
    chat: async () => createChatResult({ text: "ok" }),
  });

  afterEach(() => clearProviders());

  it("registers, fetches and lists providers", () => {
    registerProvider(fakeProvider);

    expect(getProvider("fake")).toBe(fakeProvider);
    expect(hasProvider("fake")).toBe(true);
    expect(listProviders()).toEqual([fakeProvider]);
  });

  it("rejects duplicate registration", () => {
    registerProvider(fakeProvider);
    expect(() => registerProvider(fakeProvider)).toThrow(AiError);
  });

  it("rejects malformed providers", () => {
    expect(() =>
      registerProvider({ id: "bad", name: "Bad", getModels: async () => [] })
    ).toThrow(AiError);
  });

  it("returns null for unknown providers", () => {
    expect(getProvider("nope")).toBeNull();
    expect(hasProvider("nope")).toBe(false);
  });
});