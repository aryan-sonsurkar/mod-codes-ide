let nextMessageId = 0;

export const CONVERSATION_ROLES = {
  user: "user",
  assistant: "assistant",
  system: "system",
  error: "error",
  tool: "tool",
};

export const CONVERSATION_STATES = {
  idle: "idle",
  loading: "loading",
  generating: "generating",
  cancelled: "cancelled",
  complete: "complete",
  error: "error",
};

function generateMessageId() {
  nextMessageId += 1;
  return `msg-${nextMessageId}-${Date.now()}`;
}

export function resetMessageIdForTests() {
  nextMessageId = 0;
}

export function createMessage({
  id = null,
  role,
  content,
  timestamp = null,
  contextMetadata = null,
  toolMetadata = null,
  streaming = false,
} = {}) {
  if (!role || typeof role !== "string") {
    throw new TypeError("Message role is required");
  }
  if (typeof content !== "string") {
    throw new TypeError("Message content must be a string");
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : generateMessageId(),
    role,
    content,
    timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
    contextMetadata: contextMetadata && typeof contextMetadata === "object" ? contextMetadata : null,
    toolMetadata: toolMetadata && typeof toolMetadata === "object" ? toolMetadata : null,
    streaming: Boolean(streaming),
  };
}

export function createConversation({ id = null, title = null, messages = [] } = {}) {
  return {
    id: typeof id === "string" && id.length > 0 ? id : `conv-${Date.now()}`,
    title: typeof title === "string" && title.length > 0 ? title : "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: Array.isArray(messages) ? [...messages] : [],
  };
}

export function appendMessage(conversation, message) {
  return {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: Date.now(),
  };
}

export function updateMessage(conversation, messageId, patch) {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message
    ),
    updatedAt: Date.now(),
  };
}

export function clearConversation(conversation) {
  return {
    ...conversation,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function conversationToHistory(messages) {
  return messages
    .filter((message) => message.role !== CONVERSATION_ROLES.error)
    .map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.toolMetadata ? { tool_calls: message.toolMetadata.toolCalls || [] } : {}),
    }));
}
