import { createWorkerMessageHandler } from "./bridge";
import { createBitgpuAdapter } from "./adapter-bitgpu";

const adapter = createBitgpuAdapter();

function postMessage(message) {
  self.postMessage(message);
}

const onMessage = createWorkerMessageHandler({ adapter, postMessage });

self.onmessage = onMessage;