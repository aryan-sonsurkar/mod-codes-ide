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
import { parseJsonLines } from "../streaming";
import { registerProvider } from "../registry";
import { serializeContextItems } from "../context";

export const OLLAMA_PROVIDER_ID = "ollama";
export const OLLAMA_PROVIDER_NAME = "Ollama";
export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";
export const OLLAMA_CAPABILITIES = ["chat", "streaming", "cancellation", "local", "statistics"];
export const OLLAMA_REQUEST_TIMEOUT_MS = 60_000;

export const OLLAMA_OPTION_KEYS = [
  "temperature",
  "top_p",
  "top_k",
  "min_p",
  "typical_p",
  "repeat_penalty",
  "presence_penalty",
  "frequency_penalty",
  "repeat_last_n",
  "num_predict",
  "num_ctx",
  "seed",
  "stop",
];

export function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return OLLAMA_DEFAULT_BASE_URL;
  }
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  let parsed = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      `Invalid Ollama base URL: ${baseUrl}`
    );
  }
  return trimmed;
}

export function parseModelTag(name) {
  if (typeof name !== "string" || name.length === 0) {
    return { model: null, tag: null };
  }
  const slash = name.indexOf("/");
  const base = slash === -1 ? name : name.slice(slash + 1);
  const at = base.lastIndexOf(":");
  if (at <= 0 || at === base.length - 1) {
    return { model: base, tag: null };
  }
  return { model: base.slice(0, at), tag: base.slice(at + 1) };
}

export function mapOptions(options = {}) {
  const mapped = {};
  for (const key of OLLAMA_OPTION_KEYS) {
    if (options[key] !== undefined && options[key] !== null) {
      mapped[key] = options[key];
    }
  }
  return mapped;
}

export function serializeToolsForOllama(tools) {
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools
    .filter(
      (tool) =>
        tool &&
        typeof tool.id === "string" &&
        tool.id.length > 0 &&
        typeof tool.name === "string"
    )
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.id,
        description: tool.description || "",
        parameters: tool.parameters || { type: "object", properties: {} },
      },
    }));
}

export function parseToolArguments(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw !== "string" || raw.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function toolCallsFromMessage(message) {
  const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
  return calls
    .filter((call) => call && call.function && typeof call.function.name === "string")
    .map((call) => ({
      toolName: call.function.name,
      arguments: parseToolArguments(call.function.arguments),
    }));
}

export function toModel(entry, { contextLength = null } = {}) {
  const name = entry && (entry.name || entry.model);
  if (typeof name !== "string" || name.length === 0) {
    return null;
  }
  const details = entry.details || {};
  const { model, tag } = parseModelTag(name);
  const label = tag ? `${model}:${tag}` : model;
  return new AiModel({
    id: name,
    name: label,
    provider: OLLAMA_PROVIDER_ID,
    capabilities: [...OLLAMA_CAPABILITIES],
    contextLength:
      Number.isFinite(contextLength) && contextLength > 0 ? contextLength : null,
    metadata: {
      tag: tag || "latest",
      size: typeof entry.size === "number" ? entry.size : null,
      digest: typeof entry.digest === "string" ? entry.digest : null,
      parameterSize:
        typeof details.parameter_size === "string" ? details.parameter_size : null,
      quantizationLevel:
        typeof details.quantization_level === "string"
          ? details.quantization_level
          : null,
      family: typeof details.family === "string" ? details.family : null,
      contextLength:
        Number.isFinite(contextLength) && contextLength > 0 ? contextLength : null,
    },
  });
}

export function ollamaStatusError(status, payload) {
  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : `Ollama request failed with status ${status}.`;

  switch (status) {
    case 400:
      return new AiError(AI_ERRORS.invalidRequest, message, { retryable: false });
    case 404:
      return new AiError(AI_ERRORS.modelNotFound, message, { retryable: false });
    case 408:
    case 504:
      return new AiError(AI_ERRORS.timeout, message, { retryable: true });
    case 429:
      return new AiError(AI_ERRORS.rateLimited, message, { retryable: true });
    default:
      return new AiError(AI_ERRORS.unavailable, message, {
        retryable: status >= 500,
      });
  }
}

export function connectionError(baseUrl) {
  return new AiError(
    AI_ERRORS.connectionFailed,
    `Ollama is not reachable at ${baseUrl}. Make sure Ollama is running.`,
    { retryable: true }
  );
}

function isAbortError(error) {
  return Boolean(
    error &&
      (error.name === "AbortError" ||
        error.name === "TimeoutError" ||
        error.name === "DOMException")
  );
}

function combineSignals(...signals) {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) {
      continue;
    }
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller;
    }
    signal.addEventListener(
      "abort",
      () => controller.abort(signal.reason),
      { once: true }
    );
  }
  return controller;
}

async function fetchJson(baseUrl, path, options = {}) {
  const { method = "GET", body = null, timeoutMs = OLLAMA_REQUEST_TIMEOUT_MS, signal = null } = options;

  const controller = new AbortController();
  const timer =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const combined = combineSignals(signal, controller.signal);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: combined.signal,
    });
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
    }
    if (isAbortError(error)) {
      if (signal && signal.aborted) {
        throw new AiError(AI_ERRORS.cancelled, "Request cancelled.", {
          retryable: false,
          cause: error,
        });
      }
      throw new AiError(
        AI_ERRORS.timeout,
        `Ollama request timed out after ${timeoutMs}ms.`,
        { retryable: true, cause: error }
      );
    }
    throw connectionError(baseUrl);
  }
  if (timer) {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw ollamaStatusError(response.status, payload);
  }
  return payload;
}

function buildChatBody(request, { stream = true } = {}) {
  const messages = [];
  const contextText = serializeContextItems(request.context);
  if (contextText) {
    messages.push({ role: "system", content: contextText });
  }
  for (const message of request.messages || []) {
    const entry = { role: message.role, content: message.content ?? "" };
    if (message.tool_name) {
      entry.tool_name = message.tool_name;
    }
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      entry.tool_calls = message.tool_calls.map((call) => ({
        function: {
          name: call.toolName ?? call.name,
          arguments: call.arguments ?? {},
        },
      }));
    }
    messages.push(entry);
  }

  const body = { model: request.model, messages, stream };
  const options = mapOptions(request.options);
  if (Object.keys(options).length > 0) {
    body.options = options;
  }
  const tools = serializeToolsForOllama(request.tools);
  if (tools.length > 0) {
    body.tools = tools;
  }
  return body;
}

export function ollamaStreamStats(line) {
  if (!line || typeof line !== "object") {
    return null;
  }
  const evalCount =
    typeof line.eval_count === "number" && Number.isFinite(line.eval_count)
      ? line.eval_count
      : null;
  const evalDurationMs =
    typeof line.eval_duration === "number" && Number.isFinite(line.eval_duration)
      ? line.eval_duration / 1_000_000
      : null;
  const totalDurationMs =
    typeof line.total_duration === "number" && Number.isFinite(line.total_duration)
      ? line.total_duration / 1_000_000
      : null;
  if (evalCount == null) {
    return null;
  }
  return {
    tokensPerSecond:
      evalCount != null && evalDurationMs != null && evalDurationMs > 0
        ? evalCount / (evalDurationMs / 1000)
        : null,
    outputTokens: evalCount,
    decodeMs: evalDurationMs,
    durationMs: totalDurationMs,
    finishReason: typeof line.done_reason === "string" ? line.done_reason : null,
  };
}

async function* ollamaStream(baseUrl, request, timeoutMs) {
  const controller = new AbortController();
  const timer =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const signal = combineSignals(request.signal, controller.signal);

  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildChatBody(request, { stream: true })),
      signal,
    });
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
    }
    if (isAbortError(error)) {
      const external = Boolean(request.signal && request.signal.aborted);
      yield errorChunk(
        new AiError(
          external ? AI_ERRORS.cancelled : AI_ERRORS.timeout,
          external ? "Generation stopped." : "Ollama stream timed out.",
          { retryable: !external, cause: error }
        )
      );
      return;
    }
    yield errorChunk(connectionError(baseUrl));
    return;
  }
  if (timer) {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    yield errorChunk(ollamaStatusError(response.status, payload));
    return;
  }

  for await (const line of parseJsonLines(response)) {
    if (!line || typeof line !== "object") {
      continue;
    }
    const content = line.message && line.message.content;
    if (typeof content === "string" && content.length > 0) {
      yield textChunk(content);
    }
    const toolCalls = toolCallsFromMessage(line.message);
    for (const call of toolCalls) {
      yield toolChunk({ toolName: call.toolName, arguments: call.arguments });
    }
    if (line.done) {
      const stats = ollamaStreamStats(line);
      if (stats) {
        yield statsChunk(stats);
      }
      yield doneChunk();
      return;
    }
  }
  yield doneChunk();
}

export function createOllamaProvider(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeoutMs =
    options.timeoutMs !== undefined && options.timeoutMs !== null
      ? options.timeoutMs
      : OLLAMA_REQUEST_TIMEOUT_MS;
  const contextLength =
    Number.isFinite(options.contextLength) && options.contextLength > 0
      ? options.contextLength
      : null;

  async function getModels() {
    const payload = await fetchJson(baseUrl, "/api/tags", {
      method: "GET",
      timeoutMs,
    });
    const entries = Array.isArray(payload && payload.models)
      ? payload.models
      : [];
    return entries.map((entry) => toModel(entry, { contextLength })).filter(Boolean);
  }

  function getCapabilities() {
    return {
      id: OLLAMA_PROVIDER_ID,
      name: OLLAMA_PROVIDER_NAME,
      capabilities: [...OLLAMA_CAPABILITIES],
      details: { baseUrl },
    };
  }

  async function testConnection() {
    try {
      const payload = await fetchJson(baseUrl, "/api/version", {
        method: "GET",
        timeoutMs,
      });
      return {
        ok: true,
        version: typeof payload.version === "string" ? payload.version : null,
      };
    } catch (error) {
      return { ok: false, error: normalizeAiError(error) };
    }
  }

  async function chat(request) {
    const payload = await fetchJson(baseUrl, "/api/chat", {
      method: "POST",
      body: buildChatBody(request, { stream: false }),
      timeoutMs,
      signal: request.signal,
    });
    const content = payload && payload.message && payload.message.content;
    const result = createChatResult({
      text: typeof content === "string" ? content : "",
    });
    const toolCalls = toolCallsFromMessage(payload && payload.message);
    if (toolCalls.length > 0) {
      return { ...result, toolCalls };
    }
    if (typeof content !== "string") {
      throw new AiError(AI_ERRORS.unavailable, "Ollama returned an unexpected response.", {
        retryable: true,
      });
    }
    return result;
  }

  async function streamChat(request) {
    return ollamaStream(baseUrl, request, timeoutMs);
  }

  return {
    id: OLLAMA_PROVIDER_ID,
    name: OLLAMA_PROVIDER_NAME,
    getCapabilities,
    getModels,
    chat,
    streamChat,
    testConnection,
  };
}

export function registerOllamaProvider(options = {}) {
  return registerProvider(createOllamaProvider(options));
}