export const AI_ERRORS = {
  unavailable: "unavailable",
  connectionFailed: "connectionFailed",
  modelNotFound: "modelNotFound",
  unsupported: "unsupported",
  timeout: "timeout",
  network: "network",
  rateLimited: "rateLimited",
  invalidRequest: "invalidRequest",
  cancelled: "cancelled",
  notReady: "notReady",
};

const ERROR_DISPLAY = {
  [AI_ERRORS.unavailable]: {
    title: "Provider unavailable",
    hint: "Check that Ollama is running or try a different provider.",
    retryable: true,
  },
  [AI_ERRORS.connectionFailed]: {
    title: "Connection failed",
    hint: "Could not reach the AI provider. Verify the server is running.",
    retryable: true,
  },
  [AI_ERRORS.modelNotFound]: {
    title: "Model not found",
    hint: "Install the model with ollama pull <model>.",
    retryable: false,
  },
  [AI_ERRORS.unsupported]: {
    title: "Not supported",
    hint: "Your browser does not support the required features.",
    retryable: false,
  },
  [AI_ERRORS.timeout]: {
    title: "Request timed out",
    hint: "The model may be overloaded. Try again in a moment.",
    retryable: true,
  },
  [AI_ERRORS.network]: {
    title: "Network error",
    hint: "Check your internet connection and try again.",
    retryable: true,
  },
  [AI_ERRORS.rateLimited]: {
    title: "Rate limited",
    hint: "Too many requests. Wait a moment before retrying.",
    retryable: true,
  },
  [AI_ERRORS.invalidRequest]: {
    title: "Invalid request",
    hint: "Something went wrong with the request.",
    retryable: false,
  },
  [AI_ERRORS.cancelled]: {
    title: "Cancelled",
    hint: "The request was cancelled by the user.",
    retryable: false,
  },
  [AI_ERRORS.notReady]: {
    title: "Not ready",
    hint: "The model is still loading or not configured.",
    retryable: true,
  },
};

export function describeAiError(error) {
  if (!error) {
    return { title: "Unknown error", hint: "", retryable: false };
  }
  const code = error.code || AI_ERRORS.invalidRequest;
  const display = ERROR_DISPLAY[code] || ERROR_DISPLAY[AI_ERRORS.invalidRequest];
  return {
    title: display.title,
    hint: error.message || display.hint,
    retryable: display.retryable,
  };
}

export class AiError extends Error {
  constructor(code, message, { retryable = false, cause = null } = {}) {
    super(message || code);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export function aiError(code, message, options) {
  return new AiError(code, message, options);
}

export function isAiError(error) {
  return error instanceof AiError;
}

export function normalizeAiError(error, fallbackCode = AI_ERRORS.invalidRequest) {
  if (isAiError(error)) {
    return error;
  }

  const message =
    error && typeof error.message === "string"
      ? error.message
      : String(error || "Unknown AI error");

  return new AiError(fallbackCode, message, { cause: error });
}