import { AI_ERRORS, isAiError, normalizeAiError } from "./errors";

export const STREAM_EVENTS = {
  text: "text",
  done: "done",
  error: "error",
  tool: "tool",
};

export function textChunk(text) {
  return { type: STREAM_EVENTS.text, text };
}

export function doneChunk() {
  return { type: STREAM_EVENTS.done };
}

export function errorChunk(error) {
  return { type: STREAM_EVENTS.error, error: normalizeAiError(error) };
}

export function toolChunk(toolRequest) {
  return { type: STREAM_EVENTS.tool, toolRequest };
}

export function isStreamChunk(value) {
  return (
    value &&
    typeof value === "object" &&
    (value.type === STREAM_EVENTS.text ||
      value.type === STREAM_EVENTS.done ||
      value.type === STREAM_EVENTS.error ||
      value.type === STREAM_EVENTS.tool)
  );
}

export function createChatResult({ text }) {
  return {
    ok: true,
    text: typeof text === "string" ? text : "",
  };
}

export function createChatFailure(error) {
  const normalized = normalizeAiError(error);
  return {
    ok: false,
    error: normalized,
    code: normalized.code,
  };
}

export { AI_ERRORS, isAiError };