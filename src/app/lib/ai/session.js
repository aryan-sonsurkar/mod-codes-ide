import { AI_ERRORS, AiError, normalizeAiError } from "./errors";

function validateProvider(provider) {
  if (!provider || typeof provider.chat !== "function") {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      "AI session requires a provider with a chat method."
    );
  }
}

function toHistoryEntry(message) {
  const entry = { role: message.role, content: message.content ?? "" };
  if (message.tool_name) {
    entry.tool_name = message.tool_name;
  }
  if (Array.isArray(message.tool_calls)) {
    entry.tool_calls = message.tool_calls;
  }
  return entry;
}

function stringifyToolResult(result) {
  try {
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch {
    return String(result);
  }
}

const STREAM_STALL_TIMEOUT_MS = 60000;

function toAsyncIterator(stream) {
  if (!stream) {
    return null;
  }
  if (typeof stream[Symbol.asyncIterator] === "function") {
    return stream[Symbol.asyncIterator]();
  }
  if (typeof stream[Symbol.iterator] === "function") {
    return stream[Symbol.iterator]();
  }
  if (typeof stream.next === "function") {
    return stream;
  }
  return null;
}

/**
 * Awaiting the *next* chunk is the only place a stalled stream can be seen:
 * the previous check ran after a chunk arrived, so a provider that simply
 * stopped sending never triggered it. Races `iterator.next()` against a
 * deadline, aborts the request on expiry, and always clears the timer.
 */
async function nextWithStall(iterator, ms, onStall) {
  let timer = null;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(
        new AiError(
          AI_ERRORS.network,
          `Stream timed out — no data received for ${Math.round(ms / 1000)} seconds.`
        )
      );
    }, ms);
  });
  // The loser of the race must never surface as an unhandled rejection.
  timeout.catch(() => {});
  try {
    return await Promise.race([iterator.next(), timeout]);
  } finally {
    clearTimeout(timer);
    if (timedOut && typeof onStall === "function") {
      onStall();
    }
  }
}

async function streamRequest(provider, request, onDelta) {
  const stream = await provider.streamChat(request);
  const iterator = toAsyncIterator(stream);
  if (!iterator) {
    throw new AiError(
      AI_ERRORS.invalidRequest,
      "Provider returned a non-iterable stream."
    );
  }

  const onStall = () => {
    if (request && request.signal && typeof request.signal.abort === "function") {
      try {
        request.signal.abort();
      } catch {
        // the provider may already be torn down
      }
    }
    if (typeof iterator.return === "function") {
      try {
        iterator.return();
      } catch {
        // releasing a suspended generator is best effort
      }
    }
  };

  let text = "";
  const toolCalls = [];
  let stats = null;

  for (;;) {
    const next = await nextWithStall(iterator, STREAM_STALL_TIMEOUT_MS, onStall);
    if (next && next.done) {
      break;
    }
    const chunk = next ? next.value : null;
    if (chunk && chunk.type === "text" && typeof chunk.text === "string") {
      text += chunk.text;
      if (typeof onDelta === "function") {
        onDelta(text);
      }
    } else if (chunk && chunk.type === "tool" && chunk.toolRequest) {
      toolCalls.push({
        toolName: chunk.toolRequest.toolName,
        arguments: chunk.toolRequest.arguments ?? {},
      });
    } else if (chunk && chunk.type === "stats" && chunk.stats) {
      stats = { ...stats, ...chunk.stats };
    } else if (chunk && chunk.type === "error") {
      throw chunk.error;
    } else if (chunk && chunk.type === "done") {
      break;
    }
  }
  return { text, toolCalls, stats };
}

async function chatRequest(provider, request) {
  const result = await provider.chat(request);
  if (result && result.ok === true) {
    return {
      text: typeof result.text === "string" ? result.text : "",
      toolCalls: Array.isArray(result.toolCalls) ? result.toolCalls : [],
    };
  }
  if (result && result.ok === false && result.error) {
    throw result.error;
  }
  throw new AiError(
    AI_ERRORS.unavailable,
    "Provider returned an invalid response."
  );
}

export function createAiSession({ provider, model = null, systemPrompt = null } = {}) {
  validateProvider(provider);

  const messages = [];
  if (typeof systemPrompt === "string" && systemPrompt.length > 0) {
    messages.push({ role: "system", content: systemPrompt });
  }

  let selectedModel = typeof model === "string" && model.length > 0 ? model : null;
  let controller = null;
  let active = false;
  let generationPhase = "idle";

  function history() {
    return messages.map(toHistoryEntry);
  }

  function snapshot() {
    return {
      provider: provider.id,
      model: selectedModel,
      messages: history(),
      active,
      generationPhase,
    };
  }

  function addMessage(role, content) {
    if (typeof content !== "string" || content.length === 0) {
      throw new AiError(
        AI_ERRORS.invalidRequest,
        "Message content is required."
      );
    }
    const message = { role, content };
    messages.push(message);
    return message;
  }

  function setModel(next) {
    selectedModel = typeof next === "string" && next.length > 0 ? next : null;
  }

  async function sendMessage({
    content,
    context = null,
    options = {},
    onDelta = null,
    onTool = null,
    tools = [],
    toolRunner = null,
    maxToolRounds = 2,
  } = {}) {
    if (active) {
      throw new AiError(
        AI_ERRORS.invalidRequest,
        "A message is already in progress."
      );
    }
    if (!selectedModel) {
      throw new AiError(
        AI_ERRORS.invalidRequest,
        "Session has no model selected."
      );
    }

    addMessage("user", content);

    const toolList = Array.isArray(tools) ? tools : [];
    const maxRounds =
      typeof maxToolRounds === "number" && maxToolRounds >= 0
        ? Math.floor(maxToolRounds)
        : 2;

    const makeRequest = () => ({
      messages: history(),
      context: context || null,
      model: selectedModel,
      options: options || {},
      tools: toolList.length > 0 ? toolList : undefined,
    });

    controller = new AbortController();
    active = true;
    generationPhase = "thinking";

    let partial = "";
    const handleDelta = (text) => {
      partial = text;
      if (generationPhase !== "streaming") {
        generationPhase = "streaming";
      }
      if (typeof onDelta === "function") {
        onDelta(text);
      }
    };

    try {
      let rounds = 0;
      for (;;) {
        const request = makeRequest();
        request.signal = controller.signal;

        const { text, toolCalls, stats } =
          typeof provider.streamChat === "function"
            ? await streamRequest(provider, request, handleDelta)
            : await chatRequest(provider, request);

        if (toolCalls.length === 0) {
          const message = addMessage("assistant", text);
          generationPhase = "idle";
          return {
            ok: true,
            text,
            message,
            stats: stats && Object.keys(stats).length > 0 ? stats : null,
          };
        }

        rounds += 1;
        if (rounds > maxRounds) {
          const message = addMessage("assistant", text);
          generationPhase = "idle";
          return {
            ok: true,
            text,
            message,
            toolLimitReached: true,
            stats: stats && Object.keys(stats).length > 0 ? stats : null,
          };
        }

        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.map((call) => ({
            toolName: call.toolName,
            arguments: call.arguments ?? {},
          })),
        });

        const results = [];
        for (const call of toolCalls) {
          generationPhase = "tool-calling";
          let result;
          if (typeof toolRunner === "function") {
            try {
              result = await toolRunner({
                toolName: call.toolName,
                arguments: call.arguments ?? {},
              });
            } catch (error) {
              result = {
                ok: false,
                code: "executionFailed",
                error:
                  error && typeof error.message === "string"
                    ? error.message
                    : "Tool execution failed.",
              };
            }
          } else {
            result = {
              ok: false,
              code: "noToolRunner",
              error: "No tool runner is configured.",
            };
          }
          results.push(result);
          messages.push({
            role: "tool",
            content: stringifyToolResult(result),
            tool_name: call.toolName,
          });
        }

        if (typeof onTool === "function") {
          onTool({ toolCalls, results });
        }
      }
    } catch (error) {
      const normalized = normalizeAiError(error);
      if (normalized.code === AI_ERRORS.cancelled && partial.length > 0) {
        addMessage("assistant", partial);
      }
      generationPhase = "idle";
      throw normalized;
    } finally {
      active = false;
      controller = null;
    }
  }

  function stop() {
    if (controller) {
      controller.abort();
    }
    active = false;
    generationPhase = "idle";
  }

  function clear() {
    stop();
    messages.length = 0;
    if (typeof systemPrompt === "string" && systemPrompt.length > 0) {
      messages.push({ role: "system", content: systemPrompt });
    }
  }

  return {
    provider: provider.id,
    snapshot,
    history,
    addMessage,
    setModel,
    sendMessage,
    stop,
    clear,
    get generationPhase() { return generationPhase; },
  };
}