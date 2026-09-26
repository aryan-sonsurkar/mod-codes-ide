import { createWorkerMessageHandler } from "./bridge";
import { createBitgpuAdapter } from "./adapter-bitgpu";
import { createWeightCachedFetch, WEIGHT_CACHE_NAME } from "./cache";

// Serve already-downloaded model weights from Cache Storage instead of the
// network. `downloadModel` writes them there, but without this the runtime
// would fetch the same 200+ MB again on every load.
if (typeof globalThis !== "undefined" && typeof globalThis.caches !== "undefined") {
  const cachedFetch = createWeightCachedFetch({
    cacheName: WEIGHT_CACHE_NAME,
    cacheProvider: {
      open: (name) => globalThis.caches.open(name || WEIGHT_CACHE_NAME),
    },
    fetchImpl: globalThis.fetch ? globalThis.fetch.bind(globalThis) : null,
  });
  if (cachedFetch) {
    globalThis.fetch = cachedFetch;
  }
}

const adapter = createBitgpuAdapter();

function postMessage(message) {
  self.postMessage(message);
}

const onMessage = createWorkerMessageHandler({ adapter, postMessage });

self.onmessage = onMessage;
