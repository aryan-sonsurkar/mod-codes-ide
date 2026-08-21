import { AI_ERRORS, AiError } from "../errors";
import { AiModel } from "../model";
import { createChatResult, doneChunk, errorChunk, statsChunk, textChunk } from "../response";
import { registerProvider } from "../registry";

export const MODCODES_CODER_PROVIDER_ID = "modcodes-coder";
export const MODCODES_CODER_PROVIDER_NAME = "MODCODES-CODER";
export const MODCODES_CODER_VERSION = "0.1.0-dev";
export const MODCODES_CODER_CAPABILITIES = ["chat", "streaming", "local", "cancellation", "statistics", "structuredOutput"];

const MODEL = new AiModel({
  id: "modcodes-coder:dev",
  name: "MODCODES-CODER (dev)",
  provider: MODCODES_CODER_PROVIDER_ID,
  capabilities: [...MODCODES_CODER_CAPABILITIES],
  contextLength: 8192,
  metadata: {
    version: MODCODES_CODER_VERSION,
    local: true,
    status: "development",
  },
});

function isAbortSignal(signal) {
  return Boolean(signal && typeof signal.addEventListener === "function");
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (isAbortSignal(signal)) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false }));
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false }));
        },
        { once: true }
      );
    }
  });
}

export function createModcodesCoderProvider(options = {}) {
  const model = options.model || MODEL;
  const latencyMs = Number.isFinite(options.latencyMs) ? options.latencyMs : 12;

  function getCapabilities() {
    return {
      id: MODCODES_CODER_PROVIDER_ID,
      name: MODCODES_CODER_PROVIDER_NAME,
      capabilities: [...MODCODES_CODER_CAPABILITIES],
      details: { version: MODCODES_CODER_VERSION, local: true, modelId: model.id },
    };
  }

  async function getModels() {
    return [model];
  }

  async function testConnection() {
    return { ok: true, message: `MODCODES-CODER ${MODCODES_CODER_VERSION} — development provider is active.` };
  }

  async function chat(request) {
    if (request && request.signal && request.signal.aborted) {
      throw new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false });
    }
    await sleep(latencyMs, request && request.signal);
    if (request && request.signal && request.signal.aborted) {
      throw new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false });
    }
    return createChatResult({ text: "MODCODES-CODER development provider is active." });
  }

  async function* streamChat(request) {
    const signal = request && request.signal;
    try {
      if (signal && signal.aborted) {
        yield errorChunk(new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false }));
        return;
      }
      const chunks = ["MODCODES-CODER ", "development ", "provider ", "is ", "active."];
      for (const part of chunks) {
        await sleep(latencyMs, signal);
        if (signal && signal.aborted) {
          yield errorChunk(new AiError(AI_ERRORS.cancelled, "Generation stopped.", { retryable: false }));
          return;
        }
        yield textChunk(part);
      }
      yield statsChunk({ tokensPerSecond: 200, outputTokens: 5, durationMs: chunks.length * latencyMs, finishReason: "stop" });
      yield doneChunk();
    } catch (error) {
      if (error && error.code === AI_ERRORS.cancelled) {
        yield errorChunk(error);
        return;
      }
      yield errorChunk(error);
    }
  }

  return {
    id: MODCODES_CODER_PROVIDER_ID,
    name: MODCODES_CODER_PROVIDER_NAME,
    getCapabilities,
    getModels,
    testConnection,
    chat,
    streamChat,
  };
}

export function registerModcodesCoderProvider(options = {}) {
  return registerProvider(createModcodesCoderProvider(options));
}
