const SYSTEM_PROMPT =
  "You are MODCODES, an AI coding assistant embedded in a web IDE. " +
  "You help with programming tasks using the tools and context provided. " +
  "Be concise and direct. Never claim to have performed an action you did not perform.";

/**
 * Minimal in-memory Chat implementing the bridge adapter contract for the
 * worker side. Tests swap this for a stub; the production implementation
 * (adapter-bitgpu.js) delegates to bitgpu inside the Web Worker.
 */
export function createMemoryChatAdapter() {
  function translateMessage(message) {
    const entry = { role: message.role, content: message.content ?? "" };
    if (message.tool_name) {
      entry.tool_name = message.tool_name;
    }
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      entry.tool_calls = message.tool_calls.map((call) => ({
        name: call.toolName ?? call.name,
        arguments: call.arguments ?? {},
      }));
    }
    return entry;
  }

  return {
    translateMessage,
    async createEngine() {
      return { id: "memory-engine" };
    },
    async createChat() {
      return { id: "memory-chat" };
    },
    async* chatSend(chat, messages, options) {
      if (options && options.signal && options.signal.aborted) {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      }
      const system = messages.find((m) => m.role === "system");
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const prompt = (system ? system.content + "\n\n" : "") + (lastUser ? lastUser.content : "");
      yield { type: "text", text: prompt };
      yield { type: "done", usage: { tokensPerSecond: 0, prefillMs: 0, decodeMs: 0 } };
    },
    async saveCache() {
      return null;
    },
    async restoreCache() {},
    async disposeEngine() {},
    async disposeChat() {},
  };
}

export function systemPrompt() {
  return SYSTEM_PROMPT;
}