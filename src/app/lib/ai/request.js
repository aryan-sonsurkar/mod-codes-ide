import { AI_ERRORS, AiError } from "./errors";

const VALID_ROLES = new Set(["system", "user", "assistant"]);

export function normalizeMessage(message) {
  if (!message || typeof message !== "object") {
    throw new AiError(AI_ERRORS.invalidRequest, "Invalid message.");
  }

  const role = message.role;
  if (!VALID_ROLES.has(role)) {
    throw new AiError(AI_ERRORS.invalidRequest, `Invalid message role: ${role}`);
  }

  const content = message.content;
  if (typeof content !== "string") {
    throw new AiError(AI_ERRORS.invalidRequest, "Message content must be a string.");
  }

  return { role, content };
}

export function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new AiError(AI_ERRORS.invalidRequest, "Messages must be an array.");
  }
  return messages.map(normalizeMessage);
}

export function createAiRequest({ messages, context = null, model = null, options = {} }) {
  return {
    messages: normalizeMessages(messages),
    context: context || null,
    model: model,
    options: options && typeof options === "object" ? options : {},
  };
}