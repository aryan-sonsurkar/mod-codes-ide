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

  return {
    async createEngine({ files, manifestUrl, auxUrl }) {
      const { engineId } = await client.request("engine.create", {
        files,
        manifestUrl,
        auxUrl,
      });
      return {
        engineId,
        save: () => client.request("engine.save", { engineId }),
        restore: (snapshot) =>
          client.request("engine.restore", { engineId, snapshot }),
        dispose: () => client.request("engine.dispose", { engineId }),
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
      await client.request("dispose");
      await client.dispose();
    },
  };
}