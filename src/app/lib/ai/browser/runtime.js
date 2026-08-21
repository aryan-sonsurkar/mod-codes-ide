import { AI_ERRORS, AiError, normalizeAiError } from "../errors";

export const BONSAI_PROVIDER_ID = "browser-bonsai";
export const BONSAI_PROVIDER_NAME = "Bonsai (in-browser)";
export const BONSAI_CAPABILITIES = ["chat", "streaming", "tools", "browser", "local", "cancellation", "statistics"];

/**
 * The runtime adapter contract the provider depends on. The Web Worker (M52)
 * implements this interface against bitgpu; tests inject a fake.
 *
 * interface RuntimeAdapter {
 *   createEngine({ files, manifestUrl, auxUrl, signal }): Promise<Engine>
 *   createChat(engine, { tokenizerJsonUrl, tokenizerConfigUrl }): Promise<Chat>
 * }
 *
 * interface Engine {
 *   generate(tokenIds, { onToken, signal, stopTokens, maxTokens, kvCache, overflow, maxSeqLen, temperature }): Promise<{ tokenIds: number[] }>
 *   save(): Promise<object>          // structured-cloneable KV snapshot
 *   restore(snapshot): Promise<void>
 *   dispose(): Promise<void>
 *   lost: Promise<string> | null     // resolves with a reason when the device is lost
 * }
 *
 * interface Chat {
 *   send(messages, { signal, tools, maxOutputTokens, temperature }): AsyncIterable<ChatEvent>
 * }
 *
 * interface ChatEvent =
 *   { type: "text", text } |
 *   { type: "tool", toolCall: { name, arguments } } |
 *   { type: "done", usage? } |
 *   { type: "error", error: unknown }
 *
 * Messages passed to Chat.send use the session's native shape
 * ({ role, content, tool_name?, tool_calls?: [{ toolName, arguments }] });
 * the adapter translates to the runtime's native format.
 */

export function isAbortError(error) {
  return Boolean(
    error &&
      (error.name === "AbortError" ||
        error.name === "TimeoutError" ||
        error.name === "DOMException")
  );
}

export function mapRuntimeError(error, { cancelled = false } = {}) {
  if (cancelled || isAbortError(error)) {
    return new AiError(AI_ERRORS.cancelled, "Generation stopped.", {
      retryable: false,
      cause: error,
    });
  }
  if (error && error.name === "WebGPUUnavailableError") {
    return new AiError(
      AI_ERRORS.unsupported,
      "WebGPU is not available in this browser. Use Chrome or Edge on desktop.",
      { retryable: false, cause: error }
    );
  }
  if (error && error.name === "GpuOutOfMemoryError") {
    return new AiError(
      AI_ERRORS.unavailable,
      "The GPU ran out of memory. Reduce the context length or use a smaller model.",
      { retryable: true, cause: error }
    );
  }
  return normalizeAiError(error, AI_ERRORS.unavailable);
}