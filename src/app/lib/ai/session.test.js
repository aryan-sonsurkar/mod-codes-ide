import { describe, expect, it, vi } from "vitest";
import {
  AI_ERRORS,
  AiError,
  createAiSession,
  createChatResult,
  errorChunk,
  textChunk,
  toolChunk,
} from "./index";

function chatProvider(overrides = {}) {
  return {
    id: "fake",
    name: "Fake Provider",
    chat: async (request) => createChatResult({ text: `reply to ${request.messages.at(-1).content}` }),
    ...overrides,
  };
}

function toolChatProvider(toolCallsForRounds) {
  let call = 0;
  return chatProvider({
    chat: async () => {
      const calls = toolCallsForRounds[Math.min(call, toolCallsForRounds.length - 1)];
      call += 1;
      if (calls.length > 0) {
        return { ok: true, text: "using tools", toolCalls: calls };
      }
      return createChatResult({ text: "final answer" });
    },
  });
}

describe("createAiSession", () => {
  it("requires a provider", () => {
    expect(() => createAiSession()).toThrow();
    expect(() => createAiSession({ provider: { id: "x" } })).toThrow();
  });

  it("seeds a system prompt when provided", () => {
    const session = createAiSession({
      provider: chatProvider(),
      model: "llama3.2",
      systemPrompt: "You are concise.",
    });
    expect(session.history()).toEqual([
      { role: "system", content: "You are concise." },
    ]);
    expect(session.snapshot().model).toBe("llama3.2");
  });

  it("rejects empty messages", () => {
    const session = createAiSession({ provider: chatProvider(), model: "m" });
    expect(() => session.addMessage("user", "")).toThrow();
  });

  it("requires a model before sending", async () => {
    const session = createAiSession({ provider: chatProvider() });
    await expect(
      session.sendMessage({ content: "hi" })
    ).rejects.toMatchObject({ code: AI_ERRORS.invalidRequest });
  });

  it("sends a message and appends the assistant reply", async () => {
    const session = createAiSession({
      provider: chatProvider(),
      model: "llama3.2",
    });
    const result = await session.sendMessage({ content: "hello" });

    expect(result.ok).toBe(true);
    expect(result.text).toBe("reply to hello");
    expect(session.history()).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "reply to hello" },
    ]);
    expect(session.snapshot().active).toBe(false);
  });

  it("normalizes provider failures", async () => {
    const provider = chatProvider({
      chat: async () => {
        throw new Error("boom");
      },
    });
    const session = createAiSession({ provider, model: "m" });

    await expect(session.sendMessage({ content: "hi" })).rejects.toMatchObject({
      code: AI_ERRORS.invalidRequest,
    });
    expect(session.history()).toEqual([{ role: "user", content: "hi" }]);
  });

  it("passes bounded context through to the provider", async () => {
    const chat = vi.fn(async () => createChatResult({ text: "ok" }));
    const provider = chatProvider({ chat });
    const session = createAiSession({ provider, model: "m" });
    const context = { items: [{ type: "current_file", content: "code" }] };

    await session.sendMessage({ content: "explain", context });

    expect(chat).toHaveBeenCalledTimes(1);
    const request = chat.mock.calls[0][0];
    expect(request.context).toBe(context);
    expect(request.signal).toBeDefined();
  });

  it("streams via streamChat and reports deltas", async () => {
    const provider = chatProvider({
      streamChat: async function* () {
        yield textChunk("Hel");
        yield textChunk("lo");
        yield { type: "done" };
      },
    });
    const session = createAiSession({ provider, model: "m" });
    const deltas = [];

    const result = await session.sendMessage({
      content: "hi",
      onDelta: (text) => deltas.push(text),
    });

    expect(result.text).toBe("Hello");
    expect(deltas).toEqual(["Hel", "Hello"]);
    expect(session.history()).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("keeps partial text on stop and reports cancelled", async () => {
    const provider = chatProvider({
      streamChat: async function* () {
        yield textChunk("partial");
        yield errorChunk(new AiError(AI_ERRORS.cancelled, "stopped"));
      },
    });
    const session = createAiSession({ provider, model: "m" });

    await expect(
      session.sendMessage({ content: "hi" })
    ).rejects.toMatchObject({ code: AI_ERRORS.cancelled });
    expect(session.history()).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "partial" },
    ]);
  });

  it("aborts the in-flight request on stop", async () => {
    let abortSpy;
    const provider = chatProvider({
      chat: async (request) => {
        abortSpy = request.signal;
        await new Promise((resolve) => {
          request.signal.addEventListener("abort", resolve, { once: true });
        });
        throw new AiError(AI_ERRORS.cancelled, "cancelled");
      },
    });
    const session = createAiSession({ provider, model: "m" });

    const pending = session.sendMessage({ content: "hi" });
    session.stop();

    await expect(pending).rejects.toMatchObject({
      code: AI_ERRORS.cancelled,
    });
    expect(abortSpy.aborted).toBe(true);
    expect(session.snapshot().active).toBe(false);
  });

  it("blocks concurrent sends", async () => {
    const provider = chatProvider({
      chat: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return createChatResult({ text: "ok" });
      },
    });
    const session = createAiSession({ provider, model: "m" });

    const first = session.sendMessage({ content: "a" });
    await expect(
      session.sendMessage({ content: "b" })
    ).rejects.toMatchObject({ code: AI_ERRORS.invalidRequest });
    await first;
  });

  it("clears history back to the system prompt", async () => {
    const session = createAiSession({
      provider: chatProvider(),
      model: "m",
      systemPrompt: "sys",
    });
    await session.sendMessage({ content: "hi" });
    session.clear();
    expect(session.history()).toEqual([{ role: "system", content: "sys" }]);
  });

  it("sets the model for subsequent requests", async () => {
    const chat = vi.fn(async () => createChatResult({ text: "ok" }));
    const session = createAiSession({ provider: chatProvider({ chat }) });
    session.setModel("qwen2.5-coder:7b");

    await session.sendMessage({ content: "hi" });
    expect(chat.mock.calls[0][0].model).toBe("qwen2.5-coder:7b");
  });
});

describe("createAiSession tool loop", () => {
  const readTool = { id: "ide.current-file", name: "Read current file" };

  it("executes tool calls and feeds results back to the model", async () => {
    const toolRunner = vi.fn(async () => ({ ok: true, result: "file content" }));
    const onTool = vi.fn();
    const session = createAiSession({
      provider: toolChatProvider([
        [{ toolName: "ide.current-file", arguments: {} }],
        [],
      ]),
      model: "m",
    });

    const result = await session.sendMessage({
      content: "read the file",
      tools: [readTool],
      toolRunner,
      onTool,
    });

    expect(toolRunner).toHaveBeenCalledWith({
      toolName: "ide.current-file",
      arguments: {},
    });
    expect(onTool).toHaveBeenCalledWith({
      toolCalls: [{ toolName: "ide.current-file", arguments: {} }],
      results: [{ ok: true, result: "file content" }],
    });
    expect(result).toMatchObject({ ok: true, text: "final answer" });
    expect(session.history()).toEqual([
      { role: "user", content: "read the file" },
      {
        role: "assistant",
        content: "using tools",
        tool_calls: [{ toolName: "ide.current-file", arguments: {} }],
      },
      {
        role: "tool",
        content: JSON.stringify({ ok: true, result: "file content" }),
        tool_name: "ide.current-file",
      },
      { role: "assistant", content: "final answer" },
    ]);
  });

  it("collects tool requests from stream chunks", async () => {
    const toolRunner = vi.fn(async () => ({ ok: true, result: "42" }));
    let round = 0;
    const provider = chatProvider({
      streamChat: async function* () {
        round += 1;
        if (round === 1) {
          yield textChunk("checking");
          yield toolChunk({ toolName: "ide.open-files", arguments: {} });
          yield { type: "done" };
          return;
        }
        yield textChunk("Here is the list.");
        yield { type: "done" };
      },
    });
    const session = createAiSession({ provider, model: "m" });

    const result = await session.sendMessage({
      content: "which files?",
      tools: [{ id: "ide.open-files", name: "List" }],
      toolRunner,
    });

    expect(toolRunner).toHaveBeenCalledWith({
      toolName: "ide.open-files",
      arguments: {},
    });
    expect(result.text).toBe("Here is the list.");
  });

  it("records a noToolRunner result when none is configured", async () => {
    const session = createAiSession({
      provider: toolChatProvider([[{ toolName: "ide.current-file", arguments: {} }]]),
      model: "m",
    });

    const result = await session.sendMessage({
      content: "go",
      tools: [readTool],
    });

    expect(result.ok).toBe(true);
    const toolMessage = session.history().find((message) => message.role === "tool");
    expect(toolMessage).toEqual({
      role: "tool",
      content: JSON.stringify({
        ok: false,
        code: "noToolRunner",
        error: "No tool runner is configured.",
      }),
      tool_name: "ide.current-file",
    });
  });

  it("normalizes tool runner failures into the tool result", async () => {
    const toolRunner = vi.fn(async () => {
      throw new Error("kaput");
    });
    const session = createAiSession({
      provider: toolChatProvider([[{ toolName: "ide.current-file", arguments: {} }]]),
      model: "m",
    });

    await session.sendMessage({ content: "go", tools: [readTool], toolRunner });

    const toolMessage = session.history().find((message) => message.role === "tool");
    expect(JSON.parse(toolMessage.content)).toEqual({
      ok: false,
      code: "executionFailed",
      error: "kaput",
    });
  });

  it("passes tools and tool result history to the provider", async () => {
    const requests = [];
    const provider = chatProvider({
      chat: async (request) => {
        requests.push(request);
        if (requests.length === 1) {
          return { ok: true, text: "", toolCalls: [{ toolName: "ide.open-files", arguments: {} }] };
        }
        return createChatResult({ text: "done" });
      },
    });
    const session = createAiSession({ provider, model: "m" });

    await session.sendMessage({
      content: "hi",
      tools: [readTool],
      toolRunner: async () => ({ ok: true, result: "r" }),
    });

    expect(requests[0].tools).toEqual([readTool]);
    expect(requests[0].tools).not.toBeUndefined();
    expect(requests[1].tools).toEqual([readTool]);
    expect(requests[1].messages.at(-1)).toEqual({
      role: "tool",
      content: JSON.stringify({ ok: true, result: "r" }),
      tool_name: "ide.open-files",
    });
  });

  it("stops looping after maxToolRounds", async () => {
    const alwaysTools = [{ toolName: "ide.open-files", arguments: {} }];
    const session = createAiSession({
      provider: toolChatProvider([alwaysTools, alwaysTools, alwaysTools]),
      model: "m",
    });

    const result = await session.sendMessage({
      content: "go",
      maxToolRounds: 2,
      tools: [readTool],
      toolRunner: async () => ({ ok: true, result: "x" }),
    });

    expect(result.toolLimitReached).toBe(true);
    expect(result.ok).toBe(true);
    const assistantToolMessages = session
      .history()
      .filter((message) => Array.isArray(message.tool_calls));
    expect(assistantToolMessages).toHaveLength(2);
  });
});