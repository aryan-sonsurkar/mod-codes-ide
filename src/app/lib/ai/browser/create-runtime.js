import { createBridgeClient } from "./bridge";

/**
 * Creates the Web Worker that hosts the bitgpu runtime. Only call this from
 * the browser (a client component / effect); the Worker constructor does not
 * exist during SSR.
 */
export function createBrowserWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }
  return new Worker(new URL("./bonsai.worker.js", import.meta.url), {
    type: "module",
  });
}

/**
 * The RuntimeAdapter (see runtime.js) backed by the worker bridge. Used by
 * BrowserBonsaiProvider in the browser; tests inject a fake instead.
 */
export function createBrowserRuntime({ worker = createBrowserWorker() } = {}) {
  if (!worker) {
    return null;
  }
  const client = createBridgeClient({ worker });
  const lostResolvers = new Map();
  let engineSeq = 0;

  // The client allocates the engine id up front so the `engine-lost` event
  // can be routed before the create request resolves.
  const unsubscribeLost = client.onEvent((name, payload) => {
    if (name !== "engine-lost" || !payload) {
      return;
    }
    const resolve = lostResolvers.get(payload.engineId);
    if (resolve) {
      lostResolvers.delete(payload.engineId);
      resolve(payload.reason || "lost");
    }
  });

  return {
    async createEngine({ files, manifestUrl, auxUrl }) {
      engineSeq += 1;
      const engineId = `engine-${engineSeq}`;
      let resolveLost = null;
      const lost = new Promise((resolve) => {
        resolveLost = resolve;
      });
      lostResolvers.set(engineId, resolveLost);

      try {
        await client.request("engine.create", { engineId, files, manifestUrl, auxUrl });
      } catch (error) {
        lostResolvers.delete(engineId);
        throw error;
      }

      return {
        engineId,
        lost,
        save: () => client.request("engine.save", { engineId }),
        restore: (snapshot) =>
          client.request("engine.restore", { engineId, snapshot }),
        dispose: () => {
          lostResolvers.delete(engineId);
          return client.request("engine.dispose", { engineId });
        },
      };
    },
    async createChat(engine, { tokenizerJsonUrl, tokenizerConfigUrl }) {
      const { chatId } = await client.request("chat.create", {
        engineId: engine.engineId,
        tokenizerJsonUrl,
        tokenizerConfigUrl,
      });
      return {
        chatId,
        send(messages, options) {
          return client.streamRequest(
            "chat.send",
            { chatId, messages, options },
            { signal: options && options.signal }
          );
        },
        dispose: () => client.request("chat.dispose", { chatId }),
      };
    },
    async ping() {
      return client.request("ping");
    },
    async dispose() {
      lostResolvers.clear();
      if (typeof unsubscribeLost === "function") {
        unsubscribeLost();
      }
      try {
        await client.request("dispose");
      } finally {
        await client.dispose();
      }
    },
  };
}
