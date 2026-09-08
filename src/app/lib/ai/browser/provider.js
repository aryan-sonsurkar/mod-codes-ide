import { AI_ERRORS, AiError, normalizeAiError } from "../errors";
import { AiModel } from "../model";
import {
  createChatResult,
  doneChunk,
  errorChunk,
  statsChunk,
  textChunk,
  toolChunk,
} from "../response";
import { serializeToolsForOllama } from "../providers/ollama";
import { serializeContextItems } from "../context";
import { modelVersionKey } from "./catalog";
import { MODEL_STATES } from "./registry";
import {
  BONSAI_CAPABILITIES,
  BONSAI_PROVIDER_ID,
  BONSAI_PROVIDER_NAME,
  mapRuntimeError,
} from "./runtime";
import { describeCapability, detectWebGpuCapability, isWebGpuAvailable } from "./webgpu";
import { PROVIDER_STATES } from "../providerStates";

function toHistoryMessage(message) {
  const entry = { role: message.role, content: message.content ?? "" };
  if (message.tool_name) {
    entry.tool_name = message.tool_name;
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    entry.tool_calls = message.tool_calls.map((call) => ({
      toolName: call.toolName ?? call.name,
      arguments: call.arguments ?? {},
    }));
  }
  return entry;
}

function buildChatMessages(request) {
  const messages = [];
  const contextText = serializeContextItems(request.context);
  if (contextText) {
    messages.push({ role: "system", content: contextText });
  }
  for (const message of request.messages || []) {
    messages.push(toHistoryMessage(message));
  }
  return messages;
}

export function createBrowserBonsaiProvider({
  runtime = null,
  registry = null,
  capabilityDetector = detectWebGpuCapability,
  defaultModelId = "bonsai-1.7b",
} = {}) {
  const engines = new Map();
  let currentState = PROVIDER_STATES.unknown;

  function setState(next) {
    currentState = next;
  }

  function getState() {
    return currentState;
  }

  async function ensureRuntime() {
    if (!runtime) {
      throw new AiError(
        AI_ERRORS.unsupported,
        "The Bonsai runtime is not available (the Web Worker could not be started).",
        { retryable: false }
      );
    }
    return runtime;
  }

  async function getCapability() {
    return capabilityDetector();
  }

  function getCapabilities() {
    return {
      id: BONSAI_PROVIDER_ID,
      name: BONSAI_PROVIDER_NAME,
      capabilities: [...BONSAI_CAPABILITIES],
      details: {
        defaultModelId,
      },
    };
  }

  function toModel(model, { state = null, compatibility = null } = {}) {
    return new AiModel({
      id: model.id,
      name: model.displayName,
      provider: BONSAI_PROVIDER_ID,
      capabilities: [...BONSAI_CAPABILITIES],
      contextLength: model.contextLength,
      metadata: {
        downloadBytes: model.downloadBytes,
        defaultContext: model.defaultContext,
        contextLength: model.contextLength,
        architecture: model.architecture,
        source: model.source,
        files: model.files,
        requiredLimits: model.requiredLimits,
        runtimePolicy: model.runtimePolicy,
        chatTemplate: model.chatTemplate,
        versionKey: modelVersionKey(model),
        state,
        compatible: compatibility ? compatibility.compatible : null,
        compatibilityReason: compatibility ? compatibility.reason : null,
      },
    });
  }

  async function getModels() {
    const capability = await getCapability();
    if (!registry) {
      return [];
    }
    const models = await registry.list();
    return models.map(({ model, state, compatibility }) =>
      toModel(model, { state, compatibility })
    );
  }

  async function getModelInfo(id) {
    const modelId = typeof id === "string" && id.length > 0 ? id : defaultModelId;
    if (!registry) {
      return { model: null, state: null, compatibility: null };
    }
    return registry.getModel(modelId);
  }

  async function assertModelReady(modelId) {
    const info = await getModelInfo(modelId);
    if (!info || !info.model) {
      throw new AiError(
        AI_ERRORS.modelNotFound,
        `Model "${modelId}" is not available in this browser.`,
        { retryable: false }
      );
    }
    if (!info.compatibility.compatible) {
      throw new AiError(AI_ERRORS.unsupported, info.compatibility.message, {
        retryable: false,
      });
    }
    if (
      info.state !== MODEL_STATES.downloaded &&
      info.state !== MODEL_STATES.ready
    ) {
      throw new AiError(
        AI_ERRORS.notReady,
        `The model "${modelId}" is not downloaded yet. Download it first.`,
        { retryable: true }
      );
    }
    return info;
  }

  async function loadModel(modelId) {
    const info = await assertModelReady(modelId);
    if (engines.has(modelId)) {
      return engines.get(modelId);
    }
    const rt = await ensureRuntime();
    if (typeof registry.markLoading === "function") {
      registry.markLoading(modelId);
    }
    setState(PROVIDER_STATES.busy);
    try {
      const model = info.model;
      const engine = await rt.createEngine({
        files: model.files.map((file) => file.url),
        manifestUrl: null,
        auxUrl: null,
      });
      const chat = await rt.createChat(engine, {
        tokenizerJsonUrl: model.tokenizer.tokenizerJsonUrl,
        tokenizerConfigUrl: model.tokenizer.tokenizerConfigUrl,
      });
      const entry = { engine, chat, model, modelId };
      engines.set(modelId, entry);
      if (typeof registry.markReady === "function") {
        registry.markReady(modelId);
      }
      setState(PROVIDER_STATES.ready);
      return entry;
    } catch (error) {
      if (typeof registry.fail === "function") {
        registry.fail(modelId, error);
      }
      setState(PROVIDER_STATES.unavailable);
      throw mapRuntimeError(error);
    }
  }

  async function* streamChat(request) {
    const modelId =
      typeof request.model === "string" && request.model.length > 0
        ? request.model
        : defaultModelId;
    try {
      const entry = await loadModel(modelId);
      const messages = buildChatMessages(request);
      const tools = serializeToolsForOllama(request.tools);
      const events = entry.chat.send(messages, {
        signal: request.signal || null,
        tools: tools.length > 0 ? tools : null,
        maxOutputTokens: request.options?.maxOutputTokens ?? null,
        temperature: request.options?.temperature ?? null,
      });
      for await (const event of events) {
        if (event && event.type === "text") {
          yield textChunk(event.text);
        } else if (event && event.type === "tool") {
          yield toolChunk({
            toolName: event.toolCall.name,
            arguments: event.toolCall.arguments ?? {},
          });
        } else if (event && event.type === "done" && event.usage) {
          yield statsChunk({
            tokensPerSecond: event.usage.tokensPerSecond ?? null,
            prefillMs: event.usage.prefillMs ?? null,
            decodeMs: event.usage.decodeMs ?? null,
            finishReason: event.usage.finishReason ?? null,
          });
        } else if (event && event.type === "error") {
          throw event.error;
        }
      }
      yield doneChunk();
    } catch (error) {
      const cancelled = Boolean(request.signal && request.signal.aborted);
      yield errorChunk(mapRuntimeError(error, { cancelled }));
    }
  }

  async function chat(request) {
    let text = "";
    const toolCalls = [];
    for await (const chunk of streamChat(request)) {
      if (chunk.type === "text") {
        text += chunk.text;
      } else if (chunk.type === "tool") {
        toolCalls.push({
          toolName: chunk.toolRequest.toolName,
          arguments: chunk.toolRequest.arguments ?? {},
        });
      } else if (chunk.type === "error") {
        throw chunk.error;
      }
    }
    const result = createChatResult({ text });
    return toolCalls.length > 0 ? { ...result, toolCalls } : result;
  }

  async function testConnection() {
    setState(PROVIDER_STATES.checking);
    try {
      const capability = await getCapability();
      if (isWebGpuAvailable(capability)) {
        setState(PROVIDER_STATES.ready);
        return {
          ok: true,
          message: describeCapability(capability),
          capability,
        };
      }
      setState(PROVIDER_STATES.unsupported);
      return {
        ok: false,
        error: new AiError(
          AI_ERRORS.unsupported,
          describeCapability(capability),
          { retryable: false }
        ),
        capability,
      };
    } catch (error) {
      setState(PROVIDER_STATES.unavailable);
      return { ok: false, error: normalizeAiError(error, AI_ERRORS.unsupported) };
    }
  }

  async function dispose() {
    for (const { engine } of engines.values()) {
      try {
        if (engine && typeof engine.dispose === "function") {
          await engine.dispose();
        }
      } catch {
        // ignore disposal errors
      }
    }
    engines.clear();
    setState(PROVIDER_STATES.unknown);
  }

  async function unloadModel(modelId) {
    const id = typeof modelId === "string" && modelId.length > 0 ? modelId : defaultModelId;
    if (!engines.has(id)) {
      return { unloaded: false };
    }
    if (typeof registry.markUnloading === "function") {
      registry.markUnloading(id);
    }
    const entry = engines.get(id);
    engines.delete(id);
    try {
      if (entry && entry.engine && typeof entry.engine.dispose === "function") {
        await entry.engine.dispose();
      }
    } catch {
      // ignore disposal errors
    }
    if (typeof registry.finishDownload === "function") {
      await registry.finishDownload(id);
    }
    return { unloaded: true };
  }

  return {
    id: BONSAI_PROVIDER_ID,
    name: BONSAI_PROVIDER_NAME,
    getCapabilities,
    getState,
    getModels,
    getModelInfo,
    chat,
    streamChat,
    testConnection,
    dispose,
    unloadModel,
  };
}