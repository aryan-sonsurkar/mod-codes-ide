export const BRIDGE_TYPES = {
  request: "request",
  response: "response",
  stream: "stream",
  streamEnd: "stream-end",
  cancel: "cancel",
};

let nextId = 0;

function nextMessageId() {
  nextId += 1;
  return `m${nextId}`;
}

export function bridgeErrorToError(bridgeError) {
  if (!bridgeError) {
    return new Error("Unknown worker error.");
  }
  const error = new Error(
    typeof bridgeError.message === "string" ? bridgeError.message : "Worker error."
  );
  error.name =
    typeof bridgeError.name === "string" && bridgeError.name.length > 0
      ? bridgeError.name
      : "Error";
  return error;
}

/**
 * RPC + streaming client over a single Web Worker postMessage channel.
 *
 * Protocol (client -> worker):
 *   { type: "request", id, method, params }
 *   { type: "cancel", id }
 * Protocol (worker -> client):
 *   { type: "response", id, ok: true, result }
 *   { type: "response", id, ok: false, error: { name, message } }
 *   { type: "stream", id, event }        // zero or more, for stream methods
 *   { type: "stream-end", id, result }   // terminal event for stream methods
 *
 * `worker` must provide addEventListener("message") and postMessage(message).
 */
export function createBridgeClient({ worker, timeoutMs = 120_000 } = {}) {
  const pending = new Map();
  const streams = new Map();
  let disposed = false;

  function handleMessage(event) {
    const message = event && event.data;
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === BRIDGE_TYPES.response) {
      const entry = pending.get(message.id);
      if (!entry) {
        return;
      }
      pending.delete(message.id);
      if (message.ok) {
        entry.resolve(message.result);
      } else {
        entry.reject(bridgeErrorToError(message.error));
      }
    } else if (message.type === BRIDGE_TYPES.stream) {
      const stream = streams.get(message.id);
      if (stream) {
        stream.onEvent(message.event);
      }
    } else if (message.type === BRIDGE_TYPES.streamEnd) {
      const stream = streams.get(message.id);
      if (stream) {
        streams.delete(message.id);
        stream.onEnd(message.result);
      }
    }
  }

  if (worker && typeof worker.addEventListener === "function") {
    worker.addEventListener("message", handleMessage);
  }

  function post(message) {
    if (disposed) {
      throw new Error("The bridge client is disposed.");
    }
    if (!worker || typeof worker.postMessage !== "function") {
      throw new Error("No worker is connected.");
    }
    worker.postMessage(message);
  }

  function request(method, params) {
    const id = nextMessageId();
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              pending.delete(id);
              reject(new Error(`${method} timed out.`));
            }, timeoutMs)
          : null;
      pending.set(id, {
        resolve: (value) => {
          if (timer) {
            clearTimeout(timer);
          }
          resolve(value);
        },
        reject: (error) => {
          if (timer) {
            clearTimeout(timer);
          }
          reject(error);
        },
      });
      post({ type: BRIDGE_TYPES.request, id, method, params });
    });
  }

  function streamRequest(method, params, { signal = null } = {}) {
    const id = nextMessageId();
    const queue = [];
    let ended = false;
    let endResult = null;
    const waiters = [];

    const notify = () => {
      for (const waiter of waiters.splice(0)) {
        waiter();
      }
    };

    streams.set(id, {
      onEvent: (event) => {
        if (!ended) {
          queue.push(event);
          notify();
        }
      },
      onEnd: (result) => {
        if (!ended) {
          ended = true;
          endResult = result;
          notify();
        }
      },
    });

    if (signal) {
      const onAbort = () => {
        streams.delete(id);
        if (worker && typeof worker.postMessage === "function") {
          try {
            worker.postMessage({ type: BRIDGE_TYPES.cancel, id });
          } catch {
            // worker may already be gone
          }
        }
        if (!ended) {
          ended = true;
          notify();
        }
      };
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    post({ type: BRIDGE_TYPES.request, id, method, params });

    const iterator = {
      next() {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift(), done: false });
        }
        if (ended) {
          return Promise.resolve({ value: endResult, done: true });
        }
        return new Promise((resolve) => {
          waiters.push(() => {
            if (queue.length > 0) {
              resolve({ value: queue.shift(), done: false });
            } else {
              resolve({ value: endResult, done: true });
            }
          });
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    return iterator;
  }

  return {
    request,
    streamRequest,
    async dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const entry of pending.values()) {
        entry.reject(new Error("The bridge client was disposed."));
      }
      pending.clear();
      streams.clear();
      if (worker && typeof worker.removeEventListener === "function") {
        worker.removeEventListener("message", handleMessage);
      }
      if (worker && typeof worker.terminate === "function") {
        worker.terminate();
      }
    },
  };
}

/**
 * Pure message dispatcher for the worker side. `adapter` implements:
 *   createEngine(params) -> Promise<Engine>
 *   createChat(engine, params) -> Promise<Chat>
 *   chatSend(chat, messages, options) -> AsyncIterable<ChatEvent>
 *   saveCache(engine) -> Promise<snapshot>
 *   restoreCache(engine, snapshot) -> Promise<void>
 *   disposeEngine(engine) -> void | Promise<void>
 *   disposeChat(chat) -> void | Promise<void>
 */
export function createWorkerMessageHandler({ adapter, postMessage }) {
  const engines = new Map();
  const chats = new Map();
  const activeSends = new Map();

  async function handle(method, params) {
    switch (method) {
      case "ping":
        return { pong: true, runtime: "bitgpu" };
      case "webgpu-available":
        return { available: typeof globalThis.navigator !== "undefined" && Boolean(globalThis.navigator.gpu) };
      case "engine.create": {
        const engine = await adapter.createEngine(params);
        const engineId = params.engineId || `engine-${engines.size + 1}`;
        engines.set(engineId, engine);
        return { engineId };
      }
      case "chat.create": {
        const engine = engines.get(params.engineId);
        if (!engine) {
          throw new Error(`Unknown engine: ${params.engineId}`);
        }
        const chat = await adapter.createChat(engine, params);
        const chatId = params.chatId || `chat-${chats.size + 1}`;
        chats.set(chatId, chat);
        return { chatId };
      }
      case "engine.save": {
        const engine = engines.get(params.engineId);
        if (!engine) {
          throw new Error(`Unknown engine: ${params.engineId}`);
        }
        return { snapshot: await adapter.saveCache(engine) };
      }
      case "engine.restore": {
        const engine = engines.get(params.engineId);
        if (!engine) {
          throw new Error(`Unknown engine: ${params.engineId}`);
        }
        await adapter.restoreCache(engine, params.snapshot);
        return { ok: true };
      }
      case "engine.dispose": {
        const engine = engines.get(params.engineId);
        if (engine) {
          engines.delete(params.engineId);
          await adapter.disposeEngine(engine);
        }
        return { ok: true };
      }
      case "chat.dispose": {
        const chat = chats.get(params.chatId);
        if (chat) {
          chats.delete(params.chatId);
          await adapter.disposeChat(chat);
        }
        return { ok: true };
      }
      case "dispose": {
        for (const chat of chats.values()) {
          await adapter.disposeChat(chat);
        }
        chats.clear();
        for (const engine of engines.values()) {
          await adapter.disposeEngine(engine);
        }
        engines.clear();
        return { ok: true };
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  function onMessage(event) {
    const message = event && event.data;
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === BRIDGE_TYPES.cancel) {
      const controller = activeSends.get(message.id);
      if (controller) {
        controller.abort();
      }
      return;
    }
    if (message.type !== BRIDGE_TYPES.request) {
      return;
    }

    const { id, method, params } = message;

    if (method === "chat.send") {
      const chat = chats.get(params.chatId);
      if (!chat) {
        postMessage({
          type: BRIDGE_TYPES.response,
          id,
          ok: false,
          error: { name: "Error", message: `Unknown chat: ${params.chatId}` },
        });
        return;
      }
      const controller = new AbortController();
      activeSends.set(id, controller);
      (async () => {
        try {
          const options = { ...(params.options || {}), signal: controller.signal };
          const events = adapter.chatSend(chat, params.messages, options);
          for await (const event of events) {
            postMessage({ type: BRIDGE_TYPES.stream, id, event });
          }
        } catch (error) {
          postMessage({
            type: BRIDGE_TYPES.stream,
            id,
            event: {
              type: "error",
              error: {
                name: error && error.name ? error.name : "Error",
                message: error && error.message ? error.message : String(error),
              },
            },
          });
        } finally {
          activeSends.delete(id);
          postMessage({ type: BRIDGE_TYPES.streamEnd, id, result: null });
        }
      })();
      return;
    }

    (async () => {
      try {
        const result = await handle(method, params);
        postMessage({ type: BRIDGE_TYPES.response, id, ok: true, result });
      } catch (error) {
        postMessage({
          type: BRIDGE_TYPES.response,
          id,
          ok: false,
          error: {
            name: error && error.name ? error.name : "Error",
            message: error && error.message ? error.message : String(error),
          },
        });
      }
    })();
  }

  return onMessage;
}