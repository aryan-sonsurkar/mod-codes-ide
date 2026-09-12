const LEGACY_STORAGE_KEY = "modcodes.ai.conversations.v1";
const STORAGE_VERSION = 2;

function storageKeyForProject(projectId) {
  if (!projectId) return LEGACY_STORAGE_KEY;
  return `modcodes.ai.conversations.v2.${projectId}`;
}

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
    contextMetadata: message.contextMetadata && typeof message.contextMetadata === "object" ? message.contextMetadata : null,
    toolMetadata: message.toolMetadata && typeof message.toolMetadata === "object" ? message.toolMetadata : null,
  };
}

function sanitizeConversation(item) {
  if (!item || typeof item.id !== "string" || !Array.isArray(item.messages)) {
    return null;
  }
  return {
    id: item.id,
    title: typeof item.title === "string" ? item.title.slice(0, 80) : "Conversation",
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
    provider: typeof item.provider === "string" ? item.provider : null,
    model: typeof item.model === "string" ? item.model : null,
    projectId: typeof item.projectId === "string" ? item.projectId : null,
    messages: item.messages.map(sanitizeMessage).filter(Boolean).slice(0, 200),
  };
}

function readRaw(key) {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return safeParse(raw);
}

function writeRaw(key, data) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota exceeded or private mode
  }
}

function migrateFromGlobal(projectId) {
  if (typeof localStorage === "undefined") return [];
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return [];
  const parsed = safeParse(legacyRaw);
  if (!Array.isArray(parsed)) return [];

  const migrated = parsed
    .map(sanitizeConversation)
    .filter(Boolean)
    .map((c) => ({ ...c, projectId: projectId || null }));

  if (migrated.length > 0) {
    const key = storageKeyForProject(projectId);
    writeRaw(key, { version: STORAGE_VERSION, conversations: migrated });
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  return migrated.slice(0, 50);
}

export function loadConversations(projectId) {
  if (typeof localStorage === "undefined") return [];

  const key = storageKeyForProject(projectId);
  const stored = readRaw(key);

  if (stored && Array.isArray(stored.conversations)) {
    return stored.conversations.map(sanitizeConversation).filter(Boolean).slice(0, 50);
  }

  if (stored && Array.isArray(stored)) {
    return stored.map(sanitizeConversation).filter(Boolean).slice(0, 50);
  }

  if (!projectId) {
    return migrateFromGlobal(null);
  }

  return migrateFromGlobal(projectId);
}

export function saveConversations(conversations, projectId) {
  if (typeof localStorage === "undefined") return;

  const key = storageKeyForProject(projectId);
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
      projectId: projectId || item.projectId || null,
      messages: (item.messages || []).map(sanitizeMessage).filter(Boolean).slice(0, 200),
    }));

  writeRaw(key, { version: STORAGE_VERSION, conversations: sanitized });
}

export function createStoredConversation({ title, provider, model, messages = [], projectId = null } = {}) {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: typeof title === "string" && title.length > 0 ? title.slice(0, 80) : "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provider: typeof provider === "string" ? provider : null,
    model: typeof model === "string" ? model : null,
    projectId: typeof projectId === "string" ? projectId : null,
    messages: messages.map(sanitizeMessage).filter(Boolean),
  };
}

export function clearConversations(projectId) {
  if (typeof localStorage === "undefined") return;
  const key = storageKeyForProject(projectId);
  localStorage.removeItem(key);
}

export function searchConversations(conversations, query) {
  if (!query || typeof query !== "string") return conversations;
  const lower = query.toLowerCase().trim();
  if (!lower) return conversations;

  return conversations.filter((c) => {
    if (c.title && c.title.toLowerCase().includes(lower)) return true;
    return c.messages.some(
      (m) => typeof m.content === "string" && m.content.toLowerCase().includes(lower)
    );
  });
}

export const CONVERSATION_STORAGE_KEY = LEGACY_STORAGE_KEY;
export const CONVERSATION_STORAGE_VERSION = STORAGE_VERSION;
