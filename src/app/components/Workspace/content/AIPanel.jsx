"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AIPanel.css";
import { Bot, Cpu, RefreshCw, Send, ShieldCheck, Square } from "lucide-react";
import {
  AI_ERRORS,
  BUILTIN_READONLY_TOOLS,
  buildContext,
  buildContextPreview,
  createAiSession,
  createHardwareProfile,
  createOllamaProvider,
  createTool,
  createToolRegistry,
  executeToolCall,
  recommendModels,
} from "../../../lib/ai";
import { useSettings } from "../../../contexts/SettingsContext";

const SYSTEM_PROMPT =
  "ModCodes AI is a coding assistant inside a browser-based IDE. " +
  "Help with the code in the open project. Use the editor context attached to " +
  "the conversation when it is relevant, and keep answers concise. " +
  "You only produce text replies: you cannot run commands or modify files. " +
  "You may use the available read-only tools to inspect the current file, " +
  "diagnostics, or open files when it would help answer the question.";

function toolExecuteFor(id, getContextData) {
  const data = () => (typeof getContextData === "function" ? getContextData() : {});
  switch (id) {
    case "ide.current-file":
      return async () => {
        const file = data().currentFile;
        if (!file) {
          return "No file is open.";
        }
        return file.content || `File ${file.path} is open but has no content.`;
      };
    case "ide.diagnostics":
      return async (args) => {
        const list = Array.isArray(data().diagnostics) ? data().diagnostics : [];
        const filtered = args && args.path ? list.filter((item) => item.path === args.path) : list;
        if (filtered.length === 0) {
          return "No diagnostics.";
        }
        return filtered
          .map(
            (item) =>
              `[${item.severity || "error"}] ${item.path}${item.line ? `:${item.line}` : ""} ${item.message || ""}`
          )
          .join("\n");
      };
    case "ide.open-files":
      return async () => {
        const docs = Array.isArray(data().openDocuments) ? data().openDocuments : [];
        const paths = docs
          .map((doc) => (typeof doc === "string" ? doc : doc.path || doc.uri || ""))
          .filter(Boolean);
        return paths.length > 0 ? paths.join("\n") : "No files are open.";
      };
    default:
      return async () => "Tool is not available.";
  }
}

function buildToolRegistry(getContextData) {
  const registry = createToolRegistry();
  for (const definition of BUILTIN_READONLY_TOOLS) {
    registry.registerTool(
      createTool({
        ...definition,
        execute: toolExecuteFor(definition.id, getContextData),
      })
    );
  }
  return registry;
}

function statusLabel(status) {
  if (status === "checking") {
    return "Checking Ollama...";
  }
  if (status === "connected") {
    return "Ollama connected";
  }
  return "Ollama is not reachable";
}

export default function AIPanel({ getContextData }) {
  const { settings, updateSetting } = useSettings();
  const [status, setStatus] = useState("checking");
  const [version, setVersion] = useState(null);
  const [models, setModels] = useState([]);
  const [modelId, setModelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [contextPreview, setContextPreview] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [toolActivity, setToolActivity] = useState(null);

  const sessionRef = useRef(null);
  const streamRef = useRef("");
  const listRef = useRef(null);
  const registryRef = useRef(null);

  const hardwareHint = useMemo(() => {
    const profile = createHardwareProfile();
    if (profile.deviceMemoryGb == null) {
      return null;
    }
    const recommendation = recommendModels({
      profile,
      kind: "code",
      limit: 1,
    });
    const top = recommendation.recommendations[0];
    if (!top) {
      return null;
    }
    return `${Math.round(profile.deviceMemoryGb)} GB RAM detected — ${top.model.name} fits.`;
  }, []);

  useEffect(() => {
    let active = true;

    window.setTimeout(async () => {
      if (!active) {
        return;
      }
      setStatus("checking");

      const provider = createOllamaProvider({
        baseUrl: settings.ai?.baseUrl,
      });

      const connection = await provider.testConnection();
      if (!active) {
        return;
      }
      if (!connection.ok) {
        setStatus("unavailable");
        return;
      }

      setStatus("connected");
      setVersion(connection.version || null);

      let list = [];
      try {
        list = await provider.getModels();
      } catch {
        list = [];
      }
      if (!active) {
        return;
      }
      setModels(list);

      const defaultModel =
        settings.ai?.defaultModel && list.some((model) => model.id === settings.ai.defaultModel)
          ? settings.ai.defaultModel
          : list.length > 0
            ? list[0].id
            : "";
      setModelId(defaultModel);

      if (!sessionRef.current) {
        sessionRef.current = createAiSession({
          provider,
          model: defaultModel,
          systemPrompt: SYSTEM_PROMPT,
        });
      } else {
        sessionRef.current.setModel(defaultModel);
      }

      if (!registryRef.current) {
        registryRef.current = buildToolRegistry(getContextData);
      }
    }, 0);

    return () => {
      active = false;
    };
  }, [retryToken, settings.ai, getContextData]);

  useEffect(() => {
    sessionRef.current?.setModel(modelId);
    if (modelId) {
      updateSetting("ai", "defaultModel", modelId);
    }
  }, [modelId, updateSetting]);

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    const session = sessionRef.current;
    if (!content || sending || !session || status !== "connected") {
      return;
    }

    const context = buildContext(getContextData ? getContextData() : {});
    setContextPreview(buildContextPreview(context));

    setInput("");
    setSending(true);
    setStreamingText("");
    streamRef.current = "";
    setMessages((current) => [...current, { role: "user", content }]);

    try {
      const result = await session.sendMessage({
        content,
        context,
        maxToolRounds: settings.ai?.maxToolRounds ?? 2,
        tools: BUILTIN_READONLY_TOOLS,
        toolRunner: async ({ toolName, arguments: args }) =>
          executeToolCall({
            registry: registryRef.current,
            toolName,
            args,
            permission: "read",
          }),
        onTool: ({ toolCalls }) => {
          setToolActivity(toolCalls.map((call) => call.toolName));
        },
        onDelta: (text) => {
          streamRef.current = text;
          setStreamingText(text);
        },
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.text },
      ]);
    } catch (error) {
      const code = error && error.code;
      if (code === AI_ERRORS.cancelled) {
        const last = session.history().at(-1);
        if (last && last.role === "assistant") {
          setMessages((current) => [
            ...current,
            { role: "assistant", content: last.content },
          ]);
        }
      } else {
        const message =
          error && typeof error.message === "string"
            ? error.message
            : "The AI request failed.";
        setMessages((current) => [
          ...current,
          { role: "error", content: message },
        ]);
      }
    } finally {
      setSending(false);
      setStreamingText("");
      streamRef.current = "";
      setToolActivity(null);
    }
  }, [input, sending, status, getContextData, settings.ai]);

  const handleStop = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  const connectionClass =
    status === "connected" ? "ai-status-ok" : status === "checking" ? "" : "ai-status-error";

  return (
    <div className="ai-panel">
      <div className={`ai-status ${connectionClass}`}>
        <Bot size={14} />
        <span className="ai-status-text">{statusLabel(status)}</span>
        {version && <span className="ai-status-version">v{version}</span>}
        {status === "unavailable" && (
          <button
            type="button"
            className="ai-retry"
            onClick={() => setRetryToken((token) => token + 1)}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>

      <div className="ai-controls">
        <label className="ai-label" htmlFor="ai-model-select">
          Model
        </label>
        <select
          id="ai-model-select"
          className="ai-model-select"
          value={modelId}
          disabled={status !== "connected" || models.length === 0}
          onChange={(event) => setModelId(event.target.value)}
        >
          {models.length === 0 ? (
            <option value="">No models installed</option>
          ) : (
            models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))
          )}
        </select>
        {status === "connected" && models.length === 0 && (
          <p className="ai-hint">
            Install a model with <code>ollama pull &lt;model&gt;</code>, for
            example <code>qwen2.5-coder:7b</code>, then retry.
          </p>
        )}
        {hardwareHint && (
          <p className="ai-hint">
            <Cpu size={12} />
            {hardwareHint}
          </p>
        )}
      </div>

      {contextPreview && (
        <div className="ai-context">
          <span className="ai-context-count">
            {contextPreview.sections.length} context source
            {contextPreview.sections.length === 1 ? "" : "s"}
            {contextPreview.truncated ? " · truncated" : ""}
          </span>
          <span className="ai-context-detail">
            {contextPreview.sections
              .map((section) => `${section.label} (${section.count})`)
              .join(", ")}
          </span>
        </div>
      )}

      <div className="ai-tools">
        <ShieldCheck size={12} />
        <span>Read-only tools: current file, diagnostics, open files</span>
        {toolActivity && (
          <span className="ai-tools-active">
            Used: {toolActivity.join(", ")}
          </span>
        )}
      </div>

      <div className="ai-messages" ref={listRef}>
        {messages.length === 0 && !sending ? (
          <div className="ai-empty">
            <Bot size={18} />
            <p>Ask about the current file or the open project.</p>
            <p>Context is attached explicitly when you send a message.</p>
          </div>
        ) : (
          messages.map((message, index) =>
            message.role === "error" ? (
              <div key={index} className="ai-message ai-message-error">
                {message.content}
              </div>
            ) : message.role === "user" ? (
              <div key={index} className="ai-message ai-message-user">
                {message.content}
              </div>
            ) : (
              <div key={index} className="ai-message ai-message-assistant">
                {message.content}
              </div>
            )
          )
        )}
        {sending && streamingText && (
          <div className="ai-message ai-message-assistant ai-message-streaming">
            {streamingText}
            <span className="ai-caret" />
          </div>
        )}
        {sending && !streamingText && (
          <div className="ai-message ai-message-assistant ai-message-thinking">
            Thinking<span className="ai-caret" />
          </div>
        )}
      </div>

      <div className="ai-input-row">
        <textarea
          className="ai-input"
          rows={2}
          placeholder={
            status === "connected" ? "Ask about your code..." : "Start Ollama to chat"
          }
          value={input}
          disabled={status !== "connected"}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        {sending ? (
          <button type="button" className="ai-send" onClick={handleStop} title="Stop">
            <Square size={14} />
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="ai-send"
            onClick={handleSend}
            disabled={!input.trim() || status !== "connected"}
            title="Send"
          >
            <Send size={14} />
            Send
          </button>
        )}
      </div>
    </div>
  );
}