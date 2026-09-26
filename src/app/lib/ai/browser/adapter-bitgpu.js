/**
 * Production worker adapter implementing the bridge adapter contract with
 * bitgpu (https://github.com/stfurkan/bitgpu). Only loaded inside the Web
 * Worker; the imports are dynamic so the main thread never pays for the
 * runtime, and the server bundle never resolves it.
 */
import { installDeviceLostTracker } from "./webgpu";

export function createBitgpuAdapter() {
  let deviceLostPromise = null;

  async function loadEngineModule() {
    const [bitgpu, gguf] = await Promise.all([
      import("bitgpu"),
      import("bitgpu/gguf"),
    ]);
    return { bitgpu, gguf };
  }

  async function loadChatModule() {
    return import("bitgpu/chat");
  }

  /**
   * bitgpu creates its own GPU device internally and does not expose it, so
   * the lost promise is captured by instrumenting `navigator.gpu.requestDevice`
   * before the engine is built. Returns null when WebGPU is unavailable.
   */
  function trackDeviceLost() {
    if (deviceLostPromise) {
      return deviceLostPromise;
    }
    const gpu =
      typeof globalThis !== "undefined" &&
      globalThis.navigator &&
      globalThis.navigator.gpu;
    if (!gpu || typeof gpu.requestDevice !== "function") {
      return null;
    }
    const tracker = installDeviceLostTracker(gpu);
    deviceLostPromise = tracker.lost || null;
    return deviceLostPromise;
  }

  return {
    async createEngine({ files = [], manifestUrl = null, auxUrl = null, maxSeqLen = 4096, kvCache = "q8" }) {
      trackDeviceLost();
      const { bitgpu, gguf } = await loadEngineModule();
      const dataUrl = Array.isArray(files) && files.length > 0 ? files[0] : null;
      if (!dataUrl) {
        throw new Error("Model has no data file to load.");
      }
      if (manifestUrl && auxUrl) {
        const engine = await bitgpu.createEngine({
          manifestUrl,
          auxUrl,
          dataUrl,
          maxSeqLen,
          kvCache,
        });
        return engine;
      }
      const parsed = await gguf.fromGguf(dataUrl);
      const engine = await bitgpu.createEngine({
        manifest: parsed.manifest,
        aux: parsed.aux,
        dataUrl: parsed.dataUrl,
        maxSeqLen,
        kvCache,
      });
      return engine;
    },

    /**
     * Bridge hook: resolves with a reason when this worker's GPU device is
     * lost. A single tracked device covers every engine it created.
     */
    watchEngineLost() {
      return trackDeviceLost();
    },

    async createChat(engine, { tokenizerJsonUrl, tokenizerConfigUrl }) {
      const { createChat } = await loadChatModule();
      return createChat(engine, {
        tokenizerJsonUrl,
        tokenizerConfigUrl,
      });
    },

    async* chatSend(chat, messages, options) {
      const bitgpuMessages = (messages || []).map((message) => {
        const entry = { role: message.role, content: message.content ?? "" };
        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          entry.tool_calls = message.tool_calls.map((call) => ({
            name: call.toolName ?? call.name,
            arguments: call.arguments ?? {},
          }));
        }
        return entry;
      });

      const sendOptions = {};
      if (options && options.signal) {
        sendOptions.signal = options.signal;
      }
      if (options && options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        sendOptions.tools = options.tools;
      }
      if (options && typeof options.maxOutputTokens === "number") {
        sendOptions.maxTokens = options.maxOutputTokens;
      }
      if (options && typeof options.temperature === "number") {
        sendOptions.temperature = options.temperature;
      }

      const stream = chat.stream(bitgpuMessages, sendOptions);
      let next = await stream.next();
      while (!next.done) {
        yield { type: "text", text: next.value };
        next = await stream.next();
      }
      const result = next.value;
      const toolCalls = Array.isArray(result && result.toolCalls)
        ? result.toolCalls
        : [];
      for (const call of toolCalls) {
        if (call && typeof call.name === "string" && call.name.length > 0) {
          yield {
            type: "tool",
            toolCall: { name: call.name, arguments: call.arguments ?? {} },
          };
        }
      }
      yield {
        type: "done",
        usage: {
          tokensPerSecond:
            result && typeof result.tokensPerSecond === "number"
              ? result.tokensPerSecond
              : null,
          prefillMs:
            result && typeof result.prefillMs === "number" ? result.prefillMs : null,
          decodeMs:
            result && typeof result.decodeMs === "number" ? result.decodeMs : null,
          finishReason: result ? result.finishReason : null,
        },
      };
    },

    async saveCache(engine) {
      if (engine && typeof engine.saveCache === "function") {
        return engine.saveCache();
      }
      return null;
    },

    async restoreCache(engine, snapshot) {
      if (engine && typeof engine.restoreCache === "function" && snapshot) {
        await engine.restoreCache(snapshot);
      }
    },

    async disposeEngine(engine) {
      if (engine && typeof engine.dispose === "function") {
        engine.dispose();
      }
    },

    async disposeChat() {},
  };
}