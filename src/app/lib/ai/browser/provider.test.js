import { describe, expect, it, vi } from "vitest";
import { AI_ERRORS } from "../errors";
import { PROVIDER_STATES } from "../providerStates";
import { MODEL_STATES } from "./registry";
import { createModelRegistry } from "./registry";
import { createBrowserBonsaiProvider } from "./provider";
import { BONSAI_CAPABILITIES, BONSAI_PROVIDER_ID, mapRuntimeError } from "./runtime";

const MODEL_URL =
  "https://huggingface.co/WaveCut/Bonsai-web-GGUF/resolve/112ea7a1a6229bde132b176b9a72477a7ecfde64/1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf";

function makeCapability({ state = "available" } = {}) {
  return {
    state,
    adapter: state === "available" ? {} : null,
    device: state === "available" ? {} : null,
    limits: { maxStorageBufferBindingSize: 134217728 },
  };
}

function makeMemoryCache() {
  const store = new Map();
  return {
    match: async (url) => store.get(url),
    put: async (url, value) => store.set(url, value),
    delete: async (url) => store.delete(url),
    keys: async () => Array.from(store.keys()),
  };
}

function makeRuntime({ events = [], chatImpl = null } = {}) {
  const chat = {
    send: vi.fn(async function* (messages, options) {
      for (const event of events) {
        yield event;
      }
    }),
  };
  if (chatImpl) {
    chat.send = chatImpl;
  }
  const engine = {
    dispose: vi.fn(async () => {}),
    generate: vi.fn(async () => ({ tokenIds: [] })),
  };
  const runtime = {
    createEngine: vi.fn(async () => engine),
    createChat: vi.fn(async () => chat),
  };
  return { runtime, chat, engine };
}

function makeRegistry({ capability = makeCapability(), cache } = {}) {
  return createModelRegistry({
    capability,
    cacheProvider: { open: async () => cache || makeMemoryCache() },
  });
}

async function downloadedRegistry() {
  const cache = makeMemoryCache();
  await cache.put(MODEL_URL, new Response("weights"));
  return makeRegistry({ cache });
}

describe("mapRuntimeError", () => {
  it("normalizes runtime failures into AiError", () => {
    expect(mapRuntimeError({ name: "WebGPUUnavailableError" }).code).toBe(AI_ERRORS.unsupported);
    expect(mapRuntimeError({ name: "GpuOutOfMemoryError" }).code).toBe(AI_ERRORS.unavailable);
    expect(mapRuntimeError({ name: "AbortError" }).code).toBe(AI_ERRORS.cancelled);
    expect(mapRuntimeError(new Error("boom")).code).toBe(AI_ERRORS.unavailable);
    expect(mapRuntimeError(null, { cancelled: true }).code).toBe(AI_ERRORS.cancelled);
  });
});

describe("createBrowserBonsaiProvider", () => {
  it("exposes the provider contract", () => {
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry: makeRegistry(),
    });
    expect(provider.id).toBe(BONSAI_PROVIDER_ID);
    expect(typeof provider.getModels).toBe("function");
    expect(typeof provider.chat).toBe("function");
    expect(typeof provider.streamChat).toBe("function");
    expect(provider.getCapabilities().capabilities).toEqual(BONSAI_CAPABILITIES);
  });

  it("lists the catalog models with real metadata", async () => {
    const registry = await downloadedRegistry();
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const models = await provider.getModels();
    expect(models).toHaveLength(1);
    const model = models[0];
    expect(model.id).toBe("bonsai-1.7b");
    expect(model.name).toBe("Bonsai 1.7B");
    expect(model.provider).toBe(BONSAI_PROVIDER_ID);
    expect(model.contextLength).toBe(32768);
    expect(model.metadata.downloadBytes).toBe(248302336);
    expect(model.metadata.state).toBe(MODEL_STATES.downloaded);
    expect(model.metadata.compatible).toBe(true);
  });

  it("reports not-downloaded models through model metadata", async () => {
    const registry = makeRegistry();
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const models = await provider.getModels();
    expect(models[0].metadata.state).toBe(MODEL_STATES.notDownloaded);
    expect(models[0].metadata.compatible).toBe(true);
  });

  it("flags incompatible models when WebGPU is missing", async () => {
    const registry = makeRegistry({ capability: makeCapability({ state: "unsupported" }) });
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability({ state: "unsupported" }),
    });
    const models = await provider.getModels();
    expect(models[0].metadata.state).toBe(MODEL_STATES.incompatible);
    expect(models[0].metadata.compatible).toBe(false);
    expect(models[0].metadata.compatibilityReason).toBe("no-webgpu");
  });

  it("loads the engine and streams text", async () => {
    const registry = await downloadedRegistry();
    const { runtime } = makeRuntime({
      events: [
        { type: "text", text: "Hello" },
        { type: "text", text: " world" },
        { type: "done" },
      ],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });

    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.map((c) => c.type)).toEqual(["text", "text", "done"]);
    expect(chunks[0].text + chunks[1].text).toBe("Hello world");
    expect(runtime.createEngine).toHaveBeenCalledWith({
      files: [MODEL_URL],
      manifestUrl: null,
      auxUrl: null,
    });
    expect(runtime.createChat).toHaveBeenCalledWith(expect.anything(), {
      tokenizerJsonUrl: expect.stringContaining("tokenizer.json"),
      tokenizerConfigUrl: expect.stringContaining("tokenizer_config.json"),
    });
  });

  it("streams tool calls in the tool chunk shape", async () => {
    const registry = await downloadedRegistry();
    const { runtime } = makeRuntime({
      events: [
        { type: "text", text: "Let me check." },
        {
          type: "tool",
          toolCall: { name: "ide.current-file", arguments: { path: "a.js" } },
        },
        { type: "done" },
      ],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });

    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          id: "ide.current-file",
          name: "Current file",
          description: "Reads the current file",
          parameters: { type: "object", properties: {} },
        },
      ],
    })) {
      chunks.push(chunk);
    }

    const tool = chunks.find((c) => c.type === "tool");
    expect(tool.toolRequest).toEqual({
      toolName: "ide.current-file",
      arguments: { path: "a.js" },
    });
    const text = chunks.filter((c) => c.type === "text").map((c) => c.text).join("");
    expect(text).toBe("Let me check.");
  });

  it("chat collects text and tool calls", async () => {
    const registry = await downloadedRegistry();
    const { runtime } = makeRuntime({
      events: [
        { type: "text", text: "Answer" },
        { type: "tool", toolCall: { name: "ide.diagnostics", arguments: {} } },
        { type: "done" },
      ],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const result = await provider.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe("Answer");
    expect(result.toolCalls).toEqual([
      { toolName: "ide.diagnostics", arguments: {} },
    ]);
  });

  it("yields an error chunk when the model is not downloaded", async () => {
    const registry = makeRegistry();
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.notReady);
  });

  it("reports cancelled generation when the signal is aborted", async () => {
    const registry = await downloadedRegistry();
    const controller = new AbortController();
    controller.abort();
    const chatImpl = async function* (messages, options) {
      if (options && options.signal && options.signal.aborted) {
        yield { type: "error", error: { name: "AbortError" } };
        return;
      }
      yield { type: "done" };
    };
    const { runtime } = makeRuntime({ chatImpl });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.cancelled);
  });

  it("yields error chunks for runtime failures", async () => {
    const registry = await downloadedRegistry();
    const { runtime } = makeRuntime({
      events: [{ type: "error", error: { name: "GpuOutOfMemoryError" } }],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.unavailable);
  });

  it("fails when the runtime is unavailable (SSR/worker missing)", async () => {
    const registry = await downloadedRegistry();
    const provider = createBrowserBonsaiProvider({
      runtime: null,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.unsupported);
  });

  it("reuses the loaded engine across messages and disposes on dispose()", async () => {
    const registry = await downloadedRegistry();
    const { runtime, engine } = makeRuntime({
      events: [{ type: "text", text: "hi" }, { type: "done" }],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    const request = {
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    };
    await provider.chat(request);
    await provider.chat(request);
    expect(runtime.createEngine).toHaveBeenCalledTimes(1);
    await provider.dispose();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });

  it("passes context and tool results through to the runtime", async () => {
    const registry = await downloadedRegistry();
    let receivedMessages = null;
    const chatImpl = async function* (messages) {
      receivedMessages = messages;
      yield { type: "done" };
    };
    const { runtime } = makeRuntime({ chatImpl });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    await provider.chat({
      model: "bonsai-1.7b",
      context: {
        items: [{ type: "file", path: "a.js", content: "exports foo" }],
      },
      messages: [
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: "",
          tool_calls: [{ toolName: "ide.current-file", arguments: {} }],
        },
        { role: "tool", content: '{"text":"x"}', tool_name: "ide.current-file" },
      ],
    });
    expect(receivedMessages[0].role).toBe("system");
    expect(receivedMessages[0].content).toContain("a.js");
    expect(receivedMessages[1].role).toBe("user");
    expect(receivedMessages[2].tool_calls).toEqual([
      { toolName: "ide.current-file", arguments: {} },
    ]);
    expect(receivedMessages[3].role).toBe("tool");
    expect(receivedMessages[3].tool_name).toBe("ide.current-file");
  });

  it("testConnection reports WebGPU availability", async () => {
    const registry = await downloadedRegistry();
    const ok = await createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    }).testConnection();
    expect(ok.ok).toBe(true);
    expect(ok.capability.state).toBe("available");

    const bad = await createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability({ state: "unsupported" }),
    }).testConnection();
    expect(bad.ok).toBe(false);
    expect(bad.error.code).toBe(AI_ERRORS.unsupported);
  });

  it("maps incompatible models to an unsupported error", async () => {
    const registry = makeRegistry({
      capability: makeCapability({ state: "unsupported" }),
    });
    const provider = createBrowserBonsaiProvider({
      runtime: makeRuntime().runtime,
      registry,
      capabilityDetector: async () => makeCapability({ state: "unsupported" }),
    });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.unsupported);
  });
});

describe("createBrowserBonsaiProvider unloadModel", () => {
  it("disposes the resident engine and returns the model to downloaded", async () => {
    const registry = await downloadedRegistry();
    const { runtime, engine } = makeRuntime({
      events: [{ type: "text", text: "hi" }, { type: "done" }],
    });
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });

    await provider.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(runtime.createEngine).toHaveBeenCalledTimes(1);

    await expect(provider.unloadModel("bonsai-1.7b")).resolves.toEqual({
      unloaded: true,
    });
    expect(engine.dispose).toHaveBeenCalledTimes(1);
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(
      MODEL_STATES.downloaded
    );

    await expect(provider.unloadModel("bonsai-1.7b")).resolves.toEqual({
      unloaded: false,
    });

    await provider.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(runtime.createEngine).toHaveBeenCalledTimes(2);
    await provider.dispose();
  });
});

describe("createBrowserBonsaiProvider device loss", () => {
  it("evicts the dead engine and notifies subscribers", async () => {
    const registry = await downloadedRegistry();
    let settleLost = null;
    const lost = new Promise((resolve) => {
      settleLost = resolve;
    });
    const chat = {
      send: vi.fn(async function* () {
        yield { type: "text", text: "hi" };
        yield { type: "done" };
      }),
    };
    const engine = { dispose: vi.fn(async () => {}), lost };
    const runtime = {
      createEngine: vi.fn(async () => engine),
      createChat: vi.fn(async () => chat),
    };
    const onDeviceLost = vi.fn();
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
      onDeviceLost,
    });
    const seen = [];
    const unsubscribe = provider.subscribeDeviceLost((info) => seen.push(info));

    await provider.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(runtime.createEngine).toHaveBeenCalledTimes(1);

    settleLost("device-lost");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onDeviceLost).toHaveBeenCalledTimes(1);
    expect(onDeviceLost.mock.calls[0][0]).toMatchObject({
      modelId: "bonsai-1.7b",
      reason: "device-lost",
    });
    expect(seen).toHaveLength(1);
    expect(provider.getState()).toBe(PROVIDER_STATES.unavailable);
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(
      MODEL_STATES.downloaded
    );

    unsubscribe();
    await provider.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(runtime.createEngine).toHaveBeenCalledTimes(2);
    await provider.dispose();
  });

  it("recovers from a failed engine load instead of parking the model in error", async () => {
    const registry = await downloadedRegistry();
    const runtime = {
      createEngine: vi.fn(async () => {
        throw new Error("gpu exploded");
      }),
      createChat: vi.fn(async () => ({ send: vi.fn() })),
    };
    const provider = createBrowserBonsaiProvider({
      runtime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });

    await expect(
      provider.chat({
        model: "bonsai-1.7b",
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toThrow();
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(
      MODEL_STATES.downloaded
    );

    const { runtime: okRuntime } = makeRuntime({
      events: [{ type: "text", text: "hi" }, { type: "done" }],
    });
    const retry = createBrowserBonsaiProvider({
      runtime: okRuntime,
      registry,
      capabilityDetector: async () => makeCapability(),
    });
    await retry.chat({
      model: "bonsai-1.7b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(okRuntime.createEngine).toHaveBeenCalledTimes(1);
    await retry.dispose();
  });
});
