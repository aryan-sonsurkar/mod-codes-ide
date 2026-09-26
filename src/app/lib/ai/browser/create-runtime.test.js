import { describe, expect, it, vi } from "vitest";
import { createBrowserRuntime } from "./create-runtime";
import { BRIDGE_TYPES, createWorkerMessageHandler } from "./bridge";
import { createMemoryChatAdapter } from "./adapter-memory";

function createFakeWorker({ adapter = createMemoryChatAdapter() } = {}) {
  const messageListeners = new Set();
  const errorListeners = new Set();
  const posted = [];

  const onMessage = createWorkerMessageHandler({
    adapter,
    postMessage: (message) => {
      for (const listener of [...messageListeners]) {
        listener({ data: message });
      }
    },
  });

  return {
    posted,
    addEventListener(type, callback) {
      if (type === "message") {
        messageListeners.add(callback);
      } else if (type === "error" || type === "messageerror") {
        errorListeners.add(callback);
      }
    },
    removeEventListener(type, callback) {
      if (type === "message") {
        messageListeners.delete(callback);
      } else {
        errorListeners.delete(callback);
      }
    },
    postMessage(message) {
      posted.push(message);
      onMessage({ data: message });
    },
    emitWorkerMessage(message) {
      for (const listener of [...messageListeners]) {
        listener({ data: message });
      }
    },
    terminate: vi.fn(),
  };
}

describe("createBrowserRuntime", () => {
  it("assigns the engine id on the client and echoes it back", async () => {
    const worker = createFakeWorker();
    const runtime = createBrowserRuntime({ worker });

    const first = await runtime.createEngine({ files: ["u"] });
    const second = await runtime.createEngine({ files: ["u"] });

    expect(first.engineId).toBe("engine-1");
    expect(second.engineId).toBe("engine-2");
    expect(worker.posted[0]).toMatchObject({
      type: BRIDGE_TYPES.request,
      method: "engine.create",
      params: { engineId: "engine-1" },
    });

    await runtime.dispose();
  });

  it("exposes a lost promise that resolves from the engine-lost event", async () => {
    const worker = createFakeWorker();
    const runtime = createBrowserRuntime({ worker });

    const engine = await runtime.createEngine({ files: ["u"] });
    expect(engine.lost).toBeInstanceOf(Promise);

    worker.emitWorkerMessage({
      type: BRIDGE_TYPES.event,
      name: "engine-lost",
      payload: { engineId: engine.engineId, reason: "device-lost" },
    });

    await expect(engine.lost).resolves.toBe("device-lost");
    await runtime.dispose();
  });

  it("routes loss to the matching engine only", async () => {
    const worker = createFakeWorker();
    const runtime = createBrowserRuntime({ worker });

    const a = await runtime.createEngine({ files: ["u"] });
    const b = await runtime.createEngine({ files: ["u"] });

    worker.emitWorkerMessage({
      type: BRIDGE_TYPES.event,
      name: "engine-lost",
      payload: { engineId: a.engineId, reason: "lost" },
    });

    await expect(a.lost).resolves.toBe("lost");
    const pending = await Promise.race([
      b.lost.then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);
    expect(pending).toBe("pending");

    await runtime.dispose();
  });

  it("streams chat output and disposes cleanly", async () => {
    const worker = createFakeWorker();
    const runtime = createBrowserRuntime({ worker });

    const engine = await runtime.createEngine({ files: ["u"] });
    const chat = await runtime.createChat(engine, {
      tokenizerJsonUrl: "https://example.com/tokenizer.json",
      tokenizerConfigUrl: "https://example.com/tokenizer_config.json",
    });

    const events = [];
    for await (const event of chat.send([{ role: "user", content: "hi" }], {})) {
      events.push(event.type);
    }
    expect(events).toEqual(["text", "done"]);

    await runtime.dispose();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("stops routing engine-lost events after dispose", async () => {
    const worker = createFakeWorker();
    const runtime = createBrowserRuntime({ worker });
    const engine = await runtime.createEngine({ files: ["u"] });

    await runtime.dispose();

    worker.emitWorkerMessage({
      type: BRIDGE_TYPES.event,
      name: "engine-lost",
      payload: { engineId: engine.engineId, reason: "lost" },
    });

    const outcome = await Promise.race([
      engine.lost.then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);
    expect(outcome).toBe("pending");
  });
});
