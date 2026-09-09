"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AIPanel.css";
import { Bot, Cpu, RefreshCw, Send, ShieldCheck, Square, Copy, Check } from "lucide-react";
import {
  AI_ERRORS,
  BUILTIN_READONLY_TOOLS,
  CONVERSATION_STATES,
  MODEL_STATES,
  buildContext,
  buildContextPreview,
  createAiSession,
  createBrowserBonsaiProvider,
  createBrowserRuntime,
  createDiff,
  createHardwareProfile,
  createMessage,
  createModelRegistry,
  createOllamaProvider,
  createStoredConversation,
  createTool,
  createToolRegistry,
  describeAiError,
  describeDeviceTier,
  detectWebGpuCapability,
  executeToolCall,
  formatDurationMs,
  formatTokensPerSecond,
  hardwareTier,
  isWebGpuAvailable,
  loadConversations,
  parseReferencesFromText,
  recommendModels,
  saveConversations,
  watchDeviceLost,
} from "../../../lib/ai";
import { useSettings } from "../../../contexts/SettingsContext";
import { PROVIDER_STATES, providerStateLabel, providerStateClass } from "../../../lib/ai/providerStates";
import BrowserAISection from "./BrowserAISection";
import AIContextInspector from "./AIContextInspector";
import AIReferences from "./AIReferences";
import AIDiffPreview, { hasCodeBlock, extractCodeBlocks } from "./AIDiffPreview";
import AIToolApproval from "./AIToolApproval";
import AIConversations from "./AIConversations";
import AIProviderCapabilities from "./AIProviderCapabilities";
import AIActionHistory from "./AIActionHistory";
import AgentWorkflowDemo from "./AgentWorkflowDemo";
import AISetup from "./AISetup";
import { approvalRequestFor } from "../../../lib/ai/toolApproval";
import { createActionHistory } from "../../../lib/ai/actionHistory";
import { useUsageTracker } from "../../../hooks/useUsageTracker";
import UsageIndicator from "../../Ads/UsageIndicator";

const BROWSER_MODEL_ID = "bonsai-1.7b";

function formatContextWindow(tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return null;
  }
  if (tokens >= 1000 && tokens % 1000 === 0) {
    return `${Math.round(tokens / 1000)}k`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}

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

function statusLabel(status, providerId) {
  return providerStateLabel(status, providerId);
}

function formatModelSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export default function AIPanel({ getContextData, externalPrompt = null, onApplyDiff = null, onNavigate = null }) {
  const { settings, updateSetting } = useSettings();
  const [providerId, setProviderId] = useState(
    settings.ai?.provider === "browser-bonsai" ? "browser-bonsai" : "ollama"
  );
  const [status, setStatus] = useState(PROVIDER_STATES.unknown);
  const [version, setVersion] = useState(null);
  const [models, setModels] = useState([]);
  const [modelId, setModelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [generationState, setGenerationState] = useState(CONVERSATION_STATES.idle);
  const [contextPreview, setContextPreview] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshModelsToken, setRefreshModelsToken] = useState(0);
  const [toolActivity, setToolActivity] = useState(null);
  const [capability, setCapability] = useState(null);
  const [browserModelInfo, setBrowserModelInfo] = useState(null);
  const [browserRegistry, setBrowserRegistry] = useState(null);
  const [lastStats, setLastStats] = useState(null);
  const [excludedSources, setExcludedSources] = useState(() => new Set());
  const [contextForInspector, setContextForInspector] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [appliedDiffId, setAppliedDiffId] = useState(null);
  const [conversations, setConversations] = useState(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState(null);
  const actionHistoryRef = useRef(createActionHistory({ limit: 50 }));
  const [actionEntries, setActionEntries] = useState([]);
  const [generationPhase, setGenerationPhase] = useState(null);

  const sessionRef = useRef(null);
  const streamRef = useRef("");
  const pendingTextRef = useRef("");
  const rafRef = useRef(null);
  const listRef = useRef(null);
  const toolRegistryRef = useRef(null);
  const browserRuntimeRef = useRef(null);

  const cacheProvider = useMemo(
    () =>
      typeof caches !== "undefined" && caches
        ? { open: (name) => caches.open(name || "modcodes-ai-v1") }
        : null,
    []
  );

  const { tracker, usage, trackUsage: recordUsage, checkLimit, getLimitStatus, refresh: refreshUsage } = useUsageTracker({
    limits: settings.ai?.usageLimits || {},
  });

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (sessionRef.current && typeof sessionRef.current.stop === "function") {
        sessionRef.current.stop();
      }
      if (browserRuntimeRef.current && typeof browserRuntimeRef.current.dispose === "function") {
        browserRuntimeRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    return () => {
      if (browserRuntimeRef.current) {
        try {
          browserRuntimeRef.current.dispose?.();
        } catch {
          // ignore
        }
      }
    };
  }, []);

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

  const refreshBrowserModel = useCallback(async () => {
    setBrowserModelInfo(
      browserRegistry ? await browserRegistry.getModel(BROWSER_MODEL_ID) : null
    );
  }, [browserRegistry]);

  useEffect(() => {
    let active = true;
    window.setTimeout(async () => {
      if (!active) {
        return;
      }
      const detected = await detectWebGpuCapability();
      if (!active) {
        return;
      }
      setCapability(detected);
      const registry = createModelRegistry({
        capability: detected,
        cacheProvider,
        onStateChange: () => {
          if (active) {
            refreshBrowserModel();
          }
        },
      });
      setBrowserRegistry(registry);
      setBrowserModelInfo(await registry.getModel(BROWSER_MODEL_ID));
    }, 0);
    return () => {
      active = false;
    };
  }, [cacheProvider, refreshBrowserModel]);

  useEffect(() => {
    if (!capability || !capability.device) {
      return;
    }
    const { promise } = watchDeviceLost(capability.device);
    if (!promise) {
      return;
    }
    let active = true;
    promise.then((reason) => {
      if (!active) return;
      setCapability((prev) => prev ? { ...prev, state: "lost", reason } : prev);
      if (providerId === "browser-bonsai") {
        setStatus(PROVIDER_STATES.unavailable);
      }
    }).catch(() => {
      if (!active) return;
      setCapability((prev) => prev ? { ...prev, state: "lost", reason: "error" } : prev);
      if (providerId === "browser-bonsai") {
        setStatus(PROVIDER_STATES.unavailable);
      }
    });
    return () => { active = false; };
  }, [capability, providerId]);

  const handleReinitializeWebGpu = useCallback(async () => {
    setStatus(PROVIDER_STATES.checking);
    try {
      const detected = await detectWebGpuCapability();
      setCapability(detected);
      if (isWebGpuAvailable(detected)) {
        setRetryToken((t) => t + 1);
      } else {
        setStatus(PROVIDER_STATES.unsupported);
      }
    } catch {
      setStatus(PROVIDER_STATES.unavailable);
    }
  }, []);

  useEffect(() => {
    let active = true;

    window.setTimeout(async () => {
      if (!active) {
        return;
      }
      setStatus(PROVIDER_STATES.checking);
      setModels([]);
      setVersion(null);

      const browserModelReady =
        browserModelInfo &&
        (browserModelInfo.state === MODEL_STATES.downloaded ||
          browserModelInfo.state === MODEL_STATES.ready);

      let provider;
      if (providerId === "browser-bonsai") {
        if (!capability || !isWebGpuAvailable(capability)) {
          setStatus(PROVIDER_STATES.unsupported);
          return;
        }
        if (!browserModelInfo) {
          setStatus(PROVIDER_STATES.checking);
          return;
        }
        if (!browserModelReady) {
          setStatus(PROVIDER_STATES.busy);
          return;
        }
        if (!browserRuntimeRef.current) {
          browserRuntimeRef.current = createBrowserRuntime();
        }
        provider = createBrowserBonsaiProvider({
          runtime: browserRuntimeRef.current,
          registry: browserRegistry,
          capabilityDetector: () => capability,
          defaultModelId: BROWSER_MODEL_ID,
        });
      } else {
        provider = createOllamaProvider({
          baseUrl: settings.ai?.baseUrl,
        });
      }

      const connection = await provider.testConnection();
      if (!active) {
        return;
      }
      if (!connection.ok) {
        setStatus(PROVIDER_STATES.unavailable);
        return;
      }

      setStatus(PROVIDER_STATES.ready);
      if (providerId === "browser-bonsai") {
        setVersion(null);
      } else {
        setVersion(connection.version || null);
      }

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
        providerId === "browser-bonsai"
          ? BROWSER_MODEL_ID
          : settings.ai?.defaultModel && list.some((model) => model.id === settings.ai.defaultModel)
            ? settings.ai.defaultModel
            : list.length > 0
              ? list[0].id
              : "";
      setModelId(defaultModel);

      sessionRef.current = createAiSession({
        provider,
        model: defaultModel,
        systemPrompt: SYSTEM_PROMPT,
      });

      if (!toolRegistryRef.current) {
        toolRegistryRef.current = buildToolRegistry(getContextData);
      }
    }, 0);

    return () => {
      active = false;
    };
  }, [
    retryToken,
    providerId,
    settings.ai,
    getContextData,
    capability,
    browserModelInfo,
    browserRegistry,
    refreshModelsToken,
  ]);

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

  useEffect(() => {
    if (providerId !== "ollama" || status !== PROVIDER_STATES.ready) {
      return;
    }
    let active = true;
    let timer = null;
    let backoffMs = 1000;
    const maxBackoff = 30000;
    const heartbeat = async () => {
      if (!active) return;
      try {
        const provider = createOllamaProvider({ baseUrl: settings.ai?.baseUrl });
        const result = await provider.testConnection();
        if (!active) return;
        if (result.ok) {
          backoffMs = 1000;
          timer = window.setTimeout(heartbeat, 30000);
        } else {
          setStatus(PROVIDER_STATES.unavailable);
        }
      } catch {
        if (!active) return;
        setStatus(PROVIDER_STATES.unavailable);
      }
    };
    timer = window.setTimeout(heartbeat, 30000);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [providerId, status, settings.ai?.baseUrl]);

  const handleProviderChange = useCallback(
    (next) => {
      if (next === providerId) {
        return;
      }
      if (sessionRef.current && typeof sessionRef.current.stop === "function") {
        sessionRef.current.stop();
      }
      if (providerId === "browser-bonsai" && sessionRef.current?.provider) {
        const oldProvider = sessionRef.current.provider;
        if (typeof oldProvider.dispose === "function") {
          oldProvider.dispose().catch(() => {});
        }
      }
      setProviderId(next);
      updateSetting("ai", "provider", next);
      sessionRef.current = null;
      setStatus(PROVIDER_STATES.checking);
      setMessages([]);
      setContextPreview(null);
      setToolActivity(null);
      setStreamingText("");
      setGenerationState(CONVERSATION_STATES.idle);
    },
    [providerId, updateSetting]
  );

  const handleClearConversation = useCallback(() => {
    sessionRef.current?.clear();
    setMessages([]);
    setContextPreview(null);
    setContextForInspector(null);
    setToolActivity(null);
    setStreamingText("");
    setGenerationState(CONVERSATION_STATES.idle);
    setLastStats(null);
    setPendingApproval(null);
  }, []);

  const persistConversation = useCallback(
    (nextMessages) => {
      if (nextMessages.length === 0) {
        return;
      }
      const title = nextMessages.find((m) => m.role === "user")?.content.slice(0, 40) || "Conversation";
      const record = createStoredConversation({
        title,
        provider: providerId,
        model: modelId,
        messages: nextMessages,
      });
      const next = [record, ...conversations].slice(0, 20);
      setConversations(next);
      saveConversations(next);
      setActiveConversationId(record.id);
    },
    [conversations, providerId, modelId]
  );

  const handleCreateConversation = useCallback(() => {
    handleClearConversation();
    setActiveConversationId(null);
  }, [handleClearConversation]);

  const handleSelectConversation = useCallback(
    (id) => {
      const found = conversations.find((c) => c.id === id);
      if (!found) {
        return;
      }
      setActiveConversationId(id);
      const restored = found.messages.map((m) =>
        createMessage({ role: m.role, content: m.content, id: m.id, timestamp: m.timestamp })
      );
      setMessages(restored);
      sessionRef.current?.clear();
      for (const message of restored) {
        if (message.role === "user" || message.role === "assistant") {
          try {
            sessionRef.current?.addMessage(message.role, message.content);
          } catch {
            // ignore
          }
        }
      }
    },
    [conversations]
  );

  const handleRenameConversation = useCallback(
    (id, title) => {
      const next = conversations.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
      setConversations(next);
      saveConversations(next);
    },
    [conversations]
  );

  const handleDeleteConversation = useCallback(
    (id) => {
      const next = conversations.filter((c) => c.id !== id);
      setConversations(next);
      saveConversations(next);
      if (activeConversationId === id) {
        handleClearConversation();
        setActiveConversationId(null);
      }
    },
    [conversations, activeConversationId, handleClearConversation]
  );

  const handleClearAllConversations = useCallback(() => {
    setConversations([]);
    saveConversations([]);
    handleClearConversation();
    setActiveConversationId(null);
  }, [handleClearConversation]);

  const handleToggleSource = useCallback((type) => {
    setExcludedSources((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleRefreshContext = useCallback(() => {
    const data = getContextData ? getContextData() : {};
    const model = models.find((m) => m.id === modelId) || null;
    const sourceMap = {
      selection: "selection",
      currentFile: "current_file",
      explicitFiles: "explicit",
      symbols: "symbols",
      openDocuments: "open_document",
      searchResults: "search",
      diagnostics: "diagnostics",
      graph: "graph",
    };
    const allSources = Object.keys(sourceMap);
    const sources =
      excludedSources.size > 0
        ? allSources.filter((source) => !excludedSources.has(sourceMap[source]))
        : undefined;
    const ctx = buildContext({ ...data, model, sources });
    setContextForInspector(ctx);
    setContextPreview(buildContextPreview(ctx));
  }, [getContextData, models, modelId, excludedSources]);

  const handleAcceptDiff = useCallback(
    (proposed) => {
      const data = getContextData ? getContextData() : {};
      const path = data.currentFile?.path;
      if (!path || !onApplyDiff) {
        return;
      }
      const original = data.currentFile?.content || "";
      const diff = createDiff({ path, original, proposed, actionId: "ai.code-action" });
      onApplyDiff(diff);
      setAppliedDiffId(diff.id);
      actionHistoryRef.current.add({
        action: "Improve code",
        provider: providerId,
        model: modelId,
        target: path,
        result: "Accepted",
        accepted: true,
        files: [path],
      });
      setActionEntries([...actionHistoryRef.current.list()]);
    },
    [getContextData, onApplyDiff, providerId, modelId]
  );

  const handleCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, []);

  const handleNavigateReference = useCallback(
    (ref) => {
      if (onNavigate) {
        onNavigate(ref);
      }
    },
    [onNavigate]
  );

  const sendWithContent = useCallback(
    async (promptContent) => {
      const content = typeof promptContent === "string" ? promptContent.trim() : input.trim();
      const session = sessionRef.current;
      if (!content || sending || !session || status !== PROVIDER_STATES.ready) {
        return;
      }

      const limitCheck = checkLimit();
      if (!limitCheck.allowed) {
        setMessages((current) => [
          ...current,
          createMessage({ role: "error", content: limitCheck.reason || "Usage limit reached." }),
        ]);
        return;
      }
      const sourceMap = {
        selection: "selection",
        currentFile: "current_file",
        explicitFiles: "explicit",
        symbols: "symbols",
        openDocuments: "open_document",
        searchResults: "search",
        diagnostics: "diagnostics",
        graph: "graph",
      };
      const allSources = Object.keys(sourceMap);
      const sources =
        excludedSources.size > 0
          ? allSources.filter((source) => !excludedSources.has(sourceMap[source]))
          : undefined;
      const context = buildContext({
        ...(getContextData ? getContextData() : {}),
        ...(promptContent && externalPrompt && externalPrompt.selection
          ? { selection: externalPrompt.selection }
          : {}),
        model: models.find((model) => model.id === modelId) || null,
        sources,
      });
      const preview = buildContextPreview(context);
      setContextPreview(preview);
      setContextForInspector(context);
      if (promptContent == null) {
        setInput("");
      }
      setSending(true);
      setGenerationState(CONVERSATION_STATES.generating);
      setGenerationPhase("thinking");
      setStreamingText("");
      streamRef.current = "";
      setMessages((current) => [
        ...current,
        createMessage({
          role: "user",
          content,
          contextMetadata: { budget: context.budget, used: context.used, limitedBy: context.limitedBy },
        }),
      ]);
      try {
        const result = await session.sendMessage({
          content,
          context,
          options:
            providerId === "ollama" &&
            models.find((model) => model.id === modelId)?.contextLength
              ? { num_ctx: models.find((model) => model.id === modelId).contextLength }
              : {},
          maxToolRounds: settings.ai?.maxToolRounds ?? 2,
          tools: BUILTIN_READONLY_TOOLS,
          toolRunner: async ({ toolName, arguments: args }) => {
            const tool = toolRegistryRef.current?.getTool
              ? toolRegistryRef.current.getTool(toolName)
              : null;
            const permission = tool ? tool.permission : "read";
            const request = approvalRequestFor({ toolName, permission, args });
            if (request.requiresApproval && permission !== "read") {
              setPendingApproval(request);
              return { ok: false, code: "approvalRequired", error: "Tool approval required" };
            }
            return executeToolCall({
              registry: toolRegistryRef.current,
              toolName,
              args,
              permission: "read",
            });
          },
          onTool: ({ toolCalls }) => {
            setGenerationPhase("tool-calling");
            setToolActivity(toolCalls.map((call) => call.toolName));
          },
          onDelta: (text) => {
            if (generationPhase !== "streaming") {
              setGenerationPhase("streaming");
            }
            pendingTextRef.current = text;
            if (rafRef.current == null) {
              rafRef.current = window.requestAnimationFrame(() => {
                rafRef.current = null;
                const pending = pendingTextRef.current;
                streamRef.current = pending;
                setStreamingText(pending);
              });
            }
          },
        });
        if (result && result.stats) {
          setLastStats({ ...result.stats, model: modelId, provider: providerId });
          const stats = result.stats;
          const accounting = stats.outputTokens != null ? "actual" : "unknown";
          recordUsage({
            provider: providerId,
            inputTokens: null,
            outputTokens: stats.outputTokens ?? null,
            totalTokens: stats.outputTokens ?? null,
            accounting,
          });
        } else {
          recordUsage({
            provider: providerId,
            accounting: "unknown",
          });
        }
        const assistantMessage = createMessage({
          role: "assistant",
          content: result.text,
          toolMetadata: result.toolCalls ? { toolCalls: result.toolCalls } : null,
        });
        setMessages((current) => {
          const next = [...current, assistantMessage];
          persistConversation(next);
          return next;
        });
        setGenerationState(CONVERSATION_STATES.complete);
      } catch (error) {
        const code = error && error.code;
        if (code === AI_ERRORS.cancelled) {
          setGenerationState(CONVERSATION_STATES.cancelled);
          const last = session.history().at(-1);
          if (last && last.role === "assistant") {
            setMessages((current) => [
              ...current,
              createMessage({ role: "assistant", content: last.content }),
            ]);
          }
        } else {
          const description = describeAiError(error);
          const message = description.hint || error?.message || "The AI request failed.";
          setMessages((current) => [
            ...current,
            createMessage({ role: "error", content: message }),
          ]);
          setGenerationState(CONVERSATION_STATES.error);
        }
      } finally {
        if (rafRef.current != null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setSending(false);
        setGenerationPhase(null);
        setStreamingText("");
        streamRef.current = "";
        pendingTextRef.current = "";
        setToolActivity(null);
        setPendingApproval(null);
      }
    },
    [
      input,
      sending,
      status,
      getContextData,
      externalPrompt,
      models,
      modelId,
      providerId,
      settings.ai,
      excludedSources,
      persistConversation,
      recordUsage,
      checkLimit,
      generationPhase,
    ]
  );

  useEffect(() => {
    if (!externalPrompt || typeof externalPrompt.content !== "string" || externalPrompt.content.length === 0) {
      return;
    }
    if (status !== PROVIDER_STATES.ready || sending) {
      return;
    }
    const timer = window.setTimeout(() => {
      sendWithContent(externalPrompt.content);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [externalPrompt, status, sending, sendWithContent]);

  const handleSend = useCallback(async () => {
    await sendWithContent();
  }, [sendWithContent]);

  const handleStop = useCallback(() => {
    sessionRef.current?.stop();
    setGenerationState(CONVERSATION_STATES.cancelled);
  }, []);

  const handleBrowserStateChange = useCallback(
    (info) => {
      setBrowserModelInfo(info);
    },
    []
  );

  const connectionClass = providerStateClass(status);

  const inputDisabled =
    status !== PROVIDER_STATES.ready ||
    (providerId === "browser-bonsai" &&
      !(browserModelInfo && browserModelInfo.state === MODEL_STATES.downloaded));

  const modelStatusLabel = (() => {
    if (status === PROVIDER_STATES.checking) {
      return "Loading model…";
    }
    if (status === PROVIDER_STATES.ready && models.length > 0) {
      return "Model ready";
    }
    if (status === PROVIDER_STATES.busy) {
      return "Model downloading";
    }
    if (status === PROVIDER_STATES.unavailable) {
      return "Provider unavailable";
    }
    if (status === PROVIDER_STATES.ready && models.length === 0) {
      return providerId === "ollama" ? "No model available" : "Model unavailable";
    }
    return null;
  })();

  const generationLabel = (() => {
    if (generationState === CONVERSATION_STATES.cancelled) {
      return "Generation interrupted";
    }
    if (generationState === CONVERSATION_STATES.error) {
      return "Error";
    }
    if (!sending) return null;
    if (generationPhase === "tool-calling") return "Calling tool\u2026";
    if (generationPhase === "streaming") return "Streaming response\u2026";
    if (generationPhase === "thinking") return "Thinking\u2026";
    return "Generating\u2026";
  })();

  return (
    <div className="ai-panel">
      <div className={`ai-status ${connectionClass}`}>
        <Bot size={14} />
        <span className="ai-status-text">{statusLabel(status, providerId)}</span>
        {version && <span className="ai-status-version">v{version}</span>}
        {modelStatusLabel && (
          <span className="ai-status-model" title={modelStatusLabel}>
            · {modelStatusLabel}
          </span>
        )}
        {generationLabel && (
          <span className="ai-status-generating" aria-live="polite">
            · {generationLabel}
          </span>
        )}
        <span className="ai-status-spacer" />
        {messages.length > 0 && !sending && (
          <button
            type="button"
            className="ai-clear"
            onClick={handleClearConversation}
            aria-label="Clear conversation"
          >
            Clear
          </button>
        )}
        {status === PROVIDER_STATES.unavailable && (
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

      <UsageIndicator
        usage={usage}
        limitStatus={getLimitStatus()}
      />

      <div className="ai-controls">
        <label className="ai-label" htmlFor="ai-provider-select">
          Provider
        </label>
        <select
          id="ai-provider-select"
          className="ai-model-select"
          value={providerId}
          onChange={(event) => handleProviderChange(event.target.value)}
        >
          <option value="ollama">Ollama (local server)</option>
          <option value="browser-bonsai">Bonsai (in this browser)</option>
        </select>

        <label className="ai-label" htmlFor="ai-model-select">
          Model
          {providerId === "ollama" && status === PROVIDER_STATES.ready && (
            <button
              type="button"
              className="ai-refresh-models"
              onClick={() => setRefreshModelsToken((t) => t + 1)}
              title="Refresh model list"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </label>
        <select
          id="ai-model-select"
          className="ai-model-select"
          value={modelId}
          disabled={status !== PROVIDER_STATES.ready || models.length === 0}
          onChange={(event) => setModelId(event.target.value)}
        >
          {models.length === 0 ? (
            <option value="">No models available</option>
          ) : (
            models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}{model.size ? ` (${formatModelSize(model.size)})` : ""}
              </option>
            ))
          )}
        </select>
        {providerId === "browser-bonsai" && status === PROVIDER_STATES.busy && (
          <p className="ai-hint">
            Download the Bonsai model above, then it will be ready to chat.
            <button
              type="button"
              className="ai-retry"
              onClick={() => handleProviderChange("ollama")}
            >
              Use Ollama instead
            </button>
          </p>
        )}
        {providerId === "ollama" && status === PROVIDER_STATES.ready && models.length === 0 && (
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
        {models.find((model) => model.id === modelId)?.contextLength ? (
          <p className="ai-hint">
            Context window:{" "}
            {formatContextWindow(models.find((model) => model.id === modelId).contextLength)}{" "}
            tokens
          </p>
        ) : null}
        {models.find((model) => model.id === modelId) && (
          <AIProviderCapabilities model={models.find((model) => model.id === modelId)} />
        )}
      </div>

      <BrowserAISection
        capability={capability}
        registry={browserRegistry}
        onStateChange={handleBrowserStateChange}
        onReinitialize={handleReinitializeWebGpu}
      />

      {(status === PROVIDER_STATES.unavailable || status === PROVIDER_STATES.busy) && <AISetup providerId={providerId} />}

      {contextPreview && (
        <div className="ai-context">
          <span className="ai-context-count">
            {contextPreview.sections.length} context source
            {contextPreview.sections.length === 1 ? "" : "s"}
            {contextPreview.truncated ? " · truncated" : ""}
            {contextPreview.limitedBy ? ` · ${formatContextWindow(contextPreview.limitedBy)} window` : ""}
          </span>
          <span className="ai-context-detail">
            {contextPreview.sections
              .map((section) => `${section.label} (${section.count})`)
              .join(", ")}
          </span>
        </div>
      )}

      <AIContextInspector
        context={contextForInspector}
        preview={contextPreview}
        excludedSources={excludedSources}
        onToggleSource={handleToggleSource}
        onRefresh={handleRefreshContext}
      />

      <AIConversations
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreate={handleCreateConversation}
        onRename={handleRenameConversation}
        onDelete={handleDeleteConversation}
        onClearAll={handleClearAllConversations}
      />

      <AIActionHistory
        entries={actionEntries}
        onClear={() => {
          actionHistoryRef.current.clear();
          setActionEntries([]);
        }}
        onNavigate={(path) => onNavigate && onNavigate({ path })}
      />

      <AgentWorkflowDemo getContextData={getContextData} onApplyDiff={onApplyDiff} onNavigate={onNavigate} />

      <div className="ai-tools">
        <ShieldCheck size={12} />
        <span>Read-only tools: current file, diagnostics, open files</span>
        {toolActivity && toolActivity.length > 0 && (
          <span className="ai-tools-active">
            Running: {toolActivity.join(", ")}
          </span>
        )}
      </div>

      {pendingApproval && (
        <AIToolApproval
          request={pendingApproval}
          onApprove={() => setPendingApproval(null)}
          onReject={() => setPendingApproval(null)}
        />
      )}

      {lastStats && (
        <div className="ai-stats">
          <span className="ai-stats-label">Last run</span>
          {formatTokensPerSecond(lastStats.tokensPerSecond) && (
            <span>{formatTokensPerSecond(lastStats.tokensPerSecond)}</span>
          )}
          {formatDurationMs(lastStats.durationMs) && (
            <span>{formatDurationMs(lastStats.durationMs)}</span>
          )}
          {lastStats.outputTokens != null && (
            <span>{lastStats.outputTokens} tokens</span>
          )}
        </div>
      )}

      <div className="ai-messages" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && !sending ? (
          <div className="ai-empty">
            <Bot size={18} />
            <p>Ask about the current file or the open project.</p>
            {status === PROVIDER_STATES.ready ? (
              <p className="ai-hint">Provider is ready. Type a message below to start.</p>
            ) : status === PROVIDER_STATES.checking ? (
              <p className="ai-hint">Checking provider connection...</p>
            ) : (
              <p className="ai-hint">Set up Ollama or Bonsai in Settings to enable AI.</p>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const key = message.id || message.timestamp;
            if (message.role === "error") {
              return (
                <div key={key} className="ai-message ai-message-error" role="alert">
                  {message.content}
                </div>
              );
            }
            if (message.role === "user") {
              return (
                <div key={key} className="ai-message ai-message-user">
                  {message.content}
                </div>
              );
            }
            const originalContent = getContextData ? getContextData().currentFile?.content : "";
            return (
              <div key={key} className="ai-message ai-message-assistant">
                <div>{message.content}</div>
                <AIReferences text={message.content} onNavigate={handleNavigateReference} />
                {hasCodeBlock(message.content) && (
                  <AIDiffPreview
                    message={message}
                    original={originalContent}
                    onAccept={handleAcceptDiff}
                    onReject={() => {}}
                    onCopy={handleCopy}
                  />
                )}
              </div>
            );
          })
        )}
        {sending && streamingText && (
          <div className="ai-message ai-message-assistant ai-message-streaming" aria-live="polite">
            {streamingText}
            <span className="ai-caret" aria-hidden="true" />
          </div>
        )}
        {sending && !streamingText && (
          <div className="ai-message ai-message-assistant ai-message-thinking" aria-live="polite">
            {(() => {
              if (generationPhase === "tool-calling") return "Calling tool\u2026";
              return "Thinking\u2026";
            })()}
            <span className="ai-caret" aria-hidden="true" />
          </div>
        )}
        {appliedDiffId && (
          <div className="ai-diff-applied" role="status">
            <Check size={12} />
            Change applied — save the file to write it to disk.
          </div>
        )}
      </div>

      <div className="ai-input-row">
        <textarea
          className="ai-input"
          rows={2}
          placeholder={
            status === PROVIDER_STATES.ready
              ? "Ask about your code..."
              : providerId === "browser-bonsai"
                ? "Download the Bonsai model to chat"
                : "Start Ollama to chat"
          }
          value={input}
          disabled={inputDisabled}
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
            disabled={!input.trim() || status !== PROVIDER_STATES.ready}
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