const STORAGE_KEY = "modcodes.ai.conversations.v1";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeMessage(message) {
  if (!message || typeof message.content !== "string") {
    return null;
  }
  if (typeof message.role !== "string") {
    return null;
  }
  if (message.content.length > 20000) {
    return null;
  }
  return {
    id: typeof message.id === "string" ? message.id : null,
    role: message.role,
    content: message.content.slice(0, 10000),
    timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
  };
}

export function loadConversations() {
  if (typeof localStorage === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
    .map((item) => ({
      id: item.id,
      title: typeof item.title === "string" ? item.title.slice(0, 80) : "Conversation",
      createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      provider: typeof item.provider === "string" ? item.provider : null,
      model: typeof item.model === "string" ? item.model : null,
      messages: item.messages.map(sanitizeMessage).filter(Boolean).slice(0, 200),
    }))
    .slice(0, 50);
}

export function saveConversations(conversations) {
  if (typeof localStorage === "undefined") {
    return;
  }
  const sanitized = (conversations || [])
    .filter((item) => item && typeof item.id === "string")
    .slice(0, 50)
    .map((item) => ({
      id: item.id,
      title: typeof item.title === "string" ? item.title.slice(0, 80) : "Conversation",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      provider: item.provider,
      model: item.model,
      messages: (item.messages || []).map(sanitizeMessage).filter(Boolean).slice(0, 200),
    }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function createStoredConversation({ title, provider, model, messages = [] } = {}) {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: typeof title === "string" && title.length > 0 ? title.slice(0, 80) : "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provider: typeof provider === "string" ? provider : null,
    model: typeof model === "string" ? model : null,
    messages: messages.map(sanitizeMessage).filter(Boolean),
  };
}

export function clearConversations() {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

export const CONVERSATION_STORAGE_KEY = STORAGE_KEY;
