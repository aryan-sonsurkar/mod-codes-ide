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