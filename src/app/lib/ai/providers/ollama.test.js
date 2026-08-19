import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_ERRORS,
  OLLAMA_DEFAULT_BASE_URL,
  clearProviders,
  createOllamaProvider,
  getProvider,
  isAiError,
  mapOptions,
  normalizeBaseUrl,
  parseModelTag,
  parseToolArguments,
  registerOllamaProvider,
  serializeToolsForOllama,
  toModel,
  toolCallsFromMessage,
} from "../index";
import { serializeContextItems } from "../context";

const originalFetch = global.fetch;

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function ndjsonResponse(lines) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      }
      controller.close();
    },
  });
  return { ok: true, status: 200, body, text: async () => "" };
}

function makeProvider(options) {
  return createOllamaProvider(options);
}

function request(messages, overrides = {}) {
  return { messages, model: "llama3.2:latest", options: {}, ...overrides };
}

afterEach(() => {
  clearProviders();
  global.fetch = originalFetch;
});

describe("normalizeBaseUrl", () => {
  it("defaults to the local Ollama endpoint", () => {
    expect(normalizeBaseUrl(undefined)).toBe(OLLAMA_DEFAULT_BASE_URL);
    expect(normalizeBaseUrl("")).toBe(OLLAMA_DEFAULT_BASE_URL);
  });

  it("trims trailing slashes and accepts http(s)", () => {
    expect(normalizeBaseUrl("http://127.0.0.1:11434/")).toBe(
      "http://127.0.0.1:11434"
    );
    expect(normalizeBaseUrl("https://localhost:11434")).toBe(
      "https://localhost:11434"
    );
  });

  it("rejects non-http URLs", () => {
    expect(() => normalizeBaseUrl("ftp://localhost")).toThrow();
    expect(() => normalizeBaseUrl("not a url")).toThrow();
  });
});

describe("parseModelTag", () => {
  it("splits model:tag names", () => {
    expect(parseModelTag("llama3.2:latest")).toEqual({
      model: "llama3.2",
      tag: "latest",
    });
    expect(parseModelTag("deepseek-r1:7b")).toEqual({
      model: "deepseek-r1",
      tag: "7b",
    });
  });

  it("handles namespaces and missing tags", () => {
    expect(parseModelTag("example/model:tag")).toEqual({
      model: "model",
      tag: "tag",
    });
    expect(parseModelTag("llama3.2")).toEqual({ model: "llama3.2", tag: null });
  });

  it("handles empty input", () => {
    expect(parseModelTag("")).toEqual({ model: null, tag: null });
    expect(parseModelTag(null)).toEqual({ model: null, tag: null });
  });
});

describe("mapOptions", () => {
  it("passes through only known Ollama options", () => {
    const mapped = mapOptions({
      temperature: 0.2,
      num_predict: 64,
      seed: 1,
      custom: "nope",
    });
    expect(mapped).toEqual({ temperature: 0.2, num_predict: 64, seed: 1 });
  });

  it("omits null and undefined values", () => {
    expect(mapOptions({ temperature: null, top_p: undefined })).toEqual({});
    expect(mapOptions({})).toEqual({});
  });
});

describe("toModel", () => {
  it("maps an /api/tags entry to an AiModel", () => {
    const model = toModel({
      name: "llama3.2:latest",
      size: 2019393189,
      digest: "abc",
      details: {
        family: "llama",
        parameter_size: "3.2B",
        quantization_level: "Q4_K_M",
      },
    });

    expect(model.id).toBe("llama3.2:latest");
    expect(model.provider).toBe("ollama");
    expect(model.capabilities).toContain("chat");
    expect(model.metadata.parameterSize).toBe("3.2B");
    expect(model.metadata.size).toBe(2019393189);
  });

  it("returns null for invalid entries", () => {
    expect(toModel(undefined)).toBeNull();
    expect(toModel({})).toBeNull();
    expect(toModel({ name: 42 })).toBeNull();
  });
});

describe("getModels", () => {
  it("lists local models from /api/tags", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        models: [
          { name: "llama3.2:latest", details: { parameter_size: "3.2B" } },
          { name: "deepseek-r1:7b", details: { parameter_size: "7.6B" } },
          { notAEntry: true },
        ],
      })
    );

    const provider = makeProvider();
    const models = await provider.getModels();

    expect(global.fetch).toHaveBeenCalledWith(
      `${OLLAMA_DEFAULT_BASE_URL}/api/tags`,
      expect.objectContaining({ method: "GET" })
    );
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("llama3.2:latest");
  });

  it("normalizes connection failures", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const provider = makeProvider();
    await expect(provider.getModels()).rejects.toMatchObject({
      code: AI_ERRORS.connectionFailed,
    });
  });
});

describe("chat", () => {
  it("sends stream:false and returns the assistant text", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        model: "llama3.2:latest",
        message: { role: "assistant", content: "Hello!" },
        done: true,
      })
    );

    const provider = makeProvider();
    const result = await provider.chat(
      request([{ role: "user", content: "Hi" }])
    );

    expect(result).toEqual({ ok: true, text: "Hello!" });

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${OLLAMA_DEFAULT_BASE_URL}/api/chat`);
    const body = JSON.parse(init.body);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("llama3.2:latest");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.options).toBeUndefined();
  });

  it("injects bounded context as a system message when present", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        message: { role: "assistant", content: "ok" },
        done: true,
      })
    );

    const provider = makeProvider();
    const context = {
      items: [
        { type: "current_file", path: "src/a.js", content: "export const a = 1;" },
      ],
    };
    await provider.chat(
      request([{ role: "user", content: "Explain a.js" }], { context })
    );

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("src/a.js");
  });

  it("does not add a context message without context", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ message: { role: "assistant", content: "ok" }, done: true })
    );

    const provider = makeProvider();
    await provider.chat(request([{ role: "user", content: "Hi" }]));

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages).toHaveLength(1);
  });

  it("maps 404 to modelNotFound", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: "model 'nope' not found" }, 404)
    );

    const provider = makeProvider();
    await expect(provider.chat(request([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({
      code: AI_ERRORS.modelNotFound,
    });
  });

  it("normalizes network failures to connectionFailed", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const provider = makeProvider();
    await expect(provider.chat(request([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({
      code: AI_ERRORS.connectionFailed,
    });
  });

  it("normalizes timeouts", async () => {
    global.fetch = vi.fn(
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () =>
              reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true }
          );
        })
    );

    const provider = makeProvider({ timeoutMs: 10 });
    await expect(provider.chat(request([{ role: "user", content: "Hi" }]))).rejects.toMatchObject({
      code: AI_ERRORS.timeout,
    });
  });
});

describe("streamChat", () => {
  async function collect(provider, req) {
    const stream = await provider.streamChat(req);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks;
  }

  it("yields text chunks and a final done chunk", async () => {
    global.fetch = vi.fn(async () =>
      ndjsonResponse([
        { model: "llama3.2", message: { role: "assistant", content: "The" }, done: false },
        { model: "llama3.2", message: { role: "assistant", content: " sky" }, done: false },
        { model: "llama3.2", message: { role: "assistant", content: "" }, done: true },
      ])
    );

    const provider = makeProvider();
    const chunks = await collect(provider, request([{ role: "user", content: "Why?" }]));

    expect(chunks.filter((chunk) => chunk.type === "text").map((chunk) => chunk.text)).toEqual([
      "The",
      " sky",
    ]);
    expect(chunks.some((chunk) => chunk.type === "done")).toBe(true);
  });

  it("yields an error chunk when the endpoint fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ error: "nope" }, 404));

    const provider = makeProvider();
    const chunks = await collect(provider, request([{ role: "user", content: "Hi" }]));

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.modelNotFound);
  });

  it("yields an error chunk when Ollama is unreachable", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const provider = makeProvider();
    const chunks = await collect(provider, request([{ role: "user", content: "Hi" }]));

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].error.code).toBe(AI_ERRORS.connectionFailed);
  });
});

describe("tools", () => {
  async function collect(provider, req) {
    const stream = await provider.streamChat(req);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks;
  }

  it("serializes tool definitions to the Ollama format", () => {
    const serialized = serializeToolsForOllama([
      {
        id: "ide.diagnostics",
        name: "Read diagnostics",
        description: "Returns diagnostics.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: [],
        },
      },
    ]);
    expect(serialized).toEqual([
      {
        type: "function",
        function: {
          name: "ide.diagnostics",
          description: "Returns diagnostics.",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: [],
          },
        },
      },
    ]);
  });

  it("filters invalid tool definitions", () => {
    expect(serializeToolsForOllama([null, {}, { id: "ok", name: "OK" }])).toEqual([
      {
        type: "function",
        function: { name: "ok", description: "", parameters: { type: "object", properties: {} } },
      },
    ]);
    expect(serializeToolsForOllama(undefined)).toEqual([]);
  });

  it("parses tool call arguments from objects or JSON strings", () => {
    expect(parseToolArguments({ path: "/a.js" })).toEqual({ path: "/a.js" });
    expect(parseToolArguments('{"path":"/a.js"}')).toEqual({ path: "/a.js" });
    expect(parseToolArguments("not json")).toEqual({});
    expect(parseToolArguments(null)).toEqual({});
  });

  it("extracts tool calls from a message", () => {
    const calls = toolCallsFromMessage({
      content: "",
      tool_calls: [
        { function: { name: "ide.diagnostics", arguments: '{"path":"/a.js"}' } },
        { function: { name: "ide.open-files", arguments: {} } },
      ],
    });
    expect(calls).toEqual([
      { toolName: "ide.diagnostics", arguments: { path: "/a.js" } },
      { toolName: "ide.open-files", arguments: {} },
    ]);
  });

  it("returns no calls for empty messages", () => {
    expect(toolCallsFromMessage(undefined)).toEqual([]);
    expect(toolCallsFromMessage({ content: "plain" })).toEqual([]);
  });

  it("includes tools in the chat request body", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ message: { role: "assistant", content: "ok" }, done: true })
    );

    const provider = makeProvider();
    await provider.chat(
      request([{ role: "user", content: "Hi" }], {
        tools: [{ id: "ide.diagnostics", name: "Read diagnostics", description: "x", parameters: {} }],
      })
    );

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toEqual([
      {
        type: "function",
        function: { name: "ide.diagnostics", description: "x", parameters: {} },
      },
    ]);
  });

  it("keeps tool result messages in the request body", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ message: { role: "assistant", content: "done" }, done: true })
    );

    const provider = makeProvider();
    await provider.chat(
      request([
        { role: "assistant", content: "", tool_calls: [{ toolName: "ide.diagnostics", arguments: {} }] },
        { role: "tool", content: '{"ok":true,"result":"none"}', tool_name: "ide.diagnostics" },
      ])
    );

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [{ function: { name: "ide.diagnostics", arguments: {} } }],
    });
    expect(body.messages[1]).toEqual({
      role: "tool",
      content: '{"ok":true,"result":"none"}',
      tool_name: "ide.diagnostics",
    });
  });

  it("returns tool calls from a non-streaming response", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            { function: { name: "ide.diagnostics", arguments: '{"path":"/a.js"}' } },
          ],
        },
        done: true,
      })
    );

    const provider = makeProvider();
    const result = await provider.chat(request([{ role: "user", content: "Hi" }]));

    expect(result.ok).toBe(true);
    expect(result.toolCalls).toEqual([
      { toolName: "ide.diagnostics", arguments: { path: "/a.js" } },
    ]);
  });

  it("yields tool chunks from a streaming response", async () => {
    global.fetch = vi.fn(async () =>
      ndjsonResponse([
        {
          model: "llama3.2",
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              { function: { name: "ide.open-files", arguments: {} } },
            ],
          },
          done: false,
        },
        { model: "llama3.2", message: { role: "assistant", content: "" }, done: true },
      ])
    );

    const provider = makeProvider();
    const chunks = await collect(
      provider,
      request([{ role: "user", content: "Which files?" }])
    );

    expect(chunks.filter((chunk) => chunk.type === "tool")).toEqual([
      {
        type: "tool",
        toolRequest: { toolName: "ide.open-files", arguments: {} },
      },
    ]);
    expect(chunks.some((chunk) => chunk.type === "done")).toBe(true);
  });
});

describe("testConnection", () => {
  it("reports ok with the server version", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ version: "0.5.1" }));

    const provider = makeProvider();
    const result = await provider.testConnection();

    expect(result).toEqual({ ok: true, version: "0.5.1" });
    expect(global.fetch).toHaveBeenCalledWith(
      `${OLLAMA_DEFAULT_BASE_URL}/api/version`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("reports ok:false with a normalized error when unreachable", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const provider = makeProvider();
    const result = await provider.testConnection();

    expect(result.ok).toBe(false);
    expect(isAiError(result.error)).toBe(true);
    expect(result.error.code).toBe(AI_ERRORS.connectionFailed);
  });
});

describe("registerOllamaProvider", () => {
  it("registers the provider in the registry", () => {
    const provider = registerOllamaProvider();
    expect(getProvider("ollama")).toBe(provider);
    expect(getProvider("ollama").getCapabilities().capabilities).toContain(
      "streaming"
    );
  });

  it("rejects duplicate registration", () => {
    registerOllamaProvider();
    expect(() => registerOllamaProvider()).toThrow();
  });
});

describe("serializeContextItems", () => {
  it("serializes items with type and path headers", () => {
    const text = serializeContextItems({
      items: [
        { type: "current_file", path: "src/a.js", content: "export const a = 1;" },
        { type: "selection", content: "const b = 2;" },
      ],
    });
    expect(text).toContain("[current_file src/a.js]");
    expect(text).toContain("export const a = 1;");
    expect(text).toContain("[selection]");
  });

  it("returns empty string for no items", () => {
    expect(serializeContextItems(undefined)).toBe("");
    expect(serializeContextItems({})).toBe("");
    expect(serializeContextItems({ items: [] })).toBe("");
  });
});
