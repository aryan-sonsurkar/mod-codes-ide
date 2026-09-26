import { describe, expect, it, vi } from "vitest";
import { createBridgeClient, createWorkerMessageHandler } from "./bridge";
import { createMemoryChatAdapter } from "./adapter-memory";

function createFakeWorker({ adapter }) {
  const listeners = new Set();
  const onMessage = createWorkerMessageHandler({ adapter, postMessage });

  function postMessage(message) {
    for (const listener of [...listeners]) {
      listener({ data: message });
    }
  }

  return {
    listeners,
    addEventListener(type, callback) {
      if (type === "message") {
        listeners.add(callback);
      }
    },
    removeEventListener(type, callback) {
      if (type === "message") {
        listeners.delete(callback);
      }
    },
    postMessage(message) {
      onMessage({ data: message });
    },
    terminate: vi.fn(),
  };
}

async function collect(iterable) {
  const out = [];
  for await (const value of iterable) {
    out.push(value);
  }
  return out;
}

describe("bridge protocol", () => {
  it("pings the worker", async () => {
    const worker = createFakeWorker({ adapter: createMemoryChatAdapter() });
    const client = createBridgeClient({ worker });
    await expect(client.request("ping")).resolves.toEqual({ pong: true, runtime: "bitgpu" });
    await client.dispose();
  });

  it("round-trips engine and chat creation", async () => {
    const worker = createFakeWorker({ adapter: createMemoryChatAdapter() });
    const client = createBridgeClient({ worker });

    const { engineId } = await client.request("engine.create", {
      files: ["https://example.com/weights.gguf"],
    });
    expect(engineId).toMatch(/^engine-/);

    const { chatId } = await client.request("chat.create", {
      engineId,
      tokenizerJsonUrl: "https://example.com/tokenizer.json",
    });
    expect(chatId).toMatch(/^chat-/);

    await client.request("chat.dispose", { chatId });
    await client.request("engine.dispose", { engineId });
    await client.dispose();
  });

  it("streams chat events to the caller", async () => {
    const worker = createFakeWorker({ adapter: createMemoryChatAdapter() });
    const client = createBridgeClient({ worker });

    const { engineId } = await client.request("engine.create", { files: ["u"] });
    const { chatId } = await client.request("chat.create", { engineId });

    const events = await collect(
      client.streamRequest(
        "chat.send",
        {
          chatId,
          messages: [{ role: "user", content: "hi" }],
          options: {},
        },
        {}
      )
    );

    expect(events.map((e) => e.type)).toEqual(["text", "done"]);
    expect(events[0].text).toContain("hi");
    await client.dispose();
  });

  it("propagates worker errors as rejected requests", async () => {
    const worker = createFakeWorker({ adapter: createMemoryChatAdapter() });
    const client = createBridgeClient({ worker });

    await expect(client.request("nope")).rejects.toThrow("Unknown method: nope");
    await expect(
      client.request("chat.create", { engineId: "missing" })
    ).rejects.toThrow("Unknown engine: missing");
    await client.dispose();
  });

  it("streams tool events and honors abort via cancel", async () => {
    const adapter = {
      ...createMemoryChatAdapter(),
      chatSend: async function* (_chat, messages, options) {
        if (options && options.signal && options.signal.aborted) {
          const error = new Error("aborted");
          error.name = "AbortError";
          throw error;
        }
        yield { type: "text", text: "Checking…" };
        yield { type: "tool", toolCall: { name: "ide.current-file", arguments: {} } };
        yield { type: "done", usage: null };
      },
    };
    const worker = createFakeWorker({ adapter });
    const client = createBridgeClient({ worker });

    const { engineId } = await client.request("engine.create", { files: ["u"] });
    const { chatId } = await client.request("chat.create", { engineId });

    const events = await collect(
      client.streamRequest(
        "chat.send",
        { chatId, messages: [], options: {} },
        {}
      )
    );
    expect(events.map((e) => e.type)).toEqual(["text", "tool", "done"]);
    expect(events[1].toolCall.name).toBe("ide.current-file");

    const controller = new AbortController();
    controller.abort();
    const aborted = await collect(
      client.streamRequest(
        "chat.send",
        { chatId, messages: [], options: {} },
        { signal: controller.signal }
      )
    );
    expect(aborted).toEqual([]);
    await client.dispose();
  });

  it("keeps streaming async even when requests are queued", async () => {
    const adapter = createMemoryChatAdapter();
    const worker = createFakeWorker({ adapter });
    const client = createBridgeClient({ worker });

    const { engineId } = await client.request("engine.create", { files: ["u"] });
    const { chatId } = await client.request("chat.create", { engineId });

    const stream = client.streamRequest(
      "chat.send",
      { chatId, messages: [{ role: "user", content: "one" }], options: {} },
      {}
    );
    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(first.value.type).toBe("text");
    const rest = await collect(stream);
    expect(rest.map((e) => e.type)).toEqual(["done"]);
    await client.dispose();
  });

  it("rejects pending requests on dispose", async () => {
    const deadWorker = {
      addEventListener: () => {},
      removeEventListener: () => {},
      postMessage: () => {},
      terminate: vi.fn(),
    };
    const client = createBridgeClient({ worker: deadWorker });
    const promise = client.request("ping");
    await client.dispose();
    await expect(promise).rejects.toThrow("disposed");
    expect(deadWorker.terminate).toHaveBeenCalled();
  });
});

function createSilentWorker({ onPost = () => {} } = {}) {
  const listeners = { message: new Set(), error: new Set(), messageerror: new Set() };
  return {
    listeners,
    addEventListener(type, callback) {
      if (listeners[type]) {
        listeners[type].add(callback);
      }
    },
    removeEventListener(type, callback) {
      if (listeners[type]) {
        listeners[type].delete(callback);
      }
    },
    postMessage(message) {
      onPost(message);
    },
    fire(type, event) {
      for (const callback of [...listeners[type]]) {
        callback(event);
      }
    },
    terminate: vi.fn(),
  };
}

describe("bridge failure handling", () => {
  it("rejects in-flight requests immediately when the worker errors", async () => {
    const worker = createSilentWorker();
    const client = createBridgeClient({ worker, timeoutMs: 60_000 });

    const promise = client.request("ping");
    worker.fire("error", { message: "boom" });

    await expect(promise).rejects.toThrow("boom");
    await client.dispose();
  });

  it("rejects in-flight requests when a message fails to deserialize", async () => {
    const worker = createSilentWorker();
    const client = createBridgeClient({ worker, timeoutMs: 60_000 });

    const promise = client.request("ping");
    worker.fire("messageerror", { message: "could not be cloned" });

    await expect(promise).rejects.toThrow("could not be cloned");
    await client.dispose();
  });

  it("rejects an in-flight stream when the worker errors", async () => {
    const worker = createSilentWorker();
    const client = createBridgeClient({
      worker,
      firstChunkTimeoutMs: 60_000,
      chunkTimeoutMs: 60_000,
    });

    const stream = client.streamRequest("chat.send", { chatId: "c" }, {});
    const pending = stream.next();
    worker.fire("error", { message: "worker crashed" });

    await expect(pending).rejects.toThrow("worker crashed");
    await client.dispose();
  });
});

describe("bridge stream timeouts", () => {
  it("fails a stream that never produces a first chunk", async () => {
    const worker = createSilentWorker();
    const client = createBridgeClient({
      worker,
      firstChunkTimeoutMs: 20,
      chunkTimeoutMs: 20,
    });

    const stream = client.streamRequest(
      "chat.send",
      { chatId: "c" },
      { firstChunkTimeout: 20, chunkTimeout: 20 }
    );

    await expect(stream.next()).rejects.toThrow(/timed out/i);
    await client.dispose();
  });

  it("fails a stream that stalls between chunks", async () => {
    let requestId = null;
    const worker = createSilentWorker({
      onPost: (message) => {
        if (message.type === "request") {
          requestId = message.id;
        }
      },
    });
    const client = createBridgeClient({
      worker,
      firstChunkTimeoutMs: 60_000,
      chunkTimeoutMs: 20,
    });

    const stream = client.streamRequest(
      "chat.send",
      { chatId: "c" },
      { firstChunkTimeout: 60_000, chunkTimeout: 20 }
    );

    worker.fire("message", {
      data: { type: "stream", id: requestId, event: { type: "text", text: "hi" } },
    });

    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(first.value.text).toBe("hi");

    await expect(stream.next()).rejects.toThrow(/stalled/i);
    await client.dispose();
  });

  it("clears the watchdog once the stream ends normally", async () => {
    let requestId = null;
    const worker = createSilentWorker({
      onPost: (message) => {
        if (message.type === "request") {
          requestId = message.id;
        }
      },
    });
    const client = createBridgeClient({
      worker,
      firstChunkTimeoutMs: 60_000,
      chunkTimeoutMs: 60_000,
    });

    const stream = client.streamRequest(
      "chat.send",
      { chatId: "c" },
      { firstChunkTimeout: 60_000, chunkTimeout: 60_000 }
    );

    worker.fire("message", {
      data: { type: "stream", id: requestId, event: { type: "text", text: "hi" } },
    });
    worker.fire("message", { data: { type: "stream-end", id: requestId, result: null } });

    const first = await stream.next();
    expect(first.value.text).toBe("hi");
    const last = await stream.next();
    expect(last.done).toBe(true);

    await client.dispose();
  });
});
